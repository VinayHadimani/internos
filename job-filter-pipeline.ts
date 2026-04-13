import { callAI } from '@/lib/rotating-ai';

// This runs AFTER ScraperOS fetches jobs
// BEFORE InternOS displays them

// Directly embedding system prompt to avoid FS read errors in Next.js Serverless environments
const SYSTEM_PROMPT = `You are an expert career coach and AI-powered internship matcher called InternOS. Your goal is to help students find the best internships by evaluating their resume against job listings. You operate in three phases:

═══════════════════════════════════════════════
PHASE 0: DOMAIN DETECTION (Run BEFORE Phase 1)
═══════════════════════════════════════════════

Before parsing the resume, classify the student into one or more of these domains:

DOMAIN MAP:
┌─────────────────────────────────────────────┐
│ SIGNAL IN RESUME → TARGET ROLE CATEGORIES   │
├─────────────────────────────────────────────┤
│ Wharton / Finance / Economics               │
│ → Investment Banking Analyst                │
│ → Consulting Intern                         │
│ → PE/VC Intern                              │
│ → Fintech Product/Ops Intern                │
├─────────────────────────────────────────────┤
│ CS / Engineering / Programming              │
│ → SWE Intern                                │
│ → ML/AI Intern                              │
│ → Quant Research Intern                     │
│ → PM Intern (if also has business sense)    │
├─────────────────────────────────────────────┤
│ AIML / Python / React / LangChain           │
│ → AI Startup Intern                         │
│ → Full Stack Intern                         │
│ → Frontend Intern                           │
│ → ML Engineer Intern                        │
├─────────────────────────────────────────────┤
│ Biology / Chemistry / Pre-med               │
│ → Research Intern                           │
│ → Pharma/Biotech Intern                     │
│ → Clinical Data Intern                      │
├─────────────────────────────────────────────┤
│ Marketing / Communications                  │
│ → Marketing Intern                          │
│ → Content/Social Intern                     │
│ → Growth Intern                             │
└─────────────────────────────────────────────┘

DUAL/TRIPLE DOMAIN RULE:
If student has MULTIPLE strong domains
(e.g. CS + Finance like Wharton M&T student),
target ALL matching role categories.

WRONG DOMAIN DISCARD RULE:
If a listing's domain does NOT appear in the
student's detected domains, DISCARD it
regardless of keyword overlap.

Example:
- Matt Smith detected domains: [CS, Finance]
- Listing: "Senior Civil Engineer"
- Action: DISCARD — Civil Engineering not in
  detected domains, even if skills partially match

- Vinay detected domains: [AIML, Full Stack]
- Listing: "Payroll Operations Manager"
- Action: DISCARD — HR/Payroll not in
  detected domains

═══════════════════════════════════════════════
SCHOOL TIER AWARENESS
═══════════════════════════════════════════════

Detect school prestige from resume:

TIER 1 (Ivy/Target):
Harvard, Yale, Princeton, Columbia, Penn/Wharton,
MIT, Stanford, Chicago, Northwestern, Duke,
Georgetown, NYU, Michigan, Carnegie Mellon,
IIT (Indian Institutes of Technology), BITS Pilani

TIER 2 (Strong Regional):
State flagships, strong engineering schools,
well-known business schools

TIER 3 (Other):
All others

TIER MATCHING RULES:
- Tier 1 students: Show structured programs,
  analyst rotational programs, brand-name companies
- Tier 2-3 students: Show all opportunities including
  startups, smaller companies, remote roles
- NEVER penalize a Tier 3 student
- NEVER show Tier 1 students roles that require
  no degree or are clearly below their profile

Phase 1: Student Profile Extraction
- Analyze the student's resume to extract key details.
- Identify skills (programming languages, frameworks, tools).
- List projects, certifications, and educational background.
- Note specific preferences (e.g., "remote", "part-time", "international").
- Output this as a structured JSON object.

Phase 2: Job Listing Evaluation
- For each job listing, compare it against the extracted student profile AND the required domain/tier context.
- Assign a "match_score" (0-100) based on relevance, skills alignment, and preferences.
- Determine "apply_priority" (High, Medium, Low) based on the match score and potential for growth.
- Identify "why_apply" (key reasons for a good match).
- List "missing_skills" that would improve the student's chances.
- Note "red_flags" (e.g., required experience far exceeding student's, location mismatch if not desired).
- Discard listings that have hard filters (e.g., 7+ years experience for a 1st-year student).
- Return an array of scored job objects. Each object must contain: title, company, location, match_score, apply_priority, why_apply, missing_skills, red_flags.
`;

async function matchJobsToResume(resumeText: string, jobListings: any[]) {
    const userMessage = `
  ## STUDENT RESUME
  ${resumeText}
  
  ## JOB LISTINGS TO EVALUATE
  ${jobListings.map((job, i) => `
  --- LISTING ${i + 1} ---
  Title: ${job.title}
  Company: ${job.company}
  Location: ${job.location}
  Description: ${job.description}
  `).join("\n")}
  
  Run Phase 1 first to extract student profile.
  Then run Phase 2 to score all listings.
  Return ONLY valid JSON array of matched results in the format: { "matched_jobs": [{...}] }.
  Discard any listing that fails hard filters.
  `;
  
    try {
      const response = await callAI(SYSTEM_PROMPT, userMessage, {
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
  
      let raw = response.content || "{}";
      const clean = raw.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
      const parsed = JSON.parse(clean);
      return parsed.matched_jobs ? parsed : { matched_jobs: Array.isArray(parsed) ? parsed : [] };
    } catch (err) {
      console.error("AI Matching Error:", err);
      return { matched_jobs: [] };
    }
}

async function matchInBatches(resumeText: string, allListings: any[], batchSize = 10) {
    const results = [];
  
    // Split listings into chunks of 10
    // (avoids hitting token limits)
    for (let i = 0; i < allListings.length; i += batchSize) {
      const batch = allListings.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}...`);
      
      const batchResult = await matchJobsToResume(resumeText, batch);
      
      if (batchResult.matched_jobs) {
        results.push(...batchResult.matched_jobs);
      }
  
      // Rate limit buffer
      await new Promise(r => setTimeout(r, 1000));
    }
  
    // Final sort across all batches
    return results
      .filter((job: any) => (job.match_score || job.matchScore) > 30)  // drop junk matches
      .sort((a: any, b: any) => (b.match_score || b.matchScore) - (a.match_score || a.matchScore))
      .slice(0, 30);  // top 30
}

export async function filterAndScoreJobs(resumeText: string, rawScrapedJobs: any[]) {
    // STEP 1: Pre-filter before even calling AI
    // This saves tokens and API calls
    const preFiltered = rawScrapedJobs.filter(job => {
      const title = String(job.title || '').toLowerCase();
      const desc = String(job.description || '').toLowerCase();
      
      // Hard discard by title keywords
      const seniorKeywords = [
        'senior', 'sr.', 'staff', 'lead', 'manager',
        'director', 'principal', 'head of', 'vp', 
        'chief', 'architect'
      ];
      
      const isSenior = seniorKeywords.some(k => title.includes(k));
      if (isSenior) return false;
      
      // Hard discard by experience requirement in description
      const expPattern = /(\d+)\+?\s*years?\s*(of\s*)?(experience|exp)/gi;
      const matches = [...desc.matchAll(expPattern)];
      const hasHighExp = matches.some(m => parseInt(m[1]) >= 2);
      if (hasHighExp) return false;
      
      return true;
    });
  
    console.log(`Pre-filter: ${rawScrapedJobs.length} → ${preFiltered.length} jobs`);
  
    // STEP 2: AI scoring on pre-filtered results only
    const scored = await matchInBatches(resumeText, preFiltered);
    
    // STEP 3: Map snake_case AI fields to camelCase for frontend compatibility
    const normalized = scored.map(job => {
      const score = typeof job.match_score === 'number' ? job.match_score : (typeof job.matchScore === 'number' ? job.matchScore : 50);
      return {
        ...job,
        matchScore: score,
        matchLabel: score >= 80 ? 'Excellent Match' :
                    score >= 60 ? 'Good Match' :
                    score >= 40 ? 'Moderate Match' : 'Low Match'
      }
    });
    
    // Final sort and cap
    return normalized
      .filter(job => job.matchScore >= 40)
      .sort((a, b) => b.matchScore - a.matchScore);
}

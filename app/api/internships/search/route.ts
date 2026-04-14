import { NextRequest, NextResponse } from 'next/server';
import { aggregateJobs, type JobResult } from '@/lib/aggregator';
import { callAI } from '@/lib/rotating-ai';

// ══════════════════════════════════════════════════════
// AI-POWERED RESUME → JOB MATCHING PIPELINE
//
// Flow:
// 1. AI reads resume → extracts skills, target roles, domain
// 2. Build search queries from AI output
// 3. Fetch jobs from aggregator using those queries
// 4. Score each job against AI-extracted profile
// ══════════════════════════════════════════════════════

interface ResumeProfile {
  skills: string[];
  roles: string[];
  industry: string;
  experience_level: string;
  keywords: string[];
}

/**
 * Use AI (Groq/Gemini) to deeply analyze the resume and extract
 * what kind of jobs this person should be searching for.
 */
async function aiExtractProfile(resumeText: string): Promise<ResumeProfile | null> {
  try {
    const prompt = `You are an expert career analyst. Analyze the following resume and extract a comprehensive profile. This could be from ANY industry — consulting, finance, engineering, marketing, design, law, healthcare, data science, operations, HR, or any other field.

Resume:
${resumeText.slice(0, 4000)}

Return a JSON object with exactly these fields:
{
  "skills": ["skill1", "skill2", "skill3"],
  "roles": ["role1", "role2"],
  "experience_level": "entry",
  "keywords": ["keyword1", "keyword2"],
  "industry": "the primary industry"
}

Rules:
- Extract ALL relevant skills mentioned in the resume — technical skills, soft skills, tools, methodologies, frameworks, platforms, certifications
- Roles should be job titles or functions relevant to the person's experience (e.g., "Business Analyst", "Marketing Intern", "Data Scientist", "Consultant", "Project Manager")
- Keywords should be search-friendly terms that would find relevant job postings (e.g., "business development", "market research", "financial modeling", "UI/UX design", "supply chain")
- Do NOT assume this is a software engineering resume. Read the resume carefully and extract what is ACTUALLY there
- Include at least 5-10 skills and 2-5 roles
- Include at least 3-5 search keywords

Return ONLY valid JSON, no explanation.`;

    const response = await callAI(
      prompt,
      ``,
      {
        model: 'gemini-1.5-flash', // Try 1.5 flash since 2.0 quota is maxed
        temperature: 0.1,
        max_tokens: 800,
        providerPriority: ['gemini', 'groq', 'openai'] // Try Gemini first since Groq often 429s
      }
    );

    if (!response.success || !response.content) {
      console.error('[Search] AI profile extraction failed:', response.error);
      return null;
    }

    let raw = response.content;
    // Clean markdown wrapping if present
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    
    const parsed = JSON.parse(raw) as ResumeProfile;
    
    // Validate
    if (!parsed.skills || !Array.isArray(parsed.skills)) return null;
    if (!parsed.keywords || !Array.isArray(parsed.keywords)) return null;
    
    console.log(`[Search] AI Profile — Industry: ${parsed.industry}, Skills: ${(parsed.skills||[]).slice(0, 8).join(', ')}`);
    console.log(`[Search] AI Profile — Roles: ${(parsed.roles||[]).join(', ')}`);
    console.log(`[Search] AI Profile — Keywords: ${(parsed.keywords||[]).join(', ')}`);
    
    return parsed;
  } catch (err: any) {
    console.error('[Search] AI profile extraction error:', err.message);
    return null;
  }
}

/**
 * Fallback: basic keyword extraction when AI is unavailable.
 */
function fallbackExtractProfile(resumeText: string, clientSkills: string[], clientRoles: string[]): ResumeProfile {
  const lower = resumeText.toLowerCase();
  
  const allKeywords = [
    'javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue', 'node',
    'mongodb', 'sql', 'postgresql', 'aws', 'docker', 'kubernetes', 'git',
    'html', 'css', 'figma', 'redux', 'nextjs', 'django', 'flask', 'spring',
    'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'nlp',
    'excel', 'powerpoint', 'tableau', 'power bi', 'r', 'stata', 'spss',
    'financial modeling', 'valuation', 'consulting', 'strategy', 'case study',
    'marketing', 'seo', 'social media', 'brand management', 'salesforce',
    'product management', 'agile', 'scrum', 'jira',
    'supply chain', 'logistics', 'operations',
    'photoshop', 'illustrator', 'indesign',
  ];
  
  const found = allKeywords.filter(kw => {
    if (kw.length <= 2) return new RegExp(`\\b${kw}\\b`, 'i').test(resumeText);
    return lower.includes(kw);
  });
  
  const skills = [...new Set([...found, ...clientSkills])].filter(Boolean);
  
  // Detect domain
  let domain = 'general';
  if (['consulting', 'strategy', 'mckinsey', 'bain', 'bcg', 'deloitte', 'advisory'].some(k => lower.includes(k))) domain = 'consulting';
  else if (['finance', 'banking', 'investment', 'valuation', 'equity'].some(k => lower.includes(k))) domain = 'finance';
  else if (['react', 'angular', 'node', 'python', 'javascript', 'developer', 'engineer'].some(k => lower.includes(k))) domain = 'software_engineering';
  else if (['machine learning', 'data science', 'tensorflow', 'pytorch'].some(k => lower.includes(k))) domain = 'data_science';
  else if (['marketing', 'seo', 'social media', 'brand'].some(k => lower.includes(k))) domain = 'marketing';
  
  const roles = clientRoles.length > 0 ? clientRoles : [domain.replace('_', ' ') + ' intern'];
  
  return {
    skills,
    roles,
    industry: domain,
    experience_level: 'student',
    keywords: roles.map(r => `${r} internship`).slice(0, 4)
  };
}

/**
 * Score a job against the AI-extracted profile.
 */
function scoreJob(job: any, profile: ResumeProfile): number {
  let score = 0;
  const jobTitle = (job.title || '').toLowerCase();
  const jobDesc = (job.description || '').toLowerCase();
  const jobText = `${jobTitle} ${jobDesc}`;

  // 50% — Skills match (any skills, not just tech)
  const userSkills = profile.skills || [];
  const normalizedSkills = userSkills.map(s => s.toLowerCase());
  const skillsMatched = normalizedSkills.filter(skill => {
    // Check for exact match or the skill word appearing in job text
    const skillWords = skill.split(/\s+/);
    return skillWords.every(word => jobText.includes(word));
  });
  const skillScore = userSkills.length > 0
    ? (skillsMatched.length / normalizedSkills.length) * 50
    : 0;
  score += skillScore;

  // 30% — Role/title match
  const userRoles = profile.roles || [];
  const normalizedRoles = userRoles.map(r => r.toLowerCase());
  const rolesMatched = normalizedRoles.filter(role => {
    const roleWords = role.split(/\s+/);
    return roleWords.every(word => jobTitle.includes(word) || jobText.includes(word));
  });
  const roleScore = userRoles.length > 0
    ? (rolesMatched.length / normalizedRoles.length) * 30
    : 0;
  score += roleScore;

  // 20% — Experience level match
  const expLevel = (profile.experience_level || '').toLowerCase();
  if (expLevel && jobText.includes(expLevel)) {
    score += 15;
  }
  if (jobTitle.includes('intern') || jobTitle.includes('entry') || jobTitle.includes('trainee')) {
    score += 5;
  } else {
    score += 10;
  }

  // Senior penalties
  const seniorKw = ['senior', 'sr.', 'lead', 'manager', 'director', 'vp', 'chief'];
  if (seniorKw.some(k => jobTitle.includes(k))) score -= 25;

  return Math.max(0, Math.min(Math.round(score), 100));
}

function getMatchLabel(score: number): string {
  if (score >= 75) return 'Excellent Match';
  if (score >= 55) return 'Good Match';
  if (score >= 35) return 'Moderate Match';
  return 'Low Match';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      query = 'software developer', 
      location: bodyLocation = '', 
      skills: clientSkills = [], 
      preferredRoles: clientRoles = [],
    } = body;
    
    const resumeText: string = body.resumeText || '';
    const userLocation = bodyLocation || 'India';

    console.log('=== INTERNOS SEARCH ===');

    // ────────────────────────────────────────────
    // Step 1: AI-powered resume analysis
    // Uses Gemini (primary) → Groq (fallback)
    // ────────────────────────────────────────────
    let profile: ResumeProfile | null = null;

    if (resumeText && resumeText.length > 50) {
      // Try AI extraction (Gemini/Groq)
      profile = await aiExtractProfile(resumeText);
    }

    // If AI failed, use keyword fallback
    if (!profile) {
      console.log('[Search] AI unavailable, using keyword fallback');
      profile = fallbackExtractProfile(
        resumeText, 
        Array.isArray(clientSkills) ? clientSkills.map(String) : [],
        Array.isArray(clientRoles) ? clientRoles.map(String) : []
      );
    }

    console.log(`[Search] Final profile — Industry: ${profile.industry}`);
    console.log(`[Search] Final skills (${profile.skills.length}): ${(profile.skills||[]).slice(0, 10).join(', ')}`);
    console.log(`[Search] Search queries: ${(profile.keywords||[]).join(' | ')}`);

    // ────────────────────────────────────────────
    // Step 2: Fetch jobs using AI-generated queries
    // ────────────────────────────────────────────
    const searchQueries = [
      ...(profile.skills || []).slice(0, 5),
      ...(profile.keywords || []).slice(0, 5),
      ...(profile.roles || []).slice(0, 2)
    ];
    
    const allJobsMap = new Map<string, JobResult>();
    for (const q of searchQueries) {
      try {
        const batch = await aggregateJobs(q, userLocation);
        for (const job of batch) {
          const key = `${job.title}-${job.company}`.toLowerCase().replace(/\s+/g, '');
          if (!allJobsMap.has(key)) {
            allJobsMap.set(key, job);
          }
        }
      } catch (e) {
        console.error(`aggregateJobs failed for "${q}":`, e);
      }
    }

    const rawJobs = Array.from(allJobsMap.values());
    console.log(`[Search] Total unique jobs fetched: ${rawJobs.length}`);

    // ────────────────────────────────────────────
    // Step 3: Score and rank against profile
    // ────────────────────────────────────────────
    const scoredJobs = rawJobs.map(job => {
      const matchScore = scoreJob(job, profile!);
      return { ...job, matchScore, matchLabel: getMatchLabel(matchScore) };
    });

    const finalJobs = scoredJobs
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 50);

    console.log(`[Search] Returning ${finalJobs.length} jobs (top: ${finalJobs[0]?.matchScore || 0}%)`);

    return NextResponse.json({
      success: true,
      total: finalJobs.length,
      detected_skills: profile.skills,
      detected_domains: [profile.industry],
      target_roles: profile.roles,
      jobs: finalJobs,
      count: finalJobs.length
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { success: false, error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
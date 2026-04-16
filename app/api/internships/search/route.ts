import { NextRequest, NextResponse } from 'next/server';
import { aggregateJobs, type JobResult } from '@/lib/aggregator';
import { callAI } from '@/lib/rotating-ai';
import { matchJobListings, type JobListing } from '@/lib/matching/match-engine';
import { type StudentProfile } from '@/lib/resume-parser';

interface ResumeProfile {
  skills: string[];
  roles: string[];
  industry: string;
  experience_level: string;
  education_level?: string;
  currently_enrolled?: boolean;
  keywords: string[];
  location?: string;
  detected_country?: string;
}

/**
 * Use AI (Groq/Gemini) to deeply analyze the resume and extract
 * what kind of jobs this person should be searching for.
 */
async function aiExtractProfile(resumeText: string): Promise<ResumeProfile | null> {
  try {
    const prompt = `You are an expert career analyst. Analyze this resume with EXTREME care.

CRITICAL INSTRUCTION: This could be from ANY industry — sports, retail, consulting, finance, engineering, healthcare, hospitality, education, creative arts, or anything else. Do NOT default to tech/software.

STEP 1: detect the candidate's country/location with 100% accuracy.
- Signals for AUSTRALIA: Phone starts with +61 or 04xx/045xx. Postcodes like 3xxx, 2xxx. Terms: "Secondary College", "Year 11/12", "VET", "ATAR", "Casual", "Part-time".
- Signals for INDIA: Phone starts with +91. 6-digit postcodes.
- Signals for USA: Phone starts with +1. 5-digit zip codes.
- If unsure, set detected_country to "remote".

STEP 2: Extract skills that are ACTUALLY present. DOMAIN-SPECIFIC skills are 10x more important than generic soft skills.

STEP 3: Detect experience_level: "high_school", "student", "recent_graduate", or "junior".

Return exactly this JSON:
{
  "skills": [...],
  "roles": [...],
  "experience_level": "...",
  "education_level": "...",
  "currently_enrolled": true/false,
  "keywords": [...],
  "industry": "...",
  "detected_country": "..."
}`;

    const response = await callAI(
      prompt,
      ``,
      {
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 800,
        providerPriority: ['groq', 'gemini', 'openai']
      }
    );

    if (!response.success || !response.content) {
      console.error('[Search] AI profile extraction failed:', response.error);
      return null;
    }

    let raw = response.content;
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    
    const parsed = JSON.parse(raw) as ResumeProfile;
    
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
    'photoshop', 'illustrator', 'indesign', 'canva',
    'customer service', 'cash handling', 'pos', 'retail', 'sales', 'merchandising',
    'inventory management', 'stock management', 'visual merchandising',
    'sports', 'coaching', 'umpiring', 'fitness', 'recreation', 'personal training',
    'athletic', 'soccer', 'football', 'cricket', 'basketball', 'swimming',
    'hospitality', 'food service', 'front desk', 'hotel',
    'healthcare', 'nursing', 'patient care', 'first aid',
    'teaching', 'tutoring', 'education', 'classroom',
    'legal', 'law', 'paralegal', 'compliance',
    'accounting', 'bookkeeping', 'auditing',
    'photography', 'videography', 'video editing', 'graphic design',
    'data analysis', 'data entry', 'analytics',
  ];
  
  const found = allKeywords.filter(kw => {
    if (kw.length <= 2) return new RegExp(`\\b${kw}\\b`, 'i').test(resumeText);
    return lower.includes(kw);
  });
  
  const skills = [...new Set([...found, ...clientSkills])].filter(Boolean);
  
  let domain = 'general';
  if (['consulting', 'strategy', 'mckinsey', 'bain', 'bcg', 'deloitte', 'advisory'].some(k => lower.includes(k))) domain = 'consulting';
  else if (['finance', 'banking', 'investment', 'valuation', 'equity', 'accounting', 'bookkeeping'].some(k => lower.includes(k))) domain = 'finance';
  else if (['retail', 'customer service', 'cash handling', 'pos', 'shop', 'store', 'merchandising', 'sales assistant'].some(k => lower.includes(k))) domain = 'retail';
  else if (['sport', 'coaching', 'umpir', 'fitness', 'recreation', 'athletic', 'soccer', 'cricket', 'football', 'swimming', 'basketball'].some(k => lower.includes(k))) domain = 'sports';
  else if (['hospitality', 'food service', 'hotel', 'restaurant', 'barista', 'culinary', 'chef', 'front desk'].some(k => lower.includes(k))) domain = 'hospitality';
  else if (['healthcare', 'nursing', 'medical', 'patient', 'clinical', 'first aid', 'pharmacy'].some(k => lower.includes(k))) domain = 'healthcare';
  else if (['teaching', 'tutoring', 'education', 'classroom', 'curriculum'].some(k => lower.includes(k))) domain = 'education';
  else if (['legal', 'law', 'paralegal', 'compliance', 'regulatory'].some(k => lower.includes(k))) domain = 'law';
  else if (['marketing', 'seo', 'social media', 'brand', 'content creation', 'copywriting'].some(k => lower.includes(k))) domain = 'marketing';
  else if (['react', 'angular', 'node', 'python', 'javascript', 'developer', 'engineer', 'programming'].some(k => lower.includes(k))) domain = 'software_engineering';
  else if (['machine learning', 'data science', 'tensorflow', 'pytorch', 'data analysis'].some(k => lower.includes(k))) domain = 'data_science';
  else if (['photography', 'videography', 'video editing', 'graphic design', 'animation'].some(k => lower.includes(k))) domain = 'design';

  const domainRoles: Record<string, string[]> = {
    'retail': ['retail sales assistant', 'customer service representative', 'store associate'],
    'sports': ['sports retail associate', 'recreation assistant', 'customer service representative'],
    'hospitality': ['front desk agent', 'customer service representative', 'hospitality assistant'],
    'healthcare': ['healthcare assistant', 'patient care aide', 'customer service representative'],
    'education': ['teaching assistant', 'tutor', 'after school program assistant'],
    'finance': ['finance intern', 'accounting assistant', 'bookkeeping assistant'],
    'marketing': ['marketing intern', 'social media coordinator', 'content writing intern'],
    'data_science': ['data analyst intern', 'data science intern'],
    'software_engineering': ['software engineer intern', 'frontend developer', 'backend developer'],
    'consulting': ['consulting intern', 'business analyst intern'],
    'law': ['legal intern', 'paralegal assistant'],
    'design': ['design intern', 'graphic design assistant'],
    'general': ['intern', 'customer service representative', 'assistant'],
  };
  
  const roles = clientRoles.length > 0 ? clientRoles : (domainRoles[domain] || ['intern']);
  
  const domainQueries: Record<string, string[]> = {
    'retail': ['retail sales associate', 'retail customer service', 'store associate'],
    'sports': ['sports retail', 'customer service retail', 'recreation assistant'],
    'hospitality': ['customer service', 'front desk', 'hospitality staff'],
    'healthcare': ['healthcare assistant', 'patient care', 'customer service'],
    'education': ['teaching assistant', 'tutor', 'education assistant'],
    'finance': ['finance intern', 'accounting assistant', 'bookkeeping'],
    'marketing': ['marketing intern', 'social media coordinator', 'content writer'],
    'data_science': ['data analyst intern', 'data science intern'],
    'software_engineering': ['software engineer intern', 'junior developer'],
    'consulting': ['consulting intern', 'business analyst intern'],
    'law': ['legal intern', 'paralegal'],
    'design': ['design intern', 'graphic design'],
    'general': ['internship', 'customer service', 'entry level'],
  };
  
  return {
    skills,
    roles,
    industry: domain,
    experience_level: 'student',
    keywords: domainQueries[domain] || ['internship', 'entry level']
  };
}

/**
 * Maps our internal prompt profile to the StudentProfile format 
 * required by the match-engine.
 */
function mapToStudentProfile(p: ResumeProfile, userLoc: string): StudentProfile {
  return {
    name: "Candidate",
    education: {
      degree: p.education_level || "Student",
      year: p.currently_enrolled ? "Currently Enrolled" : "Completed",
      graduation_year: new Date().getFullYear() + 2,
      institution: "Detected School"
    },
    experience_level: "student_fresher",
    verified_skills: {
      languages: [],
      frameworks: [],
      tools: p.skills || [],
      ai_ml: [],
      domains: [p.industry || "general"]
    },
    projects: [],
    certifications: [],
    availability: {
      type: "part-time",
      remote_only: false,
      location: p.detected_country || userLoc || "remote"
    },
    total_effective_experience_months: 0
  };
}

function getMatchLabel(score: number): string {
  if (score >= 75) return 'Excellent Match';
  if (score >= 60) return 'Good Match';
  if (score >= 40) return 'Moderate Match';
  return 'Low Match';
}

// Domain-specific search queries for better job matching
const DOMAIN_SEARCH_QUERIES: Record<string, string[]> = {
  retail: ['retail assistant', 'customer service assistant', 'shop assistant', 'sales assistant', 'store associate', 'retail casual', 'part time retail', 'cashier'],
  sports: ['sports retail assistant', 'sports store', 'recreation assistant', 'community sports officer', 'leisure assistant', 'gym assistant', 'lifeguard'],
  hospitality: ['waiter', 'barista', 'cafe assistant', 'restaurant staff', 'hospitality casual', 'kitchen hand', 'food service'],
  trades: ['apprentice', 'trades assistant', 'labourer', 'construction assistant', 'warehouse assistant'],
  admin: ['office assistant', 'receptionist', 'admin assistant', 'data entry clerk', ' clerical assistant'],
  creative: ['content creator', 'social media assistant', 'graphic design intern', 'photography assistant', 'video editor'],
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      query = 'internship', 
      location: bodyLocation = '', 
      skills: clientSkills = [], 
      preferredRoles: clientRoles = [],
      experience: clientExperience = 'fresher',
      cacheBuster = ''
    } = body;
    
    const resumeText: string = body.resumeText || '';
    const userLocation = bodyLocation || 'remote';

    console.log('=== INTERNOS SEARCH ===');
    console.log(`[Search] Location: ${userLocation || 'Any'}`);

    let profile: ResumeProfile | null = null;

    // AI profile extraction — REQUIRED for industry detection and personalization
    profile = await aiExtractProfile(resumeText);
    
    // CRITICAL: Merge dashboard skills with AI-detected ones
    if (profile && clientSkills.length > 0) {
      profile.skills = [...new Set([...clientSkills, ...profile.skills])];
    }
    
    if (!profile) {
      console.log('[Search] AI unavailable, using keyword fallback');
      profile = fallbackExtractProfile(
        resumeText, 
        Array.isArray(clientSkills) ? clientSkills.map(String) : [],
        Array.isArray(clientRoles) ? clientRoles.map(String) : []
      );
    }

    // ═══════════════════════════════════════════════════════
    // SMART QUERY BUILDER — domain-specific, not soft-skill-based
    // ═══════════════════════════════════════════════════════
    const searchQueries: string[] = [];
    const industry = (profile.industry || '').toLowerCase();
    const skills = profile.skills || [];
    const roles = profile.roles || [];
    const keywords = profile.keywords || [];

    // 1. AI-generated roles (best quality queries)
    if (roles.length > 0) {
      roles.slice(0, 3).forEach(r => searchQueries.push(r));
    }

    // 2. AI-generated keywords  
    if (keywords.length > 0) {
      keywords.slice(0, 3).forEach(k => searchQueries.push(k));
    }

    // 3. Domain-specific fallbacks (when AI roles/keywords are empty or weak)
    if (searchQueries.length < 2) {
      const domainQueries: Record<string, string[]> = {
        'retail': ['retail associate', 'retail sales', 'store associate', 'customer service representative', 'shop assistant'],
        'sports': ['sports retail', 'fitness center', 'recreation assistant', 'sports coach', 'athletic assistant'],
        'hospitality': ['hospitality', 'front desk agent', 'restaurant staff', 'hotel associate'],
        'healthcare': ['healthcare assistant', 'patient care aide', 'medical receptionist'],
        'education': ['teaching assistant', 'tutor', 'after school program', 'education assistant'],
        'finance': ['finance intern', 'accounting assistant', 'bookkeeping'],
        'marketing': ['marketing intern', 'social media coordinator', 'content writer'],
        'data_science': ['data analyst intern', 'data science intern', 'analytics intern'],
        'software_engineering': ['software engineer intern', 'junior developer', 'frontend intern'],
        'consulting': ['consulting intern', 'business analyst intern', 'strategy analyst'],
        'law': ['legal intern', 'paralegal', 'compliance assistant'],
        'design': ['design intern', 'graphic design', 'ui ux intern'],
        'hr': ['human resources intern', 'recruiting coordinator', 'hr assistant'],
        'communications': ['communications intern', 'public relations assistant'],
        'general': ['internship', 'entry level', 'assistant'],
      };
      const queries = domainQueries[industry] || domainQueries['general'];
      queries.slice(0, 4).forEach(q => searchQueries.push(q));
    }

    // 4. Filter out soft-skill-only queries (they return garbage from job APIs)
    const softSkillOnly = /^(communication|teamwork|leadership|organisation|organization|numeracy|problem\s*solving|time\s*management|interpersonal|adaptability|critical\s*thinking|attention\s*to\s*detail|presentation|negotiation)$/i;
    const usefulQueries = searchQueries.filter(q => !softSkillOnly.test(q.trim()));

    // 5. Always ensure "internship" is in the mix for broad coverage
    if (!usefulQueries.some(q => q.toLowerCase().includes('intern'))) {
      usefulQueries.push('internship');
    }

    // Deduplicate and limit to 6 queries max (API abuse prevention)
    const uniqueQueries = [...new Set(usefulQueries)].filter(q => q.length > 2).slice(0, 6);
    console.log(`[Search] Smart queries (${uniqueQueries.length}): ${uniqueQueries.join(' | ')}`);

    console.log(`[Search] Starting fetch for: ${uniqueQueries.join(', ')}`);
    
    const allJobsMap = new Map<string, JobResult>();

    // Sequential batching with timeout check
    // Fix #2: Use detected country if available
    const searchLocation = profile.detected_country || userLocation || 'remote';
    
    for (const q of uniqueQueries) {
      try {
        const batch = await aggregateJobs(q, searchLocation);
        for (const job of batch) {
          const key = `${job.title}-${job.company}`.toLowerCase().replace(/\s+/g, '');
          if (!allJobsMap.has(key)) allJobsMap.set(key, job);
        }
        if (allJobsMap.size >= 100) break; // Hard limit for speed
      } catch (e) {
        console.error(`aggregateJobs failed for "${q}"`);
      }
    }

    const rawJobs = Array.from(allJobsMap.values());
    
    // Fix #5: Integrate the robust matching engine
    const studentProfileObj = mapToStudentProfile(profile!, userLocation);
    const jobListings: JobListing[] = rawJobs.map(j => ({
      title: j.title,
      company: j.company,
      location: j.location,
      description: j.description || "",
      requirements: [] // match-engine will parse requirements from description if needed
    }));

    const matchedResults = matchJobListings(studentProfileObj, jobListings);
    
    // Map back to our job structure
    const scoredJobs = matchedResults.map(res => {
      const original = rawJobs.find(rj => rj.title === res.title && rj.company === res.company)!;
      return { 
        ...original, 
        matchScore: res.match_score, 
        matchLabel: getMatchLabel(res.match_score) 
      };
    });

    // Fix #11 — Strict filtering: Only return jobs with at least 15% match
    const MIN_MATCH_SCORE = 15;
    const relevantJobs = scoredJobs.filter(j => (j.matchScore || 0) >= MIN_MATCH_SCORE);

    console.log(`[Search] Filtered ${scoredJobs.length - relevantJobs.length} low-score jobs (below ${MIN_MATCH_SCORE}%)`);
    
    // If we filtered too aggressively and have < 3 results, relax threshold to first 12
    const finalJobs = relevantJobs.length >= 3 
      ? relevantJobs 
      : scoredJobs.slice(0, Math.min(12, scoredJobs.length));

    console.log(`[Search] Returning ${finalJobs.length} relevant jobs (was ${scoredJobs.length})`);

    return NextResponse.json({
      success: true,
      total: finalJobs.length,
      page: 1,
      pageSize: 25,
      totalPages: Math.ceil(finalJobs.length / 25),
      detected_skills: profile.skills,
      detected_domains: [profile.industry],
      target_roles: profile.roles,
      jobs: finalJobs,
      count: finalJobs.length,
      cacheBuster
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { success: false, error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

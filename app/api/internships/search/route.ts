import { NextRequest, NextResponse } from 'next/server';
import { aggregateJobs, type JobResult } from '@/lib/aggregator';
import { callAI } from '@/lib/rotating-ai';

interface ResumeProfile {
  hard_skills: string[];
  soft_skills: string[];
  roles: string[];
  industry: string;
  experience_level: string;
  education_level?: string;
  currently_enrolled?: boolean;
  search_keywords: string[];
  location?: string;
  detected_country?: string;
}

// SOFT SKILL BLACKLIST — these must NEVER be used as search terms or for scoring
const SOFT_SKILLS = new Set([
  'communication', 'teamwork', 'leadership', 'problem solving', 'critical thinking',
  'analytical skills', 'presentation skills', 'interpersonal skills', 'time management',
  'organisation', 'organization', 'adaptability', 'creativity', 'work ethic',
  'attention to detail', 'collaboration', 'conflict resolution', 'decision making',
  'negotiation', 'multitasking', 'self-motivated', 'customer service', 'numeracy',
  'reliable', 'punctual', 'flexible', 'hardworking', 'enthusiastic', 'motivated',
  'friendly', 'professional', 'verbal communication', 'written communication',
  'active listening', 'empathy', 'patience', 'positive attitude', 'stress management',
]);

/**
 * Use AI (Groq/Gemini) to deeply analyze the resume and extract
 * what kind of jobs this person should be searching for.
 * Returns hard_skills and soft_skills SEPARATELY.
 */
async function aiExtractProfile(resumeText: string): Promise<ResumeProfile | null> {
  try {
    const prompt = `You are an expert career analyst. Analyze this resume with EXTREME care.

CRITICAL: Separate HARD skills from SOFT skills.
- Hard skills = specific, searchable abilities (Python, cash handling, POS systems, coaching, financial modeling, inventory management, first aid)
- Soft skills = generic interpersonal traits (communication, teamwork, leadership, problem-solving, time management, organisation, adaptability)

STEP 1: detect the candidate's country/location with 100% accuracy.
- Signals for AUSTRALIA: Phone starts with +61 or 04xx/045xx. Postcodes like 3xxx, 2xxx. Terms: "Secondary College", "Year 11/12", "VET", "ATAR", "Casual", "Part-time".
- Signals for INDIA: Phone starts with +91. 6-digit postcodes.
- Signals for USA: Phone starts with +1. 5-digit zip codes.
- If unsure, set detected_country to "remote".

STEP 2: Extract HARD skills that are ACTUALLY present. DOMAIN-SPECIFIC skills only. NO soft skills in this list.

STEP 3: Extract SOFT skills separately (for display only, NOT for job matching).

STEP 4: Detect experience_level: "high_school", "student", "recent_graduate", or "junior".

STEP 5: Determine the PRIMARY industry from the resume's ACTUAL content. If they worked at a soccer club and want sports retail, industry is "sports" or "retail". Do NOT default to tech/software.

STEP 6: Generate search_keywords — 3-6 search terms that would find RELEVANT jobs on job boards. Each should be 2-4 words. They must be industry-specific and role-specific. NO soft skill terms like "communication intern". A retail worker gets "retail sales assistant", "store associate", NOT "business analyst".

Return exactly this JSON:
{
  "hard_skills": [...],
  "soft_skills": [...],
  "roles": [...],
  "experience_level": "...",
  "education_level": "...",
  "currently_enrolled": true/false,
  "search_keywords": [...],
  "industry": "...",
  "detected_country": "..."
}

RULES:
1. hard_skills: ONLY specific, searchable skills. NO soft skills. Minimum 2, maximum 10.
2. soft_skills: ONLY generic interpersonal skills. Keep separate.
3. roles: Job titles this person should search for. Use THEIR industry.
4. search_keywords: Terms for job board searches. Must include industry + specific roles. NO soft skills.
5. industry: Must match the resume's ACTUAL content.
6. Return ONLY valid JSON, no explanation.`;

    const response = await callAI(
      prompt,
      resumeText,
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
    
    // Validate required fields
    if (!parsed.hard_skills || !Array.isArray(parsed.hard_skills)) return null;
    if (!parsed.search_keywords || !Array.isArray(parsed.search_keywords)) {
      parsed.search_keywords = [];
    }
    
    // Extra safety: move any soft skills that leaked into hard_skills
    const cleanHard = (parsed.hard_skills || []).filter(s => !SOFT_SKILLS.has(s.toLowerCase()));
    const leakedSoft = (parsed.hard_skills || []).filter(s => SOFT_SKILLS.has(s.toLowerCase()));
    parsed.hard_skills = cleanHard;
    parsed.soft_skills = [...new Set([...(parsed.soft_skills || []), ...leakedSoft])];
    
    console.log(`[Search] AI Profile — Industry: ${parsed.industry}`);
    console.log(`[Search] AI Profile — Hard Skills: ${(parsed.hard_skills||[]).slice(0, 8).join(', ')}`);
    console.log(`[Search] AI Profile — Soft Skills (display only): ${(parsed.soft_skills||[]).join(', ')}`);
    console.log(`[Search] AI Profile — Roles: ${(parsed.roles||[]).join(', ')}`);
    console.log(`[Search] AI Profile — Search Keywords: ${(parsed.search_keywords||[]).join(', ')}`);
    console.log(`[Search] AI Profile — Country: ${parsed.detected_country}`);
    
    return parsed;
  } catch (err: any) {
    console.error('[Search] AI profile extraction error:', err.message);
    return null;
  }
}

/**
 * Fallback: basic keyword extraction when AI is unavailable.
 * ONLY uses hard skills — soft skills are extracted separately for display.
 */
function fallbackExtractProfile(resumeText: string, clientSkills: string[], clientRoles: string[]): ResumeProfile {
  const lower = resumeText.toLowerCase();
  
  // HARD SKILLS ONLY — no soft skills in this list
  const allHardSkills = [
    // Tech
    'javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue', 'node',
    'mongodb', 'sql', 'postgresql', 'aws', 'docker', 'kubernetes', 'git',
    'html', 'css', 'figma', 'redux', 'nextjs', 'django', 'flask', 'spring',
    'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'nlp',
    // Business
    'excel', 'powerpoint', 'tableau', 'power bi', 'r', 'stata', 'spss',
    'financial modeling', 'valuation', 'consulting', 'strategy',
    // Marketing
    'seo', 'social media marketing', 'brand management', 'salesforce',
    'digital marketing', 'email marketing', 'google ads', 'facebook ads',
    // Product & Design
    'product management', 'agile', 'scrum', 'jira',
    'photoshop', 'illustrator', 'indesign', 'canva',
    // Operations
    'supply chain', 'logistics', 'operations management',
    // Retail — HARD SKILLS
    'cash handling', 'pos systems', 'point of sale', 'merchandising',
    'inventory management', 'stock management', 'visual merchandising',
    'store management', 'loss prevention', 'retail operations',
    // Sports / Fitness
    'coaching', 'umpiring', 'refereeing', 'personal training', 'fitness instruction',
    'sports management', 'athletic training', 'first aid', 'cpr',
    // Hospitality
    'food service', 'front desk', 'hotel management', 'food safety',
    'bartending', 'housekeeping', 'reservation systems',
    // Healthcare
    'patient care', 'clinical research', 'medical records', 'nursing',
    // Education
    'lesson planning', 'curriculum development', 'classroom management', 'tutoring',
    // Legal
    'legal research', 'compliance', 'contract negotiation', 'paralegal',
    // Accounting
    'accounting', 'bookkeeping', 'auditing', 'tax preparation', 'quickbooks', 'xero',
    // Creative
    'photography', 'videography', 'video editing', 'graphic design', 'animation',
    'content writing', 'journalism', 'copywriting',
    // Data
    'data analysis', 'data entry', 'analytics', 'reporting',
  ];
  
  const foundHardSkills = allHardSkills.filter(kw => {
    if (kw.length <= 2) return new RegExp(`\\b${kw}\\b`, 'i').test(resumeText);
    return lower.includes(kw);
  });
  
  // Separate client skills into hard and soft
  const clientHard = clientSkills.filter(s => !SOFT_SKILLS.has(s.toLowerCase()));
  const clientSoft = clientSkills.filter(s => SOFT_SKILLS.has(s.toLowerCase()));
  
  const hardSkills = [...new Set([...foundHardSkills, ...clientHard])].filter(Boolean);
  
  // Also detect soft skills present in the resume (for display only)
  const softSkillList = ['communication', 'teamwork', 'leadership', 'problem solving',
    'time management', 'organisation', 'organization', 'adaptability', 'numeracy',
    'customer service', 'interpersonal', 'critical thinking', 'presentation'];
  const foundSoftSkills = softSkillList.filter(s => lower.includes(s));
  const softSkills = [...new Set([...foundSoftSkills, ...clientSoft])];
  
  // Detect domain — ordered by specificity
  let domain = 'general';
  if (['consulting', 'strategy', 'mckinsey', 'bain', 'bcg', 'deloitte', 'advisory'].some(k => lower.includes(k))) domain = 'consulting';
  else if (['finance', 'banking', 'investment', 'valuation', 'equity', 'accounting', 'bookkeeping'].some(k => lower.includes(k))) domain = 'finance';
  else if (['retail', 'cash handling', 'pos', 'shop', 'store', 'merchandising', 'sales assistant'].some(k => lower.includes(k))) domain = 'retail';
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
    'retail': ['retail sales assistant', 'store associate', 'customer service representative'],
    'sports': ['sports retail associate', 'recreation assistant', 'fitness attendant'],
    'hospitality': ['front desk agent', 'hospitality assistant', 'restaurant server'],
    'healthcare': ['healthcare assistant', 'patient care aide', 'medical receptionist'],
    'education': ['teaching assistant', 'tutor', 'after school program assistant'],
    'finance': ['finance intern', 'accounting assistant', 'bookkeeping assistant'],
    'marketing': ['marketing intern', 'social media coordinator', 'content writing intern'],
    'data_science': ['data analyst intern', 'data science intern'],
    'software_engineering': ['software engineer intern', 'frontend developer', 'backend developer'],
    'consulting': ['consulting intern', 'business analyst intern'],
    'law': ['legal intern', 'paralegal assistant'],
    'design': ['design intern', 'graphic design assistant'],
    'general': ['intern', 'assistant', 'entry level associate'],
  };
  
  const roles = clientRoles.length > 0 ? clientRoles : (domainRoles[domain] || ['intern']);
  
  const domainQueries: Record<string, string[]> = {
    'retail': ['retail sales associate', 'retail customer service', 'store associate', 'shop assistant'],
    'sports': ['sports retail', 'recreation assistant', 'fitness attendant', 'gym assistant'],
    'hospitality': ['front desk agent', 'hospitality staff', 'restaurant server'],
    'healthcare': ['healthcare assistant', 'patient care', 'medical receptionist'],
    'education': ['teaching assistant', 'tutor', 'education assistant'],
    'finance': ['finance intern', 'accounting assistant', 'bookkeeping'],
    'marketing': ['marketing intern', 'social media coordinator', 'content writer'],
    'data_science': ['data analyst intern', 'data science intern'],
    'software_engineering': ['software engineer intern', 'junior developer'],
    'consulting': ['consulting intern', 'business analyst intern'],
    'law': ['legal intern', 'paralegal'],
    'design': ['design intern', 'graphic design'],
    'general': ['internship', 'entry level', 'assistant'],
  };
  
  return {
    hard_skills: hardSkills,
    soft_skills: softSkills,
    roles,
    industry: domain,
    experience_level: 'student',
    search_keywords: domainQueries[domain] || ['internship', 'entry level']
  };
}

function getMatchLabel(score: number): string {
  if (score >= 75) return 'Excellent Match';
  if (score >= 60) return 'Good Match';
  if (score >= 40) return 'Moderate Match';
  return 'Low Match';
}

/**
 * Scores a job against the user's profile using ONLY hard skills.
 * Soft skills are completely excluded from scoring — they match everything.
 */
function scoreJob(job: JobResult, profile: ResumeProfile): number {
  let score = 0;
  const jobTitle = (job.title || '').toLowerCase();
  const jobDesc = (job.description || '').toLowerCase();
  const jobText = `${jobTitle} ${jobDesc}`;

  // IMPORTANT: Only use hard_skills for scoring
  const userHardSkills = profile.hard_skills || [];
  const normalizedHardSkills = userHardSkills.map(s => s.toLowerCase());
  
  const skillsMatched = normalizedHardSkills.filter(skill => {
    const skillWords = skill.split(/\s+/);
    return skillWords.every(word => jobText.includes(word));
  });
  
  // 40% — Hard skill match (only hard skills, never soft)
  const skillScore = normalizedHardSkills.length > 0
    ? (skillsMatched.length / normalizedHardSkills.length) * 40
    : 0;
  score += skillScore;

  // 25% — Role/title match
  const userRoles = profile.roles || [];
  const normalizedRoles = userRoles.map(r => r.toLowerCase());
  const rolesMatched = normalizedRoles.filter(role => {
    const roleWords = role.split(/\s+/);
    return roleWords.some(word => word.length > 3 && jobTitle.includes(word));
  });
  const roleScore = userRoles.length > 0
    ? (rolesMatched.length / normalizedRoles.length) * 25
    : 0;
  score += roleScore;

  // 20% — Industry match in job text
  const industry = (profile.industry || '').replace(/_/g, ' ').toLowerCase();
  if (industry && industry !== 'general') {
    if (jobTitle.includes(industry) || jobText.includes(industry)) {
      score += 20;
    } else {
      // Partial industry match — check industry-related keywords
      const industryKeywords: Record<string, string[]> = {
        'retail': ['store', 'shop', 'sales', 'cashier', 'merchandise', 'customer'],
        'sports': ['sport', 'fitness', 'gym', 'athletic', 'recreation', 'coach'],
        'hospitality': ['hotel', 'restaurant', 'food', 'hospitality', 'barista', 'server'],
        'healthcare': ['health', 'medical', 'patient', 'clinical', 'nurse'],
        'education': ['teach', 'tutor', 'school', 'education', 'instructor'],
        'finance': ['finance', 'accounting', 'bank', 'investment', 'audit'],
        'marketing': ['marketing', 'social media', 'content', 'seo', 'brand'],
        'software engineering': ['software', 'developer', 'engineer', 'frontend', 'backend'],
        'data science': ['data', 'analyst', 'machine learning', 'statistics'],
      };
      const relatedKeywords = industryKeywords[industry] || [];
      if (relatedKeywords.some(kw => jobTitle.includes(kw))) {
        score += 15;
      } else if (relatedKeywords.some(kw => jobText.includes(kw))) {
        score += 8;
      }
    }
  }

  // 15% — Experience level + role-type bonus (ONLY if some skills or roles matched)
  const hasSomeMatch = skillsMatched.length > 0 || rolesMatched.length > 0;
  
  if (hasSomeMatch) {
    if (jobTitle.includes('intern') || jobTitle.includes('entry') || jobTitle.includes('trainee') || jobTitle.includes('junior') || jobTitle.includes('assistant') || jobTitle.includes('associate')) {
      score += 10;
    }
    const expLevel = (profile.experience_level || '').toLowerCase();
    if (expLevel && (expLevel === 'student' || expLevel === 'high_school')) {
      // Bonus for part-time / casual roles
      if (jobText.includes('part-time') || jobText.includes('casual') || jobText.includes('part time')) {
        score += 5;
      }
    }
  }

  // Senior penalties — penalize overqualified jobs HARD
  const seniorKw = ['senior', 'sr.', 'sr ', 'lead', 'manager', 'director', 'vp', 'chief', 'staff', 'principal', 'architect', 'head of'];
  if (seniorKw.some(k => jobTitle.includes(k))) score -= 30;

  // Experience requirement penalty
  const expMatch = jobText.match(/(\d+)\+?\s*years?\s*(of\s*)?(experience|exp)/i);
  if (expMatch) {
    const yearsRequired = parseInt(expMatch[1]);
    if (yearsRequired >= 3) score -= 20;
    else if (yearsRequired >= 2) score -= 10;
  }

  // Industry mismatch penalty: if job is clearly from a completely different industry
  if (industry && industry !== 'general') {
    const nonTechIndustries = ['retail', 'hospitality', 'sports', 'education', 'healthcare'];
    const techJobKw = ['software engineer', 'fullstack developer', 'frontend developer', 'backend developer', 'devops engineer', 'site reliability', 'sre'];
    if (nonTechIndustries.includes(profile.industry) && techJobKw.some(k => jobTitle.includes(k))) score -= 25;
    
    // Reverse: tech person getting retail jobs
    const techIndustries = ['software_engineering', 'data_science'];
    const nonTechJobKw = ['store clerk', 'cashier', 'waiter', 'dishwasher'];
    if (techIndustries.includes(profile.industry) && nonTechJobKw.some(k => jobTitle.includes(k))) score -= 25;
  }

  return Math.max(0, Math.min(Math.round(score), 100));
}

// Domain-specific search queries for better job matching
const DOMAIN_SEARCH_QUERIES: Record<string, string[]> = {
  retail: ['retail assistant', 'customer service assistant', 'shop assistant', 'sales assistant', 'store associate', 'retail casual', 'part time retail', 'cashier'],
  sports: ['sports retail assistant', 'sports store', 'recreation assistant', 'community sports officer', 'leisure assistant', 'gym assistant', 'lifeguard'],
  hospitality: ['waiter', 'barista', 'cafe assistant', 'restaurant staff', 'hospitality casual', 'kitchen hand', 'food service'],
  trades: ['apprentice', 'trades assistant', 'labourer', 'construction assistant', 'warehouse assistant'],
  admin: ['office assistant', 'receptionist', 'admin assistant', 'data entry clerk', 'clerical assistant'],
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
    
    // CRITICAL: Merge dashboard hard skills with AI-detected ones (filter out soft skills)
    if (profile && clientSkills.length > 0) {
      const clientHard = clientSkills.filter((s: string) => !SOFT_SKILLS.has(s.toLowerCase()));
      const clientSoft = clientSkills.filter((s: string) => SOFT_SKILLS.has(s.toLowerCase()));
      profile.hard_skills = [...new Set([...clientHard, ...profile.hard_skills])];
      profile.soft_skills = [...new Set([...clientSoft, ...profile.soft_skills])];
    }
    
    if (!profile) {
      console.log('[Search] AI unavailable, using keyword fallback');
      profile = fallbackExtractProfile(
        resumeText, 
        Array.isArray(clientSkills) ? clientSkills.map(String) : [],
        Array.isArray(clientRoles) ? clientRoles.map(String) : []
      );
    }

    console.log(`[Search] Final profile — Industry: ${profile.industry}`);
    console.log(`[Search] Hard skills (${(profile.hard_skills||[]).length}): ${(profile.hard_skills||[]).slice(0, 10).join(', ')}`);
    console.log(`[Search] Soft skills (${(profile.soft_skills||[]).length}): ${(profile.soft_skills||[]).join(', ')}`);

    // ═══════════════════════════════════════════════════════
    // SMART QUERY BUILDER — uses hard skills + roles + keywords, NOT soft skills
    // ═══════════════════════════════════════════════════════
    const searchQueries: string[] = [];
    const industry = (profile.industry || '').toLowerCase();
    const roles = profile.roles || [];
    const searchKeywords = profile.search_keywords || [];

    // 1. AI-generated search_keywords (best quality queries)
    if (searchKeywords.length > 0) {
      searchKeywords.slice(0, 3).forEach(k => searchQueries.push(k));
    }

    // 2. AI-generated roles
    if (roles.length > 0) {
      roles.slice(0, 2).forEach(r => searchQueries.push(r));
    }

    // 3. Domain-specific fallbacks (when AI queries are empty or weak)
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
    const softSkillOnly = /^(communication|teamwork|leadership|organisation|organization|numeracy|problem\s*solving|time\s*management|interpersonal|adaptability|critical\s*thinking|attention\s*to\s*detail|presentation|negotiation|customer\s*service)$/i;
    const usefulQueries = searchQueries.filter(q => !softSkillOnly.test(q.trim()));

    // 5. Always ensure "internship" is in the mix for broad coverage
    if (!usefulQueries.some(q => q.toLowerCase().includes('intern'))) {
      usefulQueries.push('internship');
    }

    // Deduplicate and limit to 6 queries max
    const uniqueQueries = [...new Set(usefulQueries)].filter(q => q.length > 2).slice(0, 6);
    console.log(`[Search] Smart queries (${uniqueQueries.length}): ${uniqueQueries.join(' | ')}`);

    console.log(`[Search] Starting fetch for: ${uniqueQueries.join(', ')}`);
    
    const allJobsMap = new Map<string, JobResult>();

    // Use detected country for location-aware searches
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
    
    // Score every job using ONLY hard skills (not soft skills)
    const scoredJobs = rawJobs.map(job => {
      const matchScore = scoreJob(job, profile!);
      return {
        ...job,
        matchScore,
        matchLabel: getMatchLabel(matchScore)
      };
    });

    // Sort by score descending
    scoredJobs.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    // Strict filtering: Only return jobs with at least 10% match
    const MIN_MATCH_SCORE = 10;
    const relevantJobs = scoredJobs.filter(j => (j.matchScore || 0) >= MIN_MATCH_SCORE);

    console.log(`[Search] Scored ${scoredJobs.length} jobs, ${relevantJobs.length} above ${MIN_MATCH_SCORE}% threshold`);
    
    // If we filtered too aggressively and have < 3 results, relax threshold
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
      detected_skills: [...(profile.hard_skills || []), ...(profile.soft_skills || [])],
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

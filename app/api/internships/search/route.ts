import { NextRequest, NextResponse } from 'next/server';
import { aggregateJobs, type JobResult } from '@/lib/aggregator';
import { callAI } from '@/lib/rotating-ai';

// ══════════════════════════════════════════════════════
// AI-POWERED RESUME -> JOB MATCHING PIPELINE
//
// Flow:
// 1. AI reads resume -> extracts skills, roles, industry, search keywords
// 2. Build search queries from AI output
// 3. Fetch jobs from aggregator using those queries
// 4. Score each job against AI-extracted profile
// ══════════════════════════════════════════════════════

interface ResumeProfile {
  hard_skills: string[];
  soft_skills: string[];
  roles: string[];
  industry: string;
  experience_level: string;
  search_keywords: string[];
}

/**
 * Remove template "Tip:" paragraphs and other non-resume noise.
 */
function cleanResumeText(text: string): string {
  return text
    .replace(/\(Tip:[\s\S]*?\)/g, '')
    .replace(/^Tip:.*$/gm, '')
    .replace(/^Page \d+$/gm, '')
    .replace(/^((?:Resume|CV|Curriculum Vitae)\s*)$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Use AI (Groq/Gemini) to deeply analyze the resume and extract
 * what kind of jobs this person should search for.
 */
async function aiExtractProfile(resumeText: string): Promise<ResumeProfile | null> {
  try {
    const cleanedText = cleanResumeText(resumeText);
    if (cleanedText.length < 50) {
      console.log('[Search] Resume too short after cleaning');
      return null;
    }

    const prompt = `You are a career analysis engine. Your ONLY job is to read a resume and determine what jobs this person should search for.

You will see a resume. It could be from ANY field — retail, healthcare, engineering, arts, finance, sports, hospitality, law, education, science, trades, government, non-profit, or anything else. Do NOT assume any default industry.

Analyze the resume and return JSON with EXACTLY these fields:

{
  "hard_skills": ["list of specific, searchable skills found in the resume"],
  "soft_skills": ["list of generic interpersonal skills found in the resume"],
  "roles": ["list of 3-5 job titles this person should search for"],
  "industry": "primary industry from their actual work experience",
  "experience_level": "fresher or junior or mid or senior",
  "search_keywords": ["list of 4-6 search phrases to type into a job board"]
}

RULES FOR EACH FIELD:

1. hard_skills — ONLY specific, searchable abilities. Examples: "Python", "financial modeling", "SEO", "inventory management", "AutoCAD", "patient care", "lesson planning", "cash handling", "operating cash register". NEVER include generic traits like "communication" or "leadership" here. For entry-level workers with no technical skills, include basic abilities like "cash handling", "basic math", "Microsoft Office".

2. soft_skills — Generic interpersonal traits for display only. Examples: "communication", "teamwork", "leadership", "problem-solving". These are NOT used for job matching.

3. roles — Job titles this person would realistically apply for. Base this on their WORK EXPERIENCE and EDUCATION, not just their skills. A retail worker gets "retail sales assistant", "store supervisor". A nursing student gets "registered nurse", "clinical assistant". Include 3-5 roles ordered by relevance.

4. industry — The ONE industry that best describes their work experience. Look at WHERE they worked, not just what they studied. Someone who worked at a grocery store is in "retail". Someone who worked at a clipboard is in "sports and recreation". Keep it to a short phrase.

5. search_keywords — Phrases you would actually type into Indeed or LinkedIn job search. These should combine industry + role + skill. NEVER use soft skills as search terms. ALWAYS use 2-4 word phrases. Include 4-6 keywords. Examples: ["retail sales assistant", "sports store associate", "customer service representative"], ["software engineering internship", "full stack developer intern"].

6. MOST IMPORTANT: Read the resume holistically. Look at job titles, company names, project descriptions, education, extracurriculars, AND career objective TOGETHER to determine what this person does.

7. If the resume has a "Career Objective" or "Objective" section, READ IT CAREFULLY. It usually states exactly what kind of job the person wants. Use that information for roles, industry, and search_keywords.

8. NO-HARD-SKILL HANDLING: If the person is a student with no technical skills, do NOT leave hard_skills empty. Put whatever specific abilities they mention — "cash handling", "operating cash register", "serving customers", "basic math" are all valid hard skills for an entry-level worker.

Return ONLY valid JSON. No explanation.`;

    const response = await callAI(
      prompt,
      cleanedText.slice(0, 4000),
      {
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 800,
        providerPriority: ['groq', 'gemini', 'openai']
      }
    );

    if (!response.success || !response.content) {
      console.log('[Search] AI profile extraction failed:', response.error);
      return null;
    }

    let raw = response.content;
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

    const parsed = JSON.parse(raw) as ResumeProfile;

    if (!parsed.hard_skills || !Array.isArray(parsed.hard_skills)) return null;
    if (!parsed.search_keywords || !Array.isArray(parsed.search_keywords)) return null;

    console.log(`[Search] AI SUCCESS — Industry: ${parsed.industry}`);
    console.log(`[Search] Hard Skills: ${(parsed.hard_skills||[]).slice(0,8).join(', ')}`);
    console.log(`[Search] Soft Skills: ${(parsed.soft_skills||[]).join(', ')}`);
    console.log(`[Search] Roles: ${(parsed.roles||[]).join(', ')}`);
    console.log(`[Search] Keywords: ${(parsed.search_keywords||[]).join(', ')}`);

    return parsed;
  } catch (err: any) {
    console.log('[Search] AI extraction error:', err.message);
    return null;
  }
}

/**
 * Minimal fallback when AI is unavailable.
 */
function fallbackExtractProfile(
  _resumeText: string,
  clientSkills: string[],
  clientRoles: string[]
): ResumeProfile {
  const SOFT = new Set([
    'communication', 'teamwork', 'leadership', 'problem solving', 'critical thinking',
    'analytical skills', 'presentation skills', 'interpersonal skills', 'time management',
    'organisation', 'organization', 'adaptability', 'creativity', 'work ethic',
    'attention to detail', 'collaboration', 'customer service', 'numeracy',
    'reliable', 'punctual', 'flexible', 'hardworking', 'motivated',
    'verbal communication', 'written communication', 'active listening',
  ]);

  const hardSkills = (clientSkills || []).filter(
    (s: string) => s && !SOFT.has(s.toLowerCase())
  );

  const softSkills = (clientSkills || []).filter(
    (s: string) => s && SOFT.has(s.toLowerCase())
  );

  const searchKeywords: string[] = [];
  if (clientRoles.length > 0) {
    clientRoles.slice(0, 3).forEach(r => searchKeywords.push(String(r)));
  }
  hardSkills.slice(0, 3).forEach(s => searchKeywords.push(`${s} internship`));
  if (searchKeywords.length === 0) {
    searchKeywords.push('internship');
  }

  return {
    hard_skills: hardSkills,
    soft_skills: softSkills,
    roles: (clientRoles || []).map(String).slice(0, 5),
    industry: 'general',
    experience_level: 'student',
    search_keywords: [...new Set(searchKeywords)].slice(0, 5),
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

  // 50%: Hard skill overlap
  const userHardSkills = (profile.hard_skills || []).map(s => s.toLowerCase());
  const skillsMatched = userHardSkills.filter(skill => {
    const words = skill.split(/\s+/);
    return words.every(w => jobText.includes(w));
  });
  const skillScore = userHardSkills.length > 0
    ? (skillsMatched.length / userHardSkills.length) * 50 : 0;
  score += skillScore;

  // 25%: Role/title match
  const userRoles = (profile.roles || []).map(r => r.toLowerCase());
  const rolesMatched = userRoles.filter(role => {
    const words = role.split(/\s+/);
    return words.some(w => jobTitle.includes(w));
  });
  const roleScore = userRoles.length > 0
    ? (rolesMatched.length / userRoles.length) * 25 : 0;
  score += roleScore;

  // 10%: Industry keyword presence
  const industry = (profile.industry || '').replace(/_/g, ' ').toLowerCase();
  if (industry && industry !== 'general') {
    const industryWords = industry.split(/\s+/);
    if (industryWords.some(w => jobText.includes(w))) {
      score += 10;
    }
  }

  // 15%: Junior/intern bonus (only if something matched)
  if (skillsMatched.length > 0 || rolesMatched.length > 0) {
    if (/intern|entry|trainee|junior|graduate|fresher/.test(jobTitle)) {
      score += 10;
    } else {
      score += 5;
    }
  }

  // Penalties
  if (/senior|sr\.|sr |lead |manager|director|vp |chief|staff |principal|architect|head of/.test(jobTitle)) {
    score -= 30;
  }

  if (skillsMatched.length === 0 && rolesMatched.length === 0) {
    score -= 20;
  }

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
      query = 'internship',
      location: bodyLocation = '',
      skills: clientSkills = [],
      preferredRoles: clientRoles = [],
    } = body;

    const resumeText: string = body.resumeText || '';
    const userLocation = bodyLocation || 'India';

    console.log('[Search] === START ===');

    // STEP 1: Run AI extraction AND first batch of jobs IN PARALLEL
    const aiPromise = (async () => {
      if (resumeText && resumeText.length > 50) {
        return await aiExtractProfile(resumeText);
      }
      return null;
    })();

    const initialQuery = (Array.isArray(clientRoles) && clientRoles.length > 0 && clientRoles[0])
      ? String(clientRoles[0])
      : (Array.isArray(clientSkills) && clientSkills.length > 0 && clientSkills[0])
        ? String(clientSkills[0])
        : query;
    const initialJobsPromise = aggregateJobs(initialQuery, userLocation);

    const [aiProfile, initialJobs] = await Promise.all([aiPromise, initialJobsPromise]);

    let profile: ResumeProfile | null = aiProfile;

    if (!profile) {
      console.log('[Search] AI unavailable, using minimal fallback');
      profile = fallbackExtractProfile(
        resumeText,
        Array.isArray(clientSkills) ? clientSkills.map(String) : [],
        Array.isArray(clientRoles) ? clientRoles.map(String) : []
      );
    }

    console.log(`[Search] Final profile — Industry: ${profile.industry}`);
    console.log(`[Search] Hard skills (${(profile.hard_skills||[]).length}): ${(profile.hard_skills||[]).slice(0, 10).join(', ')}`);
    console.log(`[Search] Soft skills (${(profile.soft_skills||[]).length}): ${(profile.soft_skills||[]).join(', ')}`);

    // STEP 2: Build targeted queries from AI profile
    const searchQueries: string[] = [];

    if (profile.search_keywords && profile.search_keywords.length > 0) {
      searchQueries.push(...profile.search_keywords.slice(0, 4));
    }
    if (profile.roles && profile.roles.length > 0) {
      searchQueries.push(...profile.roles.slice(0, 2));
    }
    if (profile.hard_skills && profile.hard_skills.length > 0) {
      searchQueries.push(
        ...profile.hard_skills.slice(0, 2).map(s => `${s} internship`)
      );
    }

    // CRITICAL: Limit to 2 queries to avoid Vercel timeout
    let uniqueQueries = [...new Set(searchQueries)].slice(0, 2);

    const hasInternshipQuery = uniqueQueries.some(q =>
      /internship|job|role|assistant|position|associate/.test(q.toLowerCase())
    );
    if (!hasInternshipQuery && uniqueQueries.length > 0) {
      uniqueQueries.push(uniqueQueries[0] + ' internship');
    }
    if (uniqueQueries.length === 0) {
      uniqueQueries.push('internship');
    }

    console.log(`[Search] Queries: ${uniqueQueries.join(' | ')}`);

    // STEP 3: Fetch additional jobs for remaining queries (ALL IN PARALLEL)
    const additionalPromises = uniqueQueries
      .filter(q => q.toLowerCase() !== initialQuery.toLowerCase())
      .map(q => aggregateJobs(q, userLocation));

    console.log(`[Search] Fetching ${additionalPromises.length} additional query batches...`);
    const additionalResults = await Promise.all(additionalPromises);

    // STEP 4: Combine, deduplicate, score, filter
    const allJobsMap = new Map<string, JobResult>();

    for (const job of initialJobs) {
      const key = `${job.title}-${job.company}`.toLowerCase().replace(/\s+/g, '');
      if (!allJobsMap.has(key)) allJobsMap.set(key, job);
    }

    for (const batch of additionalResults) {
      for (const job of batch) {
        const key = `${job.title}-${job.company}`.toLowerCase().replace(/\s+/g, '');
        if (!allJobsMap.has(key)) allJobsMap.set(key, job);
      }
    }

    const rawJobs = Array.from(allJobsMap.values());
    console.log(`[Search] Total unique jobs fetched: ${rawJobs.length}`);

    // Score every job
    const scoredJobs = rawJobs.map(job => {
      const matchScore = scoreJob(job, profile!);
      return { ...job, matchScore, matchLabel: getMatchLabel(matchScore) };
    });

    // Sort by score descending
    const sorted = scoredJobs.sort((a, b) => b.matchScore - a.matchScore);

    // Filter: minimum 20% relevance + location preference
    const goodMatches = sorted.filter(job => {
      if (job.matchScore < 20) return false;
      const jobLoc = (job.location || '').toLowerCase();
      const userLoc = (userLocation || 'india').toLowerCase();
      if (jobLoc.includes('remote') || jobLoc.includes('anywhere') || jobLoc.includes('wfh')) {
        return job.matchScore >= 25;
      }
      if (jobLoc.includes(userLoc)) return true;
      if (userLoc.includes('india') && (
        jobLoc.includes('india') || jobLoc.includes('bangalore') || jobLoc.includes('bengaluru') ||
        jobLoc.includes('mumbai') || jobLoc.includes('delhi') || jobLoc.includes('pune') ||
        jobLoc.includes('chennai') || jobLoc.includes('hyderabad') || jobLoc.includes('noida') ||
        jobLoc.includes('gurgaon') || jobLoc.includes('kolkata')
      )) return true;
      return job.matchScore >= 50;
    });

    // FALLBACK: If fewer than 5 good matches, show top 20 anyway
    const finalJobs = goodMatches.length >= 5
      ? goodMatches.slice(0, 50)
      : sorted.slice(0, 20);

    const usingFallback = goodMatches.length < 5;
    console.log(`[Search] Good matches: ${goodMatches.length} | Using fallback: ${usingFallback} | Returning: ${finalJobs.length} (top: ${finalJobs[0]?.matchScore || 0}%)`);
    console.log('[Search] === END ===');

    return NextResponse.json({
      success: true,
      total: finalJobs.length,
      detected_skills: [...(profile.hard_skills || []), ...(profile.soft_skills || [])],
      detected_domains: [profile.industry],
      target_roles: profile.roles,
      jobs: finalJobs,
      count: finalJobs.length
    });

  } catch (error) {
    console.log('Search error:', error);
    return NextResponse.json(
      { success: false, error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

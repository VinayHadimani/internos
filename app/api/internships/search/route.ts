import { NextRequest, NextResponse } from 'next/server';
import { aggregateJobs, type JobResult } from '@/lib/aggregator';
import { callAI } from '@/lib/rotating-ai';

interface ResumeProfile {
  hard_skills: string[];
  soft_skills: string[];
  roles: string[];
  industry: string;
  experience_level: string;
  search_keywords: string[];
}

function cleanResumeText(text: string): string {
  return text
    .replace(/\(Tip:[\s\S]*?\)/g, '')
    .replace(/^Tip:.*$/gm, '')
    .replace(/^Page \d+$/gm, '')
    .replace(/^((?:Resume|CV|Curriculum Vitae)\s*)$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ──────────────────────────────────────────────────
// STEP 1: AI reads the resume and decides what to search for
// NO hardcoded domains. NO hardcoded keywords. AI decides everything.
// ──────────────────────────────────────────────────

async function aiExtractProfile(resumeText: string): Promise<ResumeProfile | null> {
  try {
    const cleanedText = cleanResumeText(resumeText);
    if (cleanedText.length < 50) return null;

    const prompt = `You are a job search engine. Read this resume and figure out exactly what jobs this person should find.

This resume could be from ANY career — retail, healthcare, engineering, finance, arts, sports, hospitality, law, education, trades, government, anything.

Return ONLY valid JSON:
{
  "hard_skills": ["every specific skill found — technical abilities, tools, software, equipment, certifications. For entry-level: cash handling, basic math, Microsoft Office are valid"],
  "soft_skills": ["communication, teamwork, leadership etc — display only, NOT used for matching"],
  "roles": ["3-5 realistic job titles this person would apply for, based on their actual experience and education"],
  "industry": "the ONE industry that best describes their work",
  "experience_level": "fresher or junior or mid or senior",
  "search_keywords": ["5-8 EXACT phrases you would type into Indeed or LinkedIn job search. Combine role + skill + level. Examples: retail sales assistant, java developer internship, management consultant entry level, store cashier part time, financial analyst graduate"]
}

RULES:
- If there is a Career Objective or Professional Summary, read it FIRST — it says what they want.
- hard_skills = specific searchable abilities. NOT generic traits.
- soft_skills = generic interpersonal traits. SEPARATE from hard_skills.
- roles = what they can realistically apply for based on experience + education.
- search_keywords = the most important field. These drive the actual job search. Make them specific and realistic. NEVER include soft skills. NEVER be generic like "internship" or "job". Always combine role with skill or industry.`;

    const response = await callAI(prompt, cleanedText.slice(0, 4000), {
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 800,
      providerPriority: ['groq', 'gemini', 'openai']
    });

    if (!response.success || !response.content) return null;

    let raw = response.content;
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const parsed = JSON.parse(raw) as ResumeProfile;

    // Validate — must have at least roles and search_keywords
    if (!parsed.hard_skills || !Array.isArray(parsed.hard_skills)) return null;
    if (!parsed.roles || !Array.isArray(parsed.roles)) return null;
    if (!parsed.search_keywords || !Array.isArray(parsed.search_keywords)) return null;

    console.log(`[Search] AI extracted — Industry: ${parsed.industry}, Level: ${parsed.experience_level}`);
    console.log(`[Search] Hard Skills: ${parsed.hard_skills.join(', ')}`);
    console.log(`[Search] Roles: ${parsed.roles.join(', ')}`);
    console.log(`[Search] Search Keywords: ${parsed.search_keywords.join(', ')}`);

    return parsed;
  } catch (err: any) {
    console.error('[Search] AI extraction error:', err.message);
    return null;
  }
}

// Minimal fallback — only used if AI completely fails
function fallbackExtractProfile(clientSkills: string[], clientRoles: string[]): ResumeProfile {
  const SOFT = new Set([
    'communication', 'teamwork', 'leadership', 'problem solving', 'critical thinking',
    'analytical skills', 'presentation skills', 'time management', 'adaptability',
    'creativity', 'work ethic', 'attention to detail', 'collaboration', 'customer service',
  ]);
  const hardSkills = (clientSkills || []).filter((s: string) => s && !SOFT.has(s.toLowerCase())).map(String);
  return {
    hard_skills: hardSkills,
    soft_skills: [],
    roles: (clientRoles || []).map(String).slice(0, 5),
    industry: 'general',
    experience_level: 'student',
    search_keywords: [
      ...(clientRoles || []).slice(0, 2).map(String),
      ...hardSkills.slice(0, 2).map(s => `${s} internship`),
    ],
  };
}

// ──────────────────────────────────────────────────
// STEP 2: Score each job against the profile
// STRICT: if nothing matches, score = 0. No free points.
// ──────────────────────────────────────────────────

function scoreJob(job: JobResult, profile: ResumeProfile): number {
  const jobTitle = (job.title || '').toLowerCase();
  const jobDesc = (job.description || '').toLowerCase();
  const jobText = `${jobTitle} ${jobDesc}`;

  // Count how many of the user's hard skills appear in this job
  const userHardSkills = (profile.hard_skills || []).map(s => s.toLowerCase());
  let hardSkillMatches = 0;
  for (const skill of userHardSkills) {
    const words = skill.split(/\s+/);
    if (words.every(w => jobText.includes(w))) {
      hardSkillMatches++;
    }
  }

  // Count how many of the user's target roles match this job title
  const userRoles = (profile.roles || []).map(r => r.toLowerCase());
  let roleMatches = 0;
  for (const role of userRoles) {
    const words = role.split(/\s+/);
    if (words.some(w => w.length > 3 && jobTitle.includes(w))) {
      roleMatches++;
    }
  }

  // ═══ THE KEY FIX ═══
  // If ZERO skills AND ZERO roles match → this job is IRRELEVANT → score = 0
  // No "junior bonus". No partial credit. Zero means zero.
  if (hardSkillMatches === 0 && roleMatches === 0) return 0;

  let score = 0;

  // Hard skills: 15 points per matching skill, max 50
  score += Math.min(50, hardSkillMatches * 15);

  // Roles: 20 points per matching role, max 30
  score += Math.min(30, roleMatches * 20);

  // Industry: 10 bonus points if industry word found anywhere in job
  const industry = (profile.industry || '').toLowerCase();
  if (industry && industry !== 'general') {
    const industryWords = industry.split(/\s+/);
    if (industryWords.some(w => w.length > 3 && jobText.includes(w))) {
      score += 10;
    }
  }

  // Experience level bonus: only if SOMETHING already matched
  const isEntry = ['fresher', 'entry', 'junior', 'student'].includes(profile.experience_level);
  if (isEntry && /intern|entry|trainee|junior|graduate|fresher|student/.test(jobTitle)) {
    score += 10;
  }

  // Senior penalty for entry-level users
  if (isEntry && /senior|sr\.|sr |lead |principal|architect|staff |vp |director|head of/.test(jobTitle)) {
    score -= 25;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getMatchLabel(score: number): string {
  if (score >= 75) return 'Excellent Match';
  if (score >= 55) return 'Good Match';
  if (score >= 35) return 'Moderate Match';
  return 'Partial Match';
}

// ──────────────────────────────────────────────────
// STEP 3: Main handler — tie it all together
// ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      location: bodyLocation = '',
      skills: clientSkills = [],
      preferredRoles: clientRoles = [],
    } = body;
    const resumeText: string = body.resumeText || '';
    const userLocation = bodyLocation || '';

    console.log('=== INTERNOS SEARCH ===');

    // ── AI Profile Extraction ──
    const aiProfile = resumeText.length > 50 ? await aiExtractProfile(resumeText) : null;
    const profile: ResumeProfile = aiProfile || fallbackExtractProfile(
      Array.isArray(clientSkills) ? clientSkills.map(String) : [],
      Array.isArray(clientRoles) ? clientRoles.map(String) : []
    );

    console.log(`[Search] Using profile — Industry: ${profile.industry}, Hard skills: ${profile.hard_skills.length}, Roles: ${profile.roles.length}`);

    // ── Build Search Queries from AI output ──
    // Use AI's search_keywords as the actual job board search terms
    const searchQueries = [...new Set([
      ...profile.search_keywords.slice(0, 4),
      ...profile.roles.slice(0, 2),
    ])].slice(0, 5);

    if (searchQueries.length === 0) searchQueries.push('internship');
    console.log(`[Search] Queries: ${searchQueries.join(' | ')}`);

    // ── Fetch jobs from ALL sources for EACH query in PARALLEL ──
    const allJobsMap = new Map<string, JobResult>();
    const fetchPromises = searchQueries.map(q => aggregateJobs(q, userLocation));
    const results = await Promise.all(fetchPromises);

    for (const batch of results) {
      for (const job of batch) {
        const key = `${job.title}-${job.company}`.toLowerCase().replace(/\s+/g, '');
        if (!allJobsMap.has(key)) allJobsMap.set(key, job);
      }
    }

    const rawJobs = Array.from(allJobsMap.values());
    console.log(`[Search] Fetched ${rawJobs.length} unique jobs from all sources`);

    // ── Score every job ──
    const scored = rawJobs.map(job => ({
      ...job,
      matchScore: scoreJob(job, profile),
      matchLabel: getMatchLabel(scoreJob(job, profile)),
    }));

    // ── Filter: ONLY show jobs that actually match something ──
    const relevant = scored
      .filter(job => job.matchScore >= 15)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 50);

    const zeroMatch = scored.filter(job => job.matchScore === 0).length;
    console.log(
      `[Search] ${relevant.length} relevant (from ${rawJobs.length} total, ` +
      `${zeroMatch} had zero match, top score: ${relevant[0]?.matchScore ?? 0}%)`
    );

    return NextResponse.json({
      success: true,
      total: relevant.length,
      total_fetched: rawJobs.length,
      zero_match_filtered: zeroMatch,
      detected_skills: [...profile.hard_skills, ...profile.soft_skills],
      detected_domains: [profile.industry],
      target_roles: profile.roles,
      search_queries_used: searchQueries,
      profile,
      jobs: relevant,
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { success: false, error: 'Search failed' },
      { status: 500 }
    );
  }
}

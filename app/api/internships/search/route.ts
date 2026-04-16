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

// SOFT SKILL BLACKLIST — never used for scoring/search
const SOFT_SKILLS = new Set([
  'communication', 'teamwork', 'leadership', 'problem solving', 'critical thinking',
  'analytical skills', 'presentation skills', 'interpersonal skills', 'time management',
  'organisation', 'organization', 'adaptability', 'creativity', 'work ethic',
  'attention to detail', 'collaboration', 'conflict resolution', 'decision making',
  'negotiation', 'multitasking', 'self-motivated', 'customer service', 'numeracy',
  'reliable', 'punctual', 'flexible', 'hardworking', 'enthusiastic', 'motivated',
  'friendly', 'professional', 'verbal communication', 'written communication',
  'active listening', 'empathy', 'patience', 'positive attitude', 'stress management',
  'responsible', 'reliable', 'dedicated', 'goal-oriented', 'customer-focused',
]);

/**
 * Strip template "(Tip: ...)" paragraphs and other noise before sending to AI.
 */
function cleanResumeText(text: string): string {
  return text
    .replace(/\(Tip:[\s\S]*?\)/g, '')
    .replace(/\(Optional:[\s\S]*?\)/g, '')
    .replace(/\[[\s\S]*?Tip:[\s\S]*?\]/g, '')
    .replace(/^Tip:.*$/gm, '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .join('\n');
}

/**
 * AI extracts a full job-search profile from ANY resume.
 * Career Objective is treated as the primary search signal.
 */
async function aiExtractProfile(resumeText: string): Promise<ResumeProfile | null> {
  try {
    const clean = cleanResumeText(resumeText);
    if (clean.length < 50) {
      console.error('[Search] Resume too short after cleaning');
      return null;
    }

    const systemPrompt = `You are a resume analyst. Analyze resumes and extract job search profiles. Return ONLY valid JSON, no markdown, no explanation.`;

    const userPrompt = `Analyze this resume and extract a job search profile.

CAREER OBJECTIVE: If the resume has a Career Objective, Professional Summary, or About Me section, read it FIRST. This tells you what the person WANTS to do. Their target roles should come from here, not just from past jobs.

RULES:
- Extract HARD SKILLS (technical, tools, software, certifications, equipment operated) separately from SOFT SKILLS (communication, teamwork, leadership, time management, etc.)
- Treat operational abilities as hard skills: "cash handling", "operating cash register", "inventory management", "food preparation", "customer service systems" etc are ALL valid hard skills for entry-level workers
- For students/entry-level: their coursework, projects, and part-time jobs are valid experience
- The industry field should be where they WANT to work (from career objective), not just where they've worked
- search_keywords: 4-8 specific 2-4 word phrases an employer would use on a job board (e.g. ["retail sales assistant", "sports store associate"] NOT ["communication", "teamwork"])
- experience_level: "entry" (student/0-1yr), "junior" (1-3yr), "mid" (3-7yr), "senior" (7+yr)
- roles: 2-5 job titles they should search for, informed by career objective

NO-HARD-SKILL RULE: If the person has no technical skills, DO NOT leave hard_skills empty. Put whatever specific abilities they mention: "operating cash register", "serving customers", "stacking shelves", "basic math", "Microsoft Word" — all valid.

Return ONLY this JSON:
{
  "hard_skills": ["skill1", "skill2"],
  "soft_skills": ["skill1", "skill2"],
  "roles": ["role1", "role2"],
  "industry": "industry name",
  "experience_level": "entry|junior|mid|senior",
  "search_keywords": ["keyword1", "keyword2", "keyword3"]
}

RESUME:
${clean.slice(0, 4000)}`;

    const response = await callAI(systemPrompt, userPrompt, {
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 800,
      providerPriority: ['groq', 'gemini', 'openai'],
    });

    if (!response.success || !response.content) {
      console.error('[Search] AI profile extraction failed:', response.error);
      return null;
    }

    const jsonStr = response.content
      .replace(/```json\n?/g, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(jsonStr);

    const rawHard: string[] = Array.isArray(parsed.hard_skills) ? parsed.hard_skills : [];
    const rawSoft: string[] = Array.isArray(parsed.soft_skills) ? parsed.soft_skills : [];

    // Safety: move any soft skills that leaked into hard_skills
    const cleanHard = rawHard.filter(s => !SOFT_SKILLS.has(s.toLowerCase()));
    const leakedSoft = rawHard.filter(s => SOFT_SKILLS.has(s.toLowerCase()));

    const profile: ResumeProfile = {
      hard_skills: cleanHard,
      soft_skills: [...new Set([...rawSoft, ...leakedSoft])],
      roles: Array.isArray(parsed.roles) ? parsed.roles : [],
      industry: parsed.industry || '',
      experience_level: parsed.experience_level || 'entry',
      search_keywords: Array.isArray(parsed.search_keywords) ? parsed.search_keywords : [],
    };

    console.log(`[Search] AI SUCCESS — Industry: ${profile.industry}`);
    console.log(`[Search] Hard Skills: ${profile.hard_skills.slice(0, 8).join(', ')}`);
    console.log(`[Search] Roles: ${profile.roles.join(', ')}`);
    console.log(`[Search] Keywords: ${profile.search_keywords.join(', ')}`);

    return profile;
  } catch (err: any) {
    console.error('[Search] AI extraction error:', err.message);
    return null;
  }
}

/**
 * Minimal fallback when AI is unavailable.
 * Passes through dashboard-extracted data, no hardcoded guessing.
 */
function fallbackExtractProfile(
  clientSkills: string[],
  clientRoles: string[]
): ResumeProfile {
  const hardSkills = (clientSkills || []).filter(
    (s: string) => s && !SOFT_SKILLS.has(s.toLowerCase())
  );
  const softSkills = (clientSkills || []).filter(
    (s: string) => s && SOFT_SKILLS.has(s.toLowerCase())
  );

  const searchKeywords: string[] = [];
  clientRoles.slice(0, 3).forEach(r => searchKeywords.push(String(r)));
  hardSkills.slice(0, 3).forEach(s => searchKeywords.push(`${s} internship`));
  if (searchKeywords.length === 0) searchKeywords.push('internship');

  return {
    hard_skills: hardSkills,
    soft_skills: softSkills,
    roles: clientRoles.map(String).slice(0, 5),
    industry: 'general',
    experience_level: 'entry',
    search_keywords: [...new Set(searchKeywords)].slice(0, 5),
  };
}

function getMatchLabel(score: number): string {
  if (score >= 75) return 'Excellent Match';
  if (score >= 60) return 'Good Match';
  if (score >= 40) return 'Moderate Match';
  return 'Low Match';
}

/**
 * Generic job scoring — works for ANY industry.
 */
function scoreJob(job: JobResult, profile: ResumeProfile): number {
  let score = 0;
  const jobTitle = (job.title || '').toLowerCase();
  const jobDesc = (job.description || '').toLowerCase();
  const jobText = `${jobTitle} ${jobDesc}`;

  // ── 50%: Hard skill overlap ──
  const userHardSkills = profile.hard_skills.map(s => s.toLowerCase());
  const skillsMatched = userHardSkills.filter(skill => {
    const words = skill.split(/\s+/);
    return words.every(w => jobText.includes(w));
  });
  const skillScore = userHardSkills.length > 0
    ? (skillsMatched.length / userHardSkills.length) * 50
    : 0;
  score += skillScore;

  // ── 25%: Role/title match ──
  const userRoles = profile.roles.map(r => r.toLowerCase());
  const rolesMatched = userRoles.filter(role => {
    const words = role.split(/\s+/);
    return words.some(w => w.length > 3 && jobTitle.includes(w));
  });
  const roleScore = userRoles.length > 0
    ? (rolesMatched.length / userRoles.length) * 25
    : 0;
  score += roleScore;

  // ── Partial role-word bonus (words appear in title but not full phrase) ──
  const titleWords = jobTitle.split(/\s+/);
  const roleWordMatches = userRoles.filter(role => {
    const roleWords = role.split(/\s+/).filter(w => w.length > 3);
    return roleWords.some(rw => titleWords.includes(rw));
  });
  if (roleWordMatches.length > 0 && rolesMatched.length === 0) {
    score += 5;
  }

  // ── 10%: Industry keyword presence ──
  const industry = (profile.industry || '').replace(/_/g, ' ').toLowerCase();
  if (industry && industry !== 'general') {
    const industryWords = industry.split(/\s+/);
    if (industryWords.some(w => jobText.includes(w))) {
      score += 10;
    }
  }

  // ── 15%: Junior/intern bonus (only if something matched) ──
  const hasSomeMatch = skillsMatched.length > 0 || rolesMatched.length > 0 || roleWordMatches.length > 0;
  if (hasSomeMatch) {
    if (/intern|entry|trainee|junior|graduate|fresher|no experience|student/.test(jobTitle)) {
      score += 15;
    } else {
      score += 5;
    }
  }

  // ── Penalties ──
  if (/senior|sr\.|sr |lead |manager|director|vp |chief|staff |principal|architect|head of/.test(jobTitle)) {
    score -= 30;
  }

  const expMatch = jobText.match(/(\d+)\+?\s*years?\s*(of\s*)?(experience|exp)/i);
  if (expMatch) {
    const yrs = parseInt(expMatch[1]);
    if (yrs >= 3) score -= 20;
    else if (yrs >= 2) score -= 10;
  }

  // Zero skill + zero role match = irrelevant job
  if (industry && industry !== 'general' && skillsMatched.length === 0 && rolesMatched.length === 0 && roleWordMatches.length === 0) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      resumeText = '',
      location: bodyLocation = '',
      skills: clientSkills = [],
      preferredRoles: clientRoles = [],
    } = body;

    const userLocation = bodyLocation || 'remote';

    console.log('=== INTERNOS SEARCH ===');
    console.log(`[Search] Location: ${userLocation}`);

    // AI profile extraction — primary
    let profile: ResumeProfile | null = resumeText
      ? await aiExtractProfile(resumeText)
      : null;

    // Merge dashboard-extracted hard skills into AI profile
    if (profile && clientSkills.length > 0) {
      const clientHard = clientSkills.filter((s: string) => !SOFT_SKILLS.has(s.toLowerCase()));
      const clientSoft = clientSkills.filter((s: string) => SOFT_SKILLS.has(s.toLowerCase()));
      profile.hard_skills = [...new Set([...clientHard, ...profile.hard_skills])];
      profile.soft_skills = [...new Set([...clientSoft, ...profile.soft_skills])];
    }

    if (!profile) {
      console.log('[Search] AI unavailable — using minimal fallback');
      profile = fallbackExtractProfile(
        Array.isArray(clientSkills) ? clientSkills.map(String) : [],
        Array.isArray(clientRoles) ? clientRoles.map(String) : []
      );
    }

    console.log(`[Search] Industry: ${profile.industry}`);
    console.log(`[Search] Hard skills (${profile.hard_skills.length}): ${profile.hard_skills.slice(0, 10).join(', ')}`);

    // ── Query builder ──
    const queries = new Set<string>();

    // Primary: AI search_keywords
    profile.search_keywords.forEach(kw => queries.add(kw));
    // Secondary: roles
    profile.roles.slice(0, 3).forEach(r => queries.add(r));
    // Tertiary: top hard skills + "internship"
    profile.hard_skills.slice(0, 2).forEach(s => queries.add(`${s} internship`));

    // Safety net: ensure at least one useful query
    if (queries.size === 0) queries.add('internship');

    const hasUsefulQuery = [...queries].some(q => {
      const lower = q.toLowerCase();
      return lower.includes('internship') || lower.includes('job') || lower.includes('role')
        || lower.includes('assistant') || lower.includes('position') || lower.includes('associate');
    });
    if (!hasUsefulQuery && queries.size > 0) {
      queries.add([...queries][0] + ' internship');
    }

    const queryList = [...queries].slice(0, 5);
    console.log(`[Search] Queries: ${queryList.join(' | ')}`);

    // ── Fetch jobs ──
    const allJobsMap = new Map<string, JobResult>();
    for (const q of queryList) {
      try {
        const batch = await aggregateJobs(q, userLocation);
        for (const job of batch) {
          const key = `${job.title}-${job.company}`.toLowerCase().replace(/\s+/g, '');
          if (!allJobsMap.has(key)) allJobsMap.set(key, job);
        }
        if (allJobsMap.size >= 100) break;
      } catch (e) {
        console.error(`aggregateJobs failed for "${q}"`);
      }
    }

    const rawJobs = Array.from(allJobsMap.values());

    // ── Score + filter ──
    const scoredJobs = rawJobs
      .map(job => ({
        ...job,
        matchScore: scoreJob(job, profile!),
        matchLabel: getMatchLabel(scoreJob(job, profile!)),
      }))
      .sort((a, b) => b.matchScore - a.matchScore);

    const MIN_SCORE = 20;
    const relevant = scoredJobs.filter(j => j.matchScore >= MIN_SCORE);
    const finalJobs = relevant.length >= 3 ? relevant : scoredJobs.slice(0, 12);

    console.log(`[Search] Scored ${scoredJobs.length}, returning ${finalJobs.length} jobs`);

    return NextResponse.json({
      success: true,
      total: finalJobs.length,
      detected_skills: [...profile.hard_skills, ...profile.soft_skills],
      detected_domains: [profile.industry],
      target_roles: profile.roles,
      jobs: finalJobs,
      count: finalJobs.length,
      profile,
      searchQueries: queryList,
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { success: false, error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

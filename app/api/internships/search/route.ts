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
 * Remove template "Tip:" paragraphs, page numbers, and other non-resume noise
 * that confuse the AI extraction.
 */
function cleanResumeText(text: string): string {
  return text
    // Remove "(Tip: ...)" inline template paragraphs
    .replace(/\(Tip:[\s\S]*?\)/g, '')
    // Remove standalone "Tip:" lines
    .replace(/^Tip:.*$/gm, '')
    // Remove page numbers
    .replace(/^Page \d+$/gm, '')
    // Remove standalone Resume/CV headers
    .replace(/^((?:Resume|CV|Curriculum Vitae)\s*)$/gim, '')
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Use AI to deeply analyze ANY resume and extract what jobs this person should search for.
 * Fully generic — works for retail, healthcare, engineering, arts, law, trades, anything.
 */
async function aiExtractProfile(resumeText: string): Promise<ResumeProfile | null> {
  try {
    const cleanedText = cleanResumeText(resumeText);
    if (cleanedText.length < 50) {
      console.error('[Search] Resume too short after cleaning');
      return null;
    }

    const prompt = `You are a career analysis engine. Your ONLY job is to read a resume and determine what jobs this person should search for.

You will see a resume. It could be from ANY field and ANY experience level — high school student, trade apprentice, retail worker, doctor, engineer, artist, lawyer, teacher — anything. Do NOT assume any default industry.

IMPORTANT: Many resumes contain template instructions like "(Tip: ...)" paragraphs. IGNORE those — they are resume-writing tips, not real content.

If the resume has a "Career Objective" or "Objective" section, READ IT FIRST. It states exactly what kind of job they want.

Analyze the resume and return JSON with EXACTLY these fields:

{
  "hard_skills": ["list of specific, searchable skills found in the resume"],
  "soft_skills": ["list of generic interpersonal skills found in the resume"],
  "roles": ["list of 3-5 job titles this person should search for"],
  "industry": "primary industry from their career objective or work experience",
  "experience_level": "fresher or junior or mid or senior",
  "search_keywords": ["list of 4-6 search phrases to type into a job board"]
}

RULES FOR EACH FIELD:

1. hard_skills — Specific, searchable abilities found in the resume. Examples: "Python", "financial modeling", "AutoCAD", "cash register operation", "inventory management", "food preparation", "Microsoft Office". For entry-level workers with NO technical skills, list whatever they DO know: "cash handling", "basic math", "serving customers", "operating cash register" are all valid hard skills. NEVER leave this empty. NEVER put soft skills here.

2. soft_skills — Generic interpersonal traits for display only. Examples: "communication", "teamwork", "leadership", "numeracy". These are NOT used for job matching.

3. roles — Job titles this person would realistically apply for. If there is a Career Objective, use it as the PRIMARY source. "Customer service work in a sports retail environment" → roles: ["retail sales assistant", "sports store associate", "customer service representative"]. Include 3-5 roles ordered by relevance.

4. industry — The ONE industry they want to work in. Use the Career Objective if present. "Sports retail" is a valid industry. "Food service", "healthcare", "construction", "education" are all valid. This does NOT need to be a formal category name.

5. search_keywords — THE MOST IMPORTANT FIELD. Phrases you would actually type into Indeed or LinkedIn. For someone with no technical skills, use their career objective + industry + role type. ALWAYS include industry + role combinations. Examples: ["sports retail assistant", "retail customer service", "store associate", "sports store job"]. NEVER use soft skill names. NEVER use single words. ALWAYS 2-4 words per phrase. Include 4-6 phrases.

6. CAREER OBJECTIVE RULE: If the resume contains a Career Objective or Objective section, it is the PRIMARY signal for roles, industry, and search_keywords. Use it before looking at skills.

7. NO-HARD-SKILL RULE: If the person has no technical skills, DO NOT leave hard_skills empty. Every person has done SOMETHING specific: "operating cash register", "serving customers", "stacking shelves", "basic math", "Microsoft Word". Extract those.

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
      console.error('[Search] AI profile extraction failed:', response.error);
      return null;
    }

    let raw = response.content;
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    
    const parsed = JSON.parse(raw) as ResumeProfile;
    
    if (!parsed.hard_skills || !Array.isArray(parsed.hard_skills)) return null;
    if (!parsed.search_keywords || !Array.isArray(parsed.search_keywords)) return null;
    
    // Extra safety: move any soft skills that leaked into hard_skills
    const cleanHard = (parsed.hard_skills || []).filter(s => !SOFT_SKILLS.has(s.toLowerCase()));
    const leakedSoft = (parsed.hard_skills || []).filter(s => SOFT_SKILLS.has(s.toLowerCase()));
    parsed.hard_skills = cleanHard;
    parsed.soft_skills = [...new Set([...(parsed.soft_skills || []), ...leakedSoft])];
    
    console.log(`[Search] AI SUCCESS — Industry: ${parsed.industry}`);
    console.log(`[Search] Hard Skills: ${(parsed.hard_skills||[]).slice(0,8).join(', ')}`);
    console.log(`[Search] Roles: ${(parsed.roles||[]).join(', ')}`);
    console.log(`[Search] Keywords: ${(parsed.search_keywords||[]).join(', ')}`);
    
    return parsed;
  } catch (err: any) {
    console.error('[Search] AI extraction error:', err.message);
    return null;
  }
}

/**
 * Minimal fallback when AI is unavailable.
 * Does NOT try to detect domains or generate smart queries.
 * Just passes through the skills/roles the dashboard already extracted.
 */
function fallbackExtractProfile(
  _resumeText: string,
  clientSkills: string[],
  clientRoles: string[]
): ResumeProfile {
  // Use whatever the dashboard AI already extracted
  // Filter out obvious soft skills from search terms
  const hardSkills = (clientSkills || []).filter(
    (s: string) => s && !SOFT_SKILLS.has(s.toLowerCase())
  );
  
  const softSkills = (clientSkills || []).filter(
    (s: string) => s && SOFT_SKILLS.has(s.toLowerCase())
  );

  // Build search queries from hard skills + roles only
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

function getMatchLabel(score: number): string {
  if (score >= 75) return 'Excellent Match';
  if (score >= 60) return 'Good Match';
  if (score >= 40) return 'Moderate Match';
  return 'Low Match';
}

/**
 * Generic job scoring — works for ANY industry.
 * Uses hard skills, roles, and industry without hardcoded domain maps.
 */
function scoreJob(job: any, profile: ResumeProfile): number {
  let score = 0;
  const jobTitle = (job.title || '').toLowerCase();
  const jobDesc = (job.description || '').toLowerCase();
  const jobText = `${jobTitle} ${jobDesc}`;

  // ── 50%: Hard skill overlap ──
  const userHardSkills = (profile.hard_skills || []).map(s => s.toLowerCase());
  const skillsMatched = userHardSkills.filter(skill => {
    const words = skill.split(/\s+/);
    return words.every(w => jobText.includes(w));
  });
  const skillScore = userHardSkills.length > 0
    ? (skillsMatched.length / userHardSkills.length) * 50 : 0;
  score += skillScore;

  // ── 25%: Role/title match ──
  const userRoles = (profile.roles || []).map(r => r.toLowerCase());
  const rolesMatched = userRoles.filter(role => {
    const words = role.split(/\s+/);
    return words.some(w => jobTitle.includes(w));
  });
  const roleScore = userRoles.length > 0
    ? (rolesMatched.length / userRoles.length) * 25 : 0;
  score += roleScore;

  // ── 10%: Industry keyword presence ──
  const industry = (profile.industry || '').replace(/_/g, ' ').toLowerCase();
  if (industry && industry !== 'general') {
    const industryWords = industry.split(/\s+/);
    if (industryWords.some(w => jobText.includes(w))) {
      score += 10;
    }
  }

  // ── Partial role-word bonus: words from user roles appear in title (not full phrase) ──
  const titleWords = jobTitle.split(/\s+/);
  const roleWordMatches = userRoles.filter(role => {
    const roleWords = role.split(/\s+/).filter(w => w.length > 3);
    return roleWords.some(rw => titleWords.includes(rw));
  });
  if (roleWordMatches.length > 0 && rolesMatched.length === 0) {
    score += 5; // small bonus for partial title match
  }

  // ── 15%: Junior/intern bonus (only if something matched) ──
  if (skillsMatched.length > 0 || rolesMatched.length > 0 || roleWordMatches.length > 0) {
    if (/intern|entry|trainee|junior|graduate|fresher/.test(jobTitle)) {
      score += 10;
    } else {
      score += 5;
    }
  }

  // ── Penalties ──
  // Senior jobs: big penalty
  if (/senior|sr\.|sr |lead |manager|director|vp |chief|staff |principal|architect|head of/.test(jobTitle)) {
    score -= 30;
  }

  // Experience requirement penalty
  const expMatch = jobText.match(/(\d+)\+?\s*years?\s*(of\s*)?(experience|exp)/i);
  if (expMatch) {
    const yearsRequired = parseInt(expMatch[1]);
    if (yearsRequired >= 3) score -= 20;
    else if (yearsRequired >= 2) score -= 10;
  }

  // Completely wrong industry: penalty
  if (industry && industry !== 'general' && skillsMatched.length === 0 && rolesMatched.length === 0) {
    // If ZERO skills and ZERO roles matched, this job is irrelevant regardless of score
    score -= 20;
  }

  return Math.max(0, Math.min(Math.round(score), 100));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      query = 'internship', 
      location: bodyLocation = '', 
      skills: clientSkills = [], 
      preferredRoles: clientRoles = [],
      experience: clientExperience = 'fresher',
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

    // ═══════════════════════════════════════════════════════
    // QUERY BUILDER — AI-generated keywords + roles + skills
    // No hardcoded domain maps needed
    // ═══════════════════════════════════════════════════════
    const searchQueries: string[] = [];

    // Use AI-generated search keywords as the primary queries
    if (profile.search_keywords && profile.search_keywords.length > 0) {
      searchQueries.push(...profile.search_keywords.slice(0, 4));
    }
    // Add top 2 roles as additional queries
    if (profile.roles && profile.roles.length > 0) {
      searchQueries.push(...profile.roles.slice(0, 2));
    }
    // Add top 2 hard skills as "skill + internship" queries
    if (profile.hard_skills && profile.hard_skills.length > 0) {
      searchQueries.push(
        ...profile.hard_skills.slice(0, 2).map(s => `${s} internship`)
      );
    }

    const uniqueQueries = [...new Set(searchQueries)].slice(0, 5);

    // Safety: if AI returned no job-board-style queries, append "internship" to first query
    const hasUsefulQuery = uniqueQueries.some(q => {
      const lower = q.toLowerCase();
      return lower.includes('internship') || lower.includes('job') || lower.includes('role')
        || lower.includes('assistant') || lower.includes('position') || lower.includes('associate');
    });
    if (!hasUsefulQuery && uniqueQueries.length > 0) {
      uniqueQueries.push(uniqueQueries[0] + ' internship');
    }
    if (uniqueQueries.length === 0) {
      uniqueQueries.push('internship');
    }

    console.log(`[Search] Queries: ${uniqueQueries.join(' | ')}`);

    console.log(`[Search] Starting fetch for: ${uniqueQueries.join(', ')}`);
    
    const allJobsMap = new Map<string, JobResult>();
    
    for (const q of uniqueQueries) {
      try {
        const batch = await aggregateJobs(q, userLocation);
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

    // Strict filtering: Must have at least some relevance
    const MIN_MATCH_SCORE = 20;
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
      detected_skills: [...(profile.hard_skills || []), ...(profile.soft_skills || [])],
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

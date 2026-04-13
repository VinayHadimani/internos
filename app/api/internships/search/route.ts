import { NextRequest, NextResponse } from 'next/server';
import { aggregateJobs, type JobResult } from '@/lib/aggregator';
import { extractStudentProfile } from '@/lib/resume-parser';

/** Build 2–4 aggregator queries from profile so results change when resume/skills change. */
function buildSearchQueries(
  skills: unknown[],
  preferredRoles: unknown[],
  fallbackQuery: string
): string[] {
  const sk = [...new Set(
    (skills || [])
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0)
  )];
  const roles = [...new Set(
    (preferredRoles || [])
      .map((r) => String(r).trim())
      .filter((r) => r.length > 0)
  )];

  const out: string[] = [];

  for (const r of roles.slice(0, 2)) {
    out.push(`${r} internship`);
  }
  for (const s of sk.slice(0, 3)) {
    out.push(`${s} internship`);
  }

  if (out.length === 0) {
    out.push(`${fallbackQuery} internship`, `${fallbackQuery} job developer`);
  } else {
    const breadth = sk[0] || roles[0] || fallbackQuery;
    out.push(`${breadth} developer job`);
  }

  return [...new Set(out.map((q) => q.replace(/\s+/g, ' ').trim()))].slice(0, 4);
}

/**
 * Fast keyword-based match scoring.
 * No LLM calls — runs in <1ms per job.
 */
function calculateMatchScore(job: any, userSkills: string[], preferredRoles: string[]): number {
  const jobText = `${job.title || ''} ${job.description || ''} ${job.company || ''}`.toLowerCase();
  const title = (job.title || '').toLowerCase();

  let score = 30; // base score

  // Skill matching (0-40 points)
  const safeSkills = Array.isArray(userSkills) ? userSkills.filter(Boolean) : [];
  if (safeSkills.length > 0) {
    let matched = 0;
    for (const skill of safeSkills) {
      if (jobText.includes(skill.toLowerCase())) matched++;
    }
    score += Math.round((matched / safeSkills.length) * 40);
  }

  // Role relevance (0-15 points)
  const safeRoles = Array.isArray(preferredRoles) ? preferredRoles.filter(Boolean) : [];
  for (const role of safeRoles) {
    if (title.includes(role.toLowerCase()) || jobText.includes(role.toLowerCase())) {
      score += 15;
      break;
    }
  }

  // Internship bonus (0-10 points)
  if (title.includes('intern') || jobText.includes('internship')) {
    score += 10;
  }

  // Entry-level / junior / fresher bonus
  if (title.includes('junior') || title.includes('entry') || jobText.includes('fresher') || jobText.includes('no experience')) {
    score += 5;
  }

  // Penalty for senior roles
  const seniorKeywords = ['senior', 'sr.', 'staff', 'lead', 'manager', 'director', 'principal', 'head of', 'vp', 'chief', 'architect'];
  if (seniorKeywords.some(k => title.includes(k))) {
    score -= 30;
  }

  // Penalty for high experience requirements
  const expPattern = /(\d+)\+?\s*years?\s*(of\s*)?(experience|exp)/gi;
  const expMatches = [...(job.description || '').toLowerCase().matchAll(expPattern)];
  const maxExp = expMatches.reduce((max, m) => Math.max(max, parseInt(m[1])), 0);
  if (maxExp >= 5) score -= 25;
  else if (maxExp >= 3) score -= 15;
  else if (maxExp >= 2) score -= 5;

  return Math.max(0, Math.min(100, score));
}

function getMatchLabel(score: number): string {
  if (score >= 80) return 'Excellent Match';
  if (score >= 60) return 'Good Match';
  if (score >= 40) return 'Moderate Match';
  return 'Low Match';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const { 
      query = 'software developer', 
      location: bodyLocation = '', 
      skills = [], 
      experience = 'fresher',
      preferredRoles = [],
    } = body;
    
    const resumeText = body.resumeText;
    const userLocation = req.headers.get('x-user-location') || req.nextUrl.searchParams.get('location') || bodyLocation || 'India';
    
    console.log('=== INTERNOS SEARCH ===');
    console.log('User Skills:', skills);
    console.log('User Location:', userLocation);

    // ────────────────────────────────────────────
    // Step 1: Build smart queries
    // ────────────────────────────────────────────
    // Start with user-provided skills/roles
    let profileSkills = Array.isArray(skills) ? [...skills] : [];
    let profileRoles = Array.isArray(preferredRoles) ? [...preferredRoles] : [];
    let studentProfile = null;

    // Try AI profile extraction with a 6-second timeout
    // so we don't block the whole request if it's slow
    if (resumeText && resumeText.length > 100) {
      try {
        const profilePromise = extractStudentProfile(resumeText);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile extraction timeout')), 6000)
        );

        studentProfile = await Promise.race([profilePromise, timeoutPromise]) as any;
        
        if (studentProfile) {
          console.log('AI Profile — Domains:', studentProfile.domains);
          console.log('AI Profile — Skills:', studentProfile.skills);
          
          // Merge AI-detected skills with user-provided ones
          if (studentProfile.skills?.length > 0) {
            profileSkills = [...new Set([...profileSkills, ...studentProfile.skills])];
          }
          if (studentProfile.domains?.length > 0) {
            profileRoles = [...new Set([...profileRoles, ...studentProfile.domains])];
          }
        }
      } catch (profileError: any) {
        console.warn('AI profile extraction skipped:', profileError.message);
        // Continue with user-provided skills — no problem
      }
    }

    const searchQueries = buildSearchQueries(profileSkills, profileRoles, query);
    console.log('Search queries:', searchQueries);

    // ────────────────────────────────────────────
    // Step 2: Fetch raw jobs from all sources
    // ────────────────────────────────────────────
    const allJobsMap = new Map<string, JobResult>();
    for (const q of searchQueries) {
      try {
        const batch = await aggregateJobs(q, userLocation);
        for (const job of batch) {
          const key = `${job.title}-${job.company}`.toLowerCase();
          if (!allJobsMap.has(key)) {
            allJobsMap.set(key, job);
          }
        }
      } catch (e) {
        console.error(`aggregateJobs failed for "${q}":`, e);
      }
    }

    const rawJobs: JobResult[] = Array.from(allJobsMap.values());
    console.log(`Total unique jobs found: ${rawJobs.length}`);

    // ────────────────────────────────────────────
    // Step 3: Fast keyword scoring (NO LLM calls)
    // ────────────────────────────────────────────
    const skillStrings = profileSkills.map(String).filter(Boolean);
    const roleStrings = profileRoles.map(String).filter(Boolean);

    const scoredJobs = rawJobs.map(job => {
      const matchScore = calculateMatchScore(job, skillStrings, roleStrings);
      return {
        ...job,
        matchScore,
        matchLabel: getMatchLabel(matchScore),
      };
    });

    // Sort by score descending, return top results (no minimum threshold — let the user see what's available)
    const finalJobs = scoredJobs
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 50);

    console.log(`Returning ${finalJobs.length} scored jobs`);

    return NextResponse.json({
      success: true,
      total: finalJobs.length,
      student_profile: studentProfile,
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
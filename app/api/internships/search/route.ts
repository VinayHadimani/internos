import { NextRequest, NextResponse } from 'next/server';
import { aggregateJobs, type JobResult } from '@/lib/aggregator';
import { filterAndScoreJobs } from '@/job-filter-pipeline';
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
    console.log('Experience:', experience);
    console.log('Preferred Roles:', preferredRoles);
    console.log('User Location:', userLocation);

    // ──── Step 1: Build domain-aware queries ────
    // If we have resume text, try AI profile extraction for smarter queries
    let profileSkills = Array.isArray(skills) ? skills : [];
    let profileRoles = Array.isArray(preferredRoles) ? preferredRoles : [];
    let studentProfile = null;

    if (resumeText && resumeText.length > 100) {
      try {
        studentProfile = await extractStudentProfile(resumeText);
        if (studentProfile) {
          console.log('AI Profile — Domains:', studentProfile.domains);
          console.log('AI Profile — Skills:', studentProfile.skills);
          console.log('AI Profile — Tier:', studentProfile.school_tier);
          
          // Merge AI-detected skills with user-provided ones
          if (studentProfile.skills?.length > 0) {
            profileSkills = [...new Set([...profileSkills, ...studentProfile.skills])];
          }
          // Use domains as additional role hints
          if (studentProfile.domains?.length > 0) {
            profileRoles = [...new Set([...profileRoles, ...studentProfile.domains])];
          }
        }
      } catch (profileError) {
        console.warn('AI profile extraction failed, using user-provided skills:', profileError);
      }
    }

    const searchQueries = buildSearchQueries(profileSkills, profileRoles, query);
    console.log('Search queries:', searchQueries);

    // ──── Step 2: Fetch jobs from ALL working sources (old aggregator) ────
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

    const rawScrapedJobs: JobResult[] = Array.from(allJobsMap.values());
    console.log(`Total unique jobs/internships found: ${rawScrapedJobs.length}`);

    // ──── Step 3: Base scoring ────
    function calculateBaseMatchScore(job: any, userSkills: string[]) {
      const jobText = `${job.title} ${job.description || ''}`.toLowerCase();
      let matchedSkills = 0;
      
      const safeSkills = Array.isArray(userSkills) ? userSkills : [];
      for (const skill of safeSkills) {
        if (skill && jobText.includes(skill.toLowerCase())) {
          matchedSkills++;
        }
      }
      
      const skillScore = safeSkills.length > 0 ? Math.round((matchedSkills / safeSkills.length) * 100) : 50;
      return Math.max(30, skillScore);
    }

    // Always add matchScore field for frontend
    const normalizedJobs = rawScrapedJobs.map(job => ({
      ...job,
      matchScore: (job as any).matchScore || calculateBaseMatchScore(job, profileSkills.map(String)),
      matchLabel: (job as any).matchLabel || 'Moderate Match'
    }));

    // ──── Step 4: AI scoring (optional, graceful degradation) ────
    let filteredJobs;
    try {
      if (resumeText && resumeText.length > 100 && normalizedJobs.length > 0) {
        filteredJobs = await filterAndScoreJobs(resumeText, normalizedJobs);
        
        // If AI filter killed everything, fall back to base-scored results
        if (!filteredJobs || filteredJobs.length === 0) {
          console.warn('AI filter returned 0 results, falling back to base scores');
          filteredJobs = normalizedJobs
            .sort((a: any, b: any) => b.matchScore - a.matchScore)
            .slice(0, 40);
        }
      } else {
        console.log('No resume text or no jobs, skipping AI scoring');
        filteredJobs = normalizedJobs
          .sort((a: any, b: any) => b.matchScore - a.matchScore)
          .slice(0, 40);
      }
    } catch (aiError) {
      console.error('AI filter failed, falling back to base-scored results:', aiError);
      filteredJobs = normalizedJobs
        .sort((a: any, b: any) => b.matchScore - a.matchScore)
        .slice(0, 40);
    }

    console.log(`Returning ${filteredJobs.length} FILTERED jobs`);

    return NextResponse.json({
      success: true,
      total: filteredJobs.length,
      student_profile: studentProfile,
      jobs: filteredJobs,
      count: filteredJobs.length
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { success: false, error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
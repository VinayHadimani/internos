import { NextRequest, NextResponse } from 'next/server';
import { aggregateJobs, type JobResult } from '@/lib/aggregator';
import { filterAndScoreJobs } from '@/job-filter-pipeline';

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
    
    // Fallback search parameters
    const { 
      query = 'software developer', 
      location: bodyLocation = '', 
      skills = [], 
      experience = 'fresher',
      preferredRoles = [],
    } = body;
    
    const userLocation = req.headers.get('x-user-location') || req.nextUrl.searchParams.get('location') || bodyLocation || 'India';
    
    console.log('=== MATCH DEBUG ===');
    console.log('User Skills:', skills);
    console.log('Experience:', experience);
    console.log('Preferred Roles:', preferredRoles);
    console.log('User Location:', userLocation);
    
    const searchQueries = buildSearchQueries(skills, preferredRoles, query);
    console.log('Search queries from profile:', searchQueries);

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

    // Assume resumeText is passed in the request body
    const resumeText = body.resumeText; 

    // Always add matchScore field for frontend
    // This prevents empty % match display
    const normalizedJobs = rawScrapedJobs.map(job => ({
      ...job,
      matchScore: job.matchScore || 50,
      matchLabel: job.matchLabel || 'Moderate Match'
    }));

    // Fallback if AI pipeline fails
    let filteredJobs;
    try {
      // Only run AI filter if we actually have resume text
      if (resumeText && resumeText.length > 100) {
        filteredJobs = await filterAndScoreJobs(resumeText, normalizedJobs);
      } else {
        console.log('No resume text available, skipping AI scoring');
        filteredJobs = normalizedJobs;
      }
    } catch (aiError) {
      console.error('AI filter failed, falling back to results:', aiError);
      filteredJobs = normalizedJobs;
    }

    console.log(`Returning ${filteredJobs.length} FILTERED jobs`);

    return NextResponse.json({
      success: true,
      total: filteredJobs.length,
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
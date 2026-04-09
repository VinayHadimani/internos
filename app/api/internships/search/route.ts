import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resumeText } = body;

    if (!resumeText) {
      return NextResponse.json({ error: 'Resume text is required' }, { status: 400 });
    }

    console.log('Starting multi-skill job search...');

    // Step 1: Extract search terms from resume
    const { extractSearchTerms } = await import('@/lib/scraper/resume-job-search');
    const searchTerms = await extractSearchTerms(resumeText);

    console.log('Extracted skills:', searchTerms.skills);

    // Step 2: Search for each skill + general queries
    const { aggregateJobs } = await import('@/lib/scraper/job-aggregator');
    const allJobs: any[] = [];

    // Create search queries from skills
    const searchQueries = [
      ...searchTerms.skills.map((skill: string) => `${skill} internship`),
      ...searchTerms.skills.map((skill: string) => `${skill} developer intern`),
      ...(searchTerms.searchQueries || [])
    ].slice(0, 10); // Limit to 10 queries to avoid timeout

    console.log('Search queries:', searchQueries);

    // Run searches sequentially to avoid rate limits
    for (const query of searchQueries) {
      try {
        const jobs = await aggregateJobs(query);
        allJobs.push(...jobs);
        console.log(`Found ${jobs.length} jobs for: ${query}`);
      } catch (err) {
        console.error(`Search failed for: ${query}`, err);
      }
    }

    // Step 3: Deduplicate by URL
    const seen = new Set<string>();
    const uniqueJobs = allJobs.filter(job => {
      const key = job.url || `${job.title}-${job.company}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Step 4: Rank jobs
    const { rankJobsForResume } = await import('@/lib/scraper/resume-job-search');
    const rankedJobs = await rankJobsForResume(
      resumeText,
      uniqueJobs,
      searchTerms.skills,
      searchTerms.experience
    );

    // Step 5: Filter to 40%+ matches only
    const filteredJobs = rankedJobs.filter((job: any) => job.matchScore >= 40);

    console.log(`Total: ${allJobs.length} → Unique: ${uniqueJobs.length} → After filtering: ${filteredJobs.length}`);

    return NextResponse.json({
      success: true,
      total: filteredJobs.length,
      jobs: filteredJobs,
      searchTerms
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
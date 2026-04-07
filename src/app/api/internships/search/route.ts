import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { searchJobsForResume, rankJobsForResume } from '@/lib/scraper/resume-job-search';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      resumeText, 
      userId, 
      userSkills = [], 
      experienceLevel = 'fresher' 
    } = body;

    if (!resumeText) {
      return NextResponse.json(
        { success: false, error: 'resumeText is required' },
        { status: 400 }
      );
    }

    // 1. Search for jobs based on resume (includes extraction and aggregation)
    console.log(`[Search API] Starting search pipeline for user: ${userId}`);
    try {
      const { jobs, searchTerms } = await searchJobsForResume(resumeText);
      console.log(`[Search API] Found ${jobs?.length || 0} jobs using terms:`, searchTerms);
      
      if (!jobs || jobs.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          searchTerms,
          message: 'No jobs found for the given resume'
        });
      }

      // 2. Rank the found jobs against the resume
      const rankedJobs = await rankJobsForResume(
        resumeText, 
        jobs, 
        userSkills, 
        experienceLevel
      );

      // 3. Optional: Log search to DB if userId is provided
      if (userId) {
        try {
          const supabase = await createClient();
          await (supabase as any).from('search_logs').insert({
            user_id: userId,
            query_params: searchTerms,
            results_count: rankedJobs.length,
            created_at: new Date().toISOString()
          });
        } catch (dbError) {
          console.error('[Search API] DB Logging Error:', dbError);
          // Don't fail the whole request if just logging fails
        }
      }

      return NextResponse.json({
        success: true,
        data: rankedJobs,
        searchTerms,
        count: rankedJobs.length
      });
    } catch (pipelineError: any) {
      console.error('[Search API] Pipeline Error:', pipelineError);
      throw pipelineError;
    }


  } catch (error: any) {
    console.error('[Search API] Pipeline Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error during job search' },
      { status: 500 }
    );
  }
}
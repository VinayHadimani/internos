import { NextRequest, NextResponse } from 'next/server';
import { searchJobsForResume, rankJobsForResume } from '@/lib/scraper/resume-job-search';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resumeText, userSkills } = body;
    
    if (!resumeText) {
      return NextResponse.json({ error: 'Resume text is required' }, { status: 400 });
    }

    // 1. Search for jobs based on resume content
    const { jobs: foundJobs } = await searchJobsForResume(resumeText);
    
    if (!foundJobs || foundJobs.length === 0) {
      return NextResponse.json({ 
        success: true, 
        data: [], 
        message: 'No matching internships found' 
      });
    }

    // 2. Rank jobs against user's skills and resume
    const rankedJobs = await rankJobsForResume(
      resumeText, 
      foundJobs, 
      userSkills || [], 
      'fresher' // Defaulting to fresher for internship search
    );

    return NextResponse.json({
      success: true,
      data: rankedJobs
    });
  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Search failed' 
    }, { status: 500 });
  }
}

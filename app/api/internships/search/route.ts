import { NextRequest, NextResponse } from 'next/server';
import { getRelevantJobs } from '@/lib/scraperOS-internship-sources';
import { filterAndScoreJobs } from '@/job-filter-pipeline';
import { extractStudentProfile, ExtractedStudentProfile } from '@/lib/resume-parser';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Assume resumeText is passed in the request body
    const resumeText = body.resumeText;
    
    if (!resumeText || resumeText.length < 50) {
      return NextResponse.json(
        { success: false, error: 'Valid resume text is required for AI matching.' },
        { status: 400 }
      );
    }

    console.log('=== Step 1: Parsing Resume into Profile ===');
    const studentProfile = await extractStudentProfile(resumeText);
    
    if (!studentProfile) {
      throw new Error('Failed to extract student profile from the resume.');
    }

    console.log('Detected domains:', studentProfile.domains);
    console.log('School tier:', studentProfile.school_tier);
    console.log('Extracted Skills:', studentProfile.skills);

    console.log('=== Step 2: Fetching Jobs from Target Sources ===');
    const rawJobs = await getRelevantJobs(studentProfile);
    console.log(`Found ${rawJobs.length} raw jobs from domain-specific sources`);

    // Run original keyword scoring first for base match percentages
    function calculateBaseMatchScore(job: any, skills: string[]) {
      const jobText = `${job.title} ${job.description || ''}`.toLowerCase();
      let matchedSkills = 0;
      
      const safeSkills = Array.isArray(skills) ? skills : [];
      for (const skill of safeSkills) {
        if (jobText.includes(skill.toLowerCase())) {
          matchedSkills++;
        }
      }
      
      const skillScore = safeSkills.length > 0 ? Math.round((matchedSkills / safeSkills.length) * 100) : 50;
      return Math.max(30, skillScore);
    }

    const normalizedJobs = rawJobs.map((job: any) => ({
      ...job,
      matchScore: job.matchScore || calculateBaseMatchScore(job, studentProfile.skills),
      matchLabel: job.matchLabel || 'Moderate Match'
    }));

    console.log('=== Step 3: AI Filtering and Scoring ===');
    let filteredJobs;
    try {
      filteredJobs = await filterAndScoreJobs(resumeText, normalizedJobs);
    } catch (aiError) {
      console.error('AI filter failed, falling back to base scores:', aiError);
      
      filteredJobs = normalizedJobs
        .filter((job: any) => job.matchScore >= 40)
        .sort((a: any, b: any) => b.matchScore - a.matchScore)
        .slice(0, 30);
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
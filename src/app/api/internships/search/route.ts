import { NextRequest, NextResponse } from 'next/server';
import { aggregateJobs } from '@/lib/aggregator';
import ZAI from 'z-ai-web-dev-sdk';

// Initialize z-ai
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resumeText } = body;
    
    if (!resumeText) {
      return NextResponse.json({ error: 'Resume text is required' }, { status: 400 });
    }

    console.log('=== JOB SEARCH START ===');

    // Step 1: Extract skills from resume using AI
    const zai = await getZai();
    const extractResponse = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Extract skills and search terms from this resume. Return ONLY valid JSON.
{
  "skills": ["skill1", "skill2"],
  "roleTypes": ["Frontend Developer", "Full Stack"],
  "experience": "fresher",
  "searchQueries": ["React developer intern", "Python intern"]
}`
        },
        {
          role: 'user',
          content: resumeText
        }
      ],
      max_tokens: 500,
      temperature: 0.1,
    });

    const searchTerms = JSON.parse(extractResponse.choices[0]?.message?.content || '{"skills":[],"searchQueries":[]}');
    console.log('Extracted skills:', searchTerms.skills);

    // Step 2: Search for jobs using the REAL aggregator
    const allJobs: any[] = [];
    const queries = searchTerms.searchQueries || searchTerms.skills?.map((s: string) => `${s} internship`) || ['software developer intern'];

    for (const query of queries.slice(0, 5)) {
      try {
        console.log(`Searching for: ${query}`);
        const jobs = await aggregateJobs(query);
        console.log(`Found ${jobs.length} jobs for: ${query}`);
        allJobs.push(...jobs);
      } catch (err) {
        console.error(`Search failed for ${query}:`, err);
      }
    }

    console.log(`Total jobs found: ${allJobs.length}`);

    // Step 3: Deduplicate
    const seen = new Set<string>();
    const uniqueJobs = allJobs.filter(job => {
      const key = job.url || `${job.title}-${job.company}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Step 4: Calculate match scores
    const userSkills = searchTerms.skills || [];
    const rankedJobs = uniqueJobs.map(job => {
      const jobSkills = job.skills || job.tags || [];
      const matchingSkills = userSkills.filter((s: string) => 
        jobSkills.some((js: string) => js.toLowerCase().includes(s.toLowerCase()))
      );
      const skillScore = jobSkills.length > 0 
        ? (matchingSkills.length / jobSkills.length) * 100 
        : 50;
      
      const matchScore = Math.round(skillScore);
      
      let matchLabel = 'Low Match';
      if (matchScore >= 80) matchLabel = 'Excellent Match';
      else if (matchScore >= 60) matchLabel = 'Good Match';
      else if (matchScore >= 40) matchLabel = 'Moderate Match';

      return {
        ...job,
        matchScore,
        matchLabel
      };
    });

    // Step 5: Sort and filter
    rankedJobs.sort((a, b) => b.matchScore - a.matchScore);
    const filteredJobs = rankedJobs.filter(job => job.matchScore >= 40);

    console.log(`After filtering (40%+): ${filteredJobs.length} jobs`);

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
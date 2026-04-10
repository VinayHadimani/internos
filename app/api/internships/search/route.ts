import { NextRequest, NextResponse } from 'next/server';
import { aggregateJobs } from '@/lib/aggregator';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const userLocation = req.headers.get('x-user-location') || req.nextUrl.searchParams.get('location') || 'India';
    const body = await req.json();
    const { resumeText } = body;
    
    if (!resumeText) {
      return NextResponse.json({ error: 'Resume text is required' }, { status: 400 });
    }

    console.log('=== JOB SEARCH START ===');

    // Step 1: Extract skills from resume using Groq
    const extractResponse = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
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

    let searchTerms: { skills?: string[]; searchQueries?: string[]; experience?: string; roleTypes?: string[] };
    try {
      let raw = extractResponse.choices[0]?.message?.content || '{"skills":[],"searchQueries":[]}';
      raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      searchTerms = JSON.parse(raw);
    } catch {
      // Fallback: basic keyword extraction
      const words = resumeText.split(/\s+/).filter((w: string) => w.length > 3).slice(0, 10);
      searchTerms = { skills: words, searchQueries: ['software developer intern'] };
    }

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
    const userRoles = searchTerms.roleTypes || [];
    const userLocLower = userLocation.toLowerCase();
    const userLocCity = userLocLower.split(',')[0].trim();

    let rankedJobs = uniqueJobs.map(job => {
      const jobText = `${job.title} ${job.description || ''} ${job.company}`.toLowerCase();
      const jobLocation = (job.location || '').toLowerCase();
      
      // Skills Match (50%)
      const matchingSkills = userSkills.filter((s: string) => jobText.includes(s.toLowerCase()));
      const skillScore = userSkills.length > 0 ? (matchingSkills.length / userSkills.length) * 100 : 50;

      // Location Match (20%)
      const isRemote = jobLocation.includes('remote');
      const isLocMatch = isRemote || 
                         (userLocCity.length > 2 && jobLocation.includes(userLocCity)) || 
                         (userLocLower.includes('india') && jobLocation.includes('india'));
      const locationMatchScore = isLocMatch ? 100 : 0;

      // Role Match (15%)
      const matchingRoles = userRoles.filter((r: string) => jobText.includes(r.toLowerCase()));
      const roleScore = (userRoles.length > 0 && matchingRoles.length > 0) ? 100 : (userRoles.length === 0 ? 50 : 0);

      // Experience Match (15%)
      const experienceScore = 100; // Simplified
      
      const rawMatchScore = (skillScore * 0.5) + (locationMatchScore * 0.2) + (roleScore * 0.15) + (experienceScore * 0.15);
      const matchScore = Math.round(rawMatchScore / 10) * 10;
      
      let matchLabel = 'Low Match';
      if (matchScore >= 80) matchLabel = 'Excellent Match';
      else if (matchScore >= 60) matchLabel = 'Good Match';
      else if (matchScore >= 40) matchLabel = 'Moderate Match';

      return {
        ...job,
        matchScore,
        matchLabel,
        locationMatch: isLocMatch
      };
    });

    // Step 4.5: Filter out jobs below 40%
    rankedJobs = rankedJobs.filter(job => job.matchScore >= 40);

    // Step 5: Sort by Match Score AND Indian jobs first
    const isIndianJob = (job: any) => {
      const loc = (job.location || '').toLowerCase();
      return loc.includes('india') || loc.includes('bangalore') || loc.includes('mumbai') ||
             loc.includes('delhi') || loc.includes('hyderabad') || loc.includes('pune') ||
             loc.includes('chennai') || loc.includes('kolkata') || loc.includes('ahmedabad') ||
             loc.includes('jaipur') || loc.includes('remote');
    };

    rankedJobs.sort((a, b) => {
      const aIsIndian = isIndianJob(a);
      const bIsIndian = isIndianJob(b);
      
      if (aIsIndian && !bIsIndian) return -1;
      if (!aIsIndian && bIsIndian) return 1;
      
      return b.matchScore - a.matchScore;
    });

    console.log(`Returning ${rankedJobs.length} jobs`);

    return NextResponse.json({
      success: true,
      total: rankedJobs.length,
      jobs: rankedJobs,
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
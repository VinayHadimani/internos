import { NextRequest, NextResponse } from 'next/server';
import { aggregateJobs } from '@/lib/aggregator';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Fallback search parameters
    const { 
      query = 'software developer', 
      location: bodyLocation = '', 
      skills = [], 
      experience = 'fresher',
      preferredRoles = [] 
    } = body;
    
    const userLocation = req.headers.get('x-user-location') || req.nextUrl.searchParams.get('location') || bodyLocation || 'India';
    
    console.log('=== MATCH DEBUG ===');
    console.log('User Skills:', skills);
    console.log('Experience:', experience);
    console.log('Preferred Roles:', preferredRoles);
    console.log('User Location:', userLocation);
    
    // Fetch both internships and general jobs
    console.log('Fetching internships and jobs from aggregator...');
    const searchTermsInternship = `${query} internship`;
    const searchTermsJob = `${query} job developer`;
    
    const internshipJobs = await aggregateJobs(searchTermsInternship, userLocation);
    const fullTimeJobs = await aggregateJobs(searchTermsJob, userLocation);
    
    // Combine and deduplicate
    const allJobsMap = new Map();
    for (const job of [...internshipJobs, ...fullTimeJobs]) {
      const key = `${job.title}-${job.company}`.toLowerCase();
      if (!allJobsMap.has(key)) {
        allJobsMap.set(key, job);
      }
    }
    const uniqueJobs = Array.from(allJobsMap.values());
    console.log(`Total unique jobs/internships found: ${uniqueJobs.length}`);

    // Helper to extract required tech skills from job text
    const extractRequiredSkills = (jobText: string): string[] => {
      const commonSkills = [
        'javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue',
        'node', 'nextjs', 'next.js', 'mongodb', 'sql', 'postgresql', 'mysql',
        'aws', 'docker', 'kubernetes', 'git', 'figma', 'ui/ux', 'machine learning',
        'data science', 'android', 'ios', 'flutter', 'react native', 'django',
        'flask', 'spring', 'express', 'tailwind', 'css', 'html', 'api', 'rest',
        'graphql', 'firebase', 'redux', 'c++', 'c#', 'go', 'rust', 'ruby', 'php'
      ];
      
      const found: string[] = [];
      for (const skill of commonSkills) {
        if (jobText.includes(skill)) {
          found.push(skill);
        }
      }
      return found;
    };
    
    // Helper to check language
    const isEnglish = (text: string): boolean => {
      if (!text) return true;
      const nonEnglishPatterns = /[\u0900-\u097F\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\u0400-\u04FF\u0600-\u06FF\u0E00-\u0E7F]/;
      if (nonEnglishPatterns.test(text)) return false;
      const asciiCount = (text.match(/[\x00-\x7F]/g) || []).length;
      return asciiCount / text.length > 0.95;
    };

    // Calculate match scores
    const userLocLower = userLocation.toLowerCase();
    const userLocCity = userLocLower.split(',')[0].trim();

    const rankedJobs = uniqueJobs.map(job => {
      const jobText = `${job.title} ${job.description || ''} ${job.company}`.toLowerCase();
      const jobLocation = (job.location || '').toLowerCase();
      
      // 1. Skills Match (50% weight)
      const requiredSkills = extractRequiredSkills(jobText);
      let skillMatches = 0;
      for (const reqSkill of requiredSkills) {
        for (const userSkill of skills) {
          if (reqSkill.toLowerCase().includes(userSkill.toLowerCase()) || userSkill.toLowerCase().includes(reqSkill.toLowerCase())) {
            skillMatches++;
            break;
          }
        }
      }
      const skillScore = requiredSkills.length > 0 ? (skillMatches / requiredSkills.length) * 100 : 50;

      // 2. Title/Role Match (30% weight)
      let roleScore = 50;
      for (const role of preferredRoles) {
        if (job.title.toLowerCase().includes(role.toLowerCase())) {
          roleScore = 100;
          break;
        }
      }
      
      // 3. Experience Match (20% weight)
      let expScore = 100; // Fresher/junior matches most internships
      if (experience === 'mid') expScore = 70;
      if (experience === 'senior') expScore = 50;

      // Apply Location boost implicitly or flag it
      const isRemote = jobLocation.includes('remote');
      const isLocMatch = isRemote || 
                         (userLocCity.length > 2 && jobLocation.includes(userLocCity)) || 
                         (userLocLower.includes('india') && jobLocation.includes('india'));
      
      const matchScore = Math.round((skillScore * 0.50) + (roleScore * 0.30) + (expScore * 0.20));
      
      let matchLabel = 'Low Match';
      if (matchScore >= 80) matchLabel = 'Excellent Match';
      else if (matchScore >= 60) matchLabel = 'Good Match';
      else if (matchScore >= 40) matchLabel = 'Moderate Match';

      const needsTranslation = !isEnglish(job.description || '') || !isEnglish(job.title);

      return {
        ...job,
        matchScore,
        matchLabel,
        locationMatch: isLocMatch,
        needsTranslation
      };
    });

    // Sort: Indian jobs first (by match score), then international (by match score)
    const INDIAN_CITIES = [
      'india', 'bangalore', 'bengaluru', 'mumbai', 'delhi', 'new delhi',
      'hyderabad', 'pune', 'chennai', 'kolkata', 'ahmedabad', 'jaipur',
      'noida', 'gurgaon', 'gurugram', 'kochi', 'coimbatore', 'indore',
      'chandigarh', 'nagpur', 'surat', 'bhopal', 'visakhapatnam'
    ];

    const isIndianJob = (job: any): boolean => {
      const location = (job.location || '').toLowerCase();
      if (INDIAN_CITIES.some(city => location.includes(city))) return true;
      if (job.isRemote || location.includes('remote')) return true;
      if (job.salary?.includes('INR') || job.salary?.includes('₹')) return true;
      return false;
    };

    rankedJobs.sort((a, b) => {
      const aIsIndian = isIndianJob(a);
      const bIsIndian = isIndianJob(b);
      
      if (aIsIndian && !bIsIndian) return -1;
      if (!aIsIndian && bIsIndian) return 1;
      
      return (b.matchScore || 0) - (a.matchScore || 0);
    });

    console.log(`Returning ${rankedJobs.length} ALL jobs (No 40% filter)`);

    return NextResponse.json({
      success: true,
      total: rankedJobs.length,
      jobs: rankedJobs,
      count: rankedJobs.length
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { success: false, error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
import axios from 'axios';

// ============================================
// ADZUNA API — Has real internship data
// Free tier: 100 calls/day
// ============================================

async function searchAdzuna(keywords: string, country: string = 'us') {
  const APP_ID = process.env.ADZUNA_APP_ID;
  const APP_KEY = process.env.ADZUNA_APP_KEY;
  
  if (!APP_ID || !APP_KEY) {
    console.warn('Adzuna API keys not set.');
    return [];
  }

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1`;
  
  try {
    const response = await axios.get(url, {
      params: {
        app_id: APP_ID,
        app_key: APP_KEY,
        results_per_page: 20,
        what: keywords,
        what_and: 'intern OR internship OR "summer analyst" OR "entry level"',
        content_type: 'application/json'
      }
    });
    
    return response.data.results || [];
  } catch (err) {
    console.warn(`Adzuna fetch failed: ${(err as any).message}`);
    return [];
  }
}

// ============================================
// REMOTIVE API — Free, no key needed
// Good for remote tech internships
// ============================================

async function searchRemotive(query: string) {
  try {
    const response = await axios.get('https://remotive.com/api/remote-jobs', {
      params: {
        search: query,
        limit: 20,
        category: 'software-dev'
      }
    });
    
    return response.data.jobs || [];
  } catch (err) {
    console.warn(`Remotive fetch failed: ${(err as any).message}`);
    return [];
  }
}

// ============================================
// GITHUB JOBS ALTERNATIVE — Jobicy
// Free API, no key needed
// ============================================

async function searchJobicy(query: string) {
  try {
    const response = await axios.get('https://jobicy.com/api/v2/remote-jobs', {
      params: {
        tag: query,
        count: 20,
        geo: 'worldwide'
      }
    });
    
    return response.data.jobs || [];
  } catch (err) {
    console.warn(`Jobicy fetch failed: ${(err as any).message}`);
    return [];
  }
}

// ============================================
// QUERY BUILDER — Domain to search terms
// ============================================

export function buildQueries(domains: string[], skills: string[]) {
  const queryMap: Record<string, string[]> = {
    'finance': [
      'investment banking summer analyst intern',
      'finance intern summer',
      'financial analyst intern',
      'private equity intern'
    ],
    'consulting': [
      'management consulting intern summer',
      'business analyst intern',
      'strategy consulting intern'
    ],
    'cs': [
      'software engineering intern summer',
      'SWE intern computer science',
      'backend developer intern'
    ],
    'aiml': [
      'machine learning intern',
      'AI engineer intern',
      'data science intern python'
    ],
    'fullstack': [
      'full stack developer intern',
      'React developer intern',
      'frontend intern javascript'
    ],
    'finance+cs': [
      'fintech intern summer',
      'quant research intern',
      'trading technology intern',
      'software engineer intern finance'
    ]
  };
  
  const queries = new Set<string>();
  
  for (const domain of domains) {
    const domainQueries = queryMap[domain] || [];
    domainQueries.forEach(q => queries.add(q));
  }
  
  // Add skill-specific queries
  const lowerSkills = skills.map((s: string) => s.toLowerCase());
  if (lowerSkills.includes('python')) {
    queries.add('python developer intern');
  }
  if (lowerSkills.includes('react')) {
    queries.add('react intern frontend');
  }
  if (lowerSkills.includes('java')) {
    queries.add('java developer intern');
  }
  if (lowerSkills.includes('c++')) {
    queries.add('c++ developer intern');
  }
  
  // Return minimum of one query just to be safe
  if (queries.size === 0) {
      queries.add('software engineer intern');
  }

  return [...Array.from(queries)].slice(0, 8); // max 8 queries
}

// ============================================
// MAIN FUNCTION — Domain-aware job search
// ============================================

export async function getRelevantJobs(studentProfile: any) {
  const { domains = [], skills = [], school_tier, location } = studentProfile;
  
  // Build domain-specific queries
  const queries = buildQueries(domains, skills);
  
  const allJobs = [];
  
  for (const query of queries) {
    try {
      // Try Adzuna first (best data)
      const adzunaJobs = await searchAdzuna(query, 'us'); // you can tweak country based on location
      allJobs.push(...adzunaJobs.map((j: any) => ({
        title: j.title,
        company: j.company.display_name,
        location: j.location.display_name,
        description: j.description,
        url: j.redirect_url,
        source: 'Adzuna'
      })));
      
    } catch (err: any) {
      console.log(`Adzuna failed for "${query}":`, err.message);
    }
    
    // Search Remotive for remote roles
    try {
      const remotiveJobs = await searchRemotive(query);
      allJobs.push(...remotiveJobs.map((j: any) => ({
        title: j.title,
        company: j.company_name,
        location: j.candidate_required_location || 'Remote',
        description: j.description,
        url: j.url,
        source: 'Remotive'
      })));
      
    } catch (err: any) {
      console.log(`Remotive failed for "${query}":`, err.message);
    }

    // Search Jobicy
    try {
      const jobicyJobs = await searchJobicy(query);
      allJobs.push(...jobicyJobs.map((j: any) => ({
        title: j.jobTitle,
        company: j.companyName,
        location: j.jobGeo || 'Remote',
        description: j.jobDescription,
        url: j.url,
        source: 'Jobicy'
      })));
    } catch (err: any) {
      console.log(`Jobicy failed for "${query}":`, err.message);
    }
    
    // Rate limit buffer (delay)
    await new Promise(r => setTimeout(r, 500));
  }
  
  return allJobs;
}

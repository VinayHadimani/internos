import axios from 'axios';

export interface Internship {
  id: string;
  title: string;
  company: string;
  location: string;
  stipend: string;
  duration: string;
  description: string;
  skills: string[];
  applyUrl: string;
  deadline: string;
  matchScore?: number;
  source?: string;
}

// LinkedIn jobs via RapidAPI JSearch (https://rapidapi.com/jsearch/api/jsearch)
// Free tier: 50 requests/month
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const JSEARCH_URL = 'https://jsearch.p.rapidapi.com/search';

function generateId(title: string, company: string): string {
  const slug = `${title}-${company}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
  return slug + '-' + Date.now().toString(36);
}

function estimateStipend(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('senior') || t.includes('lead')) return '₹40,000 - ₹60,000/month';
  if (t.includes('data') || t.includes('ml') || t.includes('machine learning')) return '₹30,000 - ₹50,000/month';
  if (t.includes('developer') || t.includes('engineer') || t.includes('software')) return '₹25,000 - ₹45,000/month';
  if (t.includes('design') || t.includes('ui') || t.includes('ux')) return '₹20,000 - ₹35,000/month';
  if (t.includes('marketing') || t.includes('content')) return '₹15,000 - ₹25,000/month';
  return '₹20,000 - ₹35,000/month';
}

function extractSkills(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const knownSkills = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'Go', 'Rust',
    'React', 'Angular', 'Vue', 'Next.js', 'Node.js', 'Express', 'Django', 'Flask',
    'SQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Firebase',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Git',
    'HTML', 'CSS', 'Tailwind', 'SASS', 'Figma', 'Adobe',
    'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy',
    'REST', 'GraphQL', 'API', 'Microservices', 'CI/CD', 'Agile',
    'Data Analysis', 'Excel', 'Tableau', 'Power BI', 'Statistics',
    'Marketing', 'SEO', 'Google Analytics', 'Social Media', 'Content Writing',
  ];
  return knownSkills.filter(s => text.includes(s.toLowerCase()));
}

// Scrape via JSearch API (RapidAPI)
async function scrapeViaJSearch(query: string = 'internship india', pages: number = 1): Promise<Internship[]> {
  if (!RAPIDAPI_KEY) {
    console.log('[LinkedIn Scraper] No RAPIDAPI_KEY set, skipping JSearch');
    return [];
  }

  const internships: Internship[] = [];

  try {
    for (let page = 1; page <= pages; page++) {
      console.log(`[LinkedIn Scraper] JSearch page ${page}: ${query}`);

      const { data } = await axios.get(JSEARCH_URL, {
        params: {
          query: `${query} internship`,
          page: page.toString(),
          num_pages: '1',
          country: 'in',
          date_posted: 'month',
        },
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        },
        timeout: 15000,
      });

      if (!data?.data) continue;

      for (const job of data.data) {
        const title = job.job_title || '';
        const company = job.employer_name || 'Company';
        const location = [job.job_city, job.job_state, job.job_country].filter(Boolean).join(', ') || 'remote';
        const description = job.job_description || '';
        const applyUrl = job.job_apply_link || job.job_google_link || '';
        const skills = extractSkills(title, description);

        internships.push({
          id: generateId(title, company),
          title,
          company,
          location,
          stipend: job.job_min_salary ? `₹${job.job_min_salary} - ₹${job.job_max_salary}/month` : estimateStipend(title),
          duration: 'Not specified',
          description: description.slice(0, 500),
          skills,
          applyUrl,
          deadline: 'Open',
          source: 'linkedin',
        });
      }

      // Delay between pages
      if (page < pages) await new Promise(r => setTimeout(r, 1500));
    }

    console.log(`[LinkedIn Scraper] JSearch returned ${internships.length} results`);
  } catch (error) {
    console.error('[LinkedIn Scraper] JSearch error:', error instanceof Error ? error.message : error);
  }

  return internships;
}

// Scrape LinkedIn public job search (limited, may be blocked)
async function scrapeLinkedInDirect(query: string = 'internship'): Promise<Internship[]> {
  try {
    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&location=India&f_E=1&sortBy=DD`;

    console.log(`[LinkedIn Scraper] Direct scrape: ${url}`);

    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 15000,
    });

    // LinkedIn serves limited HTML without login, parse what we can
    const internships: Internship[] = [];

    // Parse job cards from the HTML (basic regex, LinkedIn uses dynamic rendering)
    const titleRegex = /<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/gi;
    const companyRegex = /<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/gi;
    const locationRegex = /<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([^<]+)<\/span>/gi;

    const titles: string[] = [];
    const companies: string[] = [];
    const locations: string[] = [];

    let match;
    while ((match = titleRegex.exec(html)) !== null) titles.push(match[1].trim());
    while ((match = companyRegex.exec(html)) !== null) companies.push(match[1].trim());
    while ((match = locationRegex.exec(html)) !== null) locations.push(match[1].trim());

    for (let i = 0; i < Math.min(titles.length, 25); i++) {
      const title = titles[i] || 'Internship';
      const company = companies[i] || 'Company';

      internships.push({
        id: generateId(title, company),
        title,
        company,
        location: locations[i] || 'India',
        stipend: estimateStipend(title),
        duration: 'Not specified',
        description: `${title} position at ${company}.`,
        skills: extractSkills(title, ''),
        applyUrl: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(title)}`,
        deadline: 'Open',
        source: 'linkedin',
      });
    }

    console.log(`[LinkedIn Scraper] Direct scrape found ${internships.length} results`);
    return internships;
  } catch (error) {
    console.error('[LinkedIn Scraper] Direct scrape failed:', error instanceof Error ? error.message : error);
    return [];
  }
}

// Main export
export async function scrapeLinkedIn(query?: string): Promise<Internship[]> {
  console.log(`[LinkedIn Scraper] Searching: ${query || 'internship'}`);

  const searchQuery = query || 'internship';

  // Try JSearch API first (better data, needs API key)
  const jsearchResults = await scrapeViaJSearch(searchQuery);
  if (jsearchResults.length > 0) return jsearchResults;

  // Fallback to direct scrape
  const directResults = await scrapeLinkedInDirect(searchQuery);
  if (directResults.length > 0) return directResults;

  console.log('[LinkedIn Scraper] No results from any source');
  return [];
}

// Get job count for a query (useful for UI)
export async function getLinkedInJobCount(query: string): Promise<number> {
  try {
    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&location=India`;
    const { data: html } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000,
    });

    const match = html.match(/(\d[\d,]*)\s*results?/i);
    if (match) return parseInt(match[1].replace(/,/g, ''), 10);
    return 0;
  } catch {
    return 0;
  }
}

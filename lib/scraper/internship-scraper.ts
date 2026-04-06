import { scrapeUrl } from './browser';
import { extractInternships } from './extractor';

const INTERNSHIP_SOURCES = [
  {
    name: 'Internshala',
    baseUrl: 'https://internshala.com/internships',
    searches: ['python', 'web-development', 'data-science', 'marketing', 'design'],
  },
  {
    name: 'Unstop',
    baseUrl: 'https://unstop.com/internships',
    searches: ['engineering', 'marketing', 'design'],
  },
];

export interface ScrapedInternship {
  title: string;
  company: string;
  location: string;
  stipend: string;
  duration: string | null;
  description: string;
  skills: string[];
  link: string;
  deadline: string | null;
  source: string;
}

export async function scrapeAllInternships(apiKey: string): Promise<{
  internships: ScrapedInternship[];
  errors: string[];
}> {
  const allInternships: ScrapedInternship[] = [];
  const errors: string[] = [];

  for (const source of INTERNSHIP_SOURCES) {
    for (const search of source.searches) {
      try {
        console.log(`Scraping ${source.name}: ${search}`);
        
        const url = `${source.baseUrl}/${search}`;
        const html = await scrapeUrl(url);
        const internships = await extractInternships(html, apiKey);

        console.log(`Found ${internships.length} internships`);

        for (const job of internships) {
          allInternships.push({
            title: job.title || 'Untitled',
            company: job.company || 'Unknown',
            location: job.location || 'Not specified',
            stipend: job.stipend || 'Not disclosed',
            duration: job.duration || null,
            description: job.description || '',
            skills: job.skills || [],
            link: job.link || '',
            deadline: job.deadline || null,
            source: source.name.toLowerCase(),
          });
        }

        await sleep(2000);
      } catch (error: any) {
        console.error(`Failed ${source.name} - ${search}:`, error.message);
        errors.push(`${source.name}/${search}: ${error.message}`);
      }
    }
  }

  return { internships: allInternships, errors };
}

export async function scrapeSingleUrl(url: string, apiKey: string): Promise<ScrapedInternship[]> {
  const html = await scrapeUrl(url);
  const internships = await extractInternships(html, apiKey);
  
  return internships.map(job => ({
    title: job.title || 'Untitled',
    company: job.company || 'Unknown',
    location: job.location || 'Not specified',
    stipend: job.stipend || 'Not disclosed',
    duration: job.duration || null,
    description: job.description || '',
    skills: job.skills || [],
    link: job.link || '',
    deadline: job.deadline || null,
    source: 'custom',
  }));
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
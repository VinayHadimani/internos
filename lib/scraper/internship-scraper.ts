import { scrapeUrl } from './browser';
import { extractInternships, extractSkillsFromJD } from './extractor';
import { createServerClient } from '@/lib/supabase/server';

const INTERNSHIP_SOURCES = [
  {
    name: 'Internshala',
    baseUrl: 'https://internshala.com/internships',
    searches: ['python', 'web-development', 'data-science', 'machine-learning', 'marketing', 'design'],
  },
  {
    name: 'Unstop',
    baseUrl: 'https://unstop.com/internships',
    searches: ['engineering', 'marketing', 'design'],
  },
];

export async function scrapeAndSeedInternships(): Promise<{
  inserted: number;
  skipped: number;
  errors: number;
}> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const supabase = await createServerClient();
  const results = { inserted: 0, skipped: 0, errors: 0 };

  for (const source of INTERNSHIP_SOURCES) {
    for (const search of source.searches) {
      try {
        console.log(`Scraping ${source.name}: ${search}`);

        const url = `${source.baseUrl}/${search}`;
        const html = await scrapeUrl(url);
        const internships = await extractInternships(html, apiKey);

        console.log(`Found ${internships.length} internships`);

        for (const job of internships) {
          try {
            // Check for duplicates
            const { data: existing } = await supabase
              .from('internships')
              .select('id')
              .eq('external_url', job.link || '')
              .single();

            if (existing) {
              results.skipped++;
              continue;
            }

            // Extract skills
            const skills = await extractSkillsFromJD(job.description || '', apiKey);

            // Insert
            const { error } = await supabase
              .from('internships')
              .insert({
                title: job.title || 'Untitled',
                company: job.company || 'Unknown',
                location: job.location || 'Not specified',
                stipend: job.stipend || 'Not disclosed',
                duration: job.duration || null,
                description: job.description || '',
                skills_required: skills.length > 0 ? skills : (job.skills || []),
                source: source.name.toLowerCase(),
                external_url: job.link || '',
                posted_date: new Date().toISOString().split('T')[0],
                deadline: job.deadline || null,
                is_active: true,
              });

            if (error) {
              console.error('Insert error:', error);
              results.errors++;
            } else {
              results.inserted++;
            }

            // Rate limiting
            await sleep(1000);
          } catch (err) {
            results.errors++;
          }
        }

        // Wait between searches
        await sleep(2000);
      } catch (error: any) {
        console.error(`Failed ${source.name} - ${search}:`, error.message);
        results.errors++;
      }
    }
  }

  return results;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

import axios from 'axios';
import * as cheerio from 'cheerio';

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
}

const BASE_URL = 'https://internshala.com';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function generateId(title: string, company: string): string {
  const slug = `${title}-${company}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
  return slug + '-' + Date.now().toString(36);
}

async function scrapePage(url: string): Promise<Internship[]> {
  const internships: Internship[] = [];

  try {
    console.log(`[Internshala Scraper] Fetching: ${url}`);

    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(html);

    // Each internship card
    $('.internship_meta, .individual_internship, .container-fluid, .internship-card').each((_, el) => {
      const card = $(el);

      // Try multiple selectors for title
      const title = card.find('.job-internship-name, .profile, h3 a, .heading_4_5 a, a.job-title-href').first().text().trim()
        || card.find('a.job-title-href').text().trim()
        || card.find('.heading_4_5').text().trim();

      if (!title || title.toLowerCase().includes('internship') && title.length < 5) return; // Skip empty/invalid cards

      // Company
      const company = card.find('.company_name, .company-name, .heading_6 a, .company_and_premium').first().text().trim()
        || 'Company';

      // Location
      const location = card.find('.location_link, .locations, .location_name, #location_names').first().text().trim()
        || 'remote';

      // Stipend
      const stipend = card.find('.stipend, .salary, .stipend_container').first().text().trim()
        || 'Unpaid';

      // Duration
      const duration = card.find('.duration, .other_detail_item span, .item_body').filter((_, el) =>
        $(el).text().toLowerCase().includes('month')
      ).first().text().trim() || 'Not specified';

      // Apply link
      let applyUrl = card.find('a.view_detail_button, a[href*="/internship/detail/"], a[href*="/job/detail/"]').attr('href') || '';
      if (applyUrl && !applyUrl.startsWith('http')) {
        applyUrl = `${BASE_URL}${applyUrl}`;
      }

      // Skills
      const skills: string[] = [];
      card.find('.round_tabs, .round_tabs_container a, .skill_tag, .tags a, .skill-tag').each((_, skill) => {
        const skillText = $(skill).text().trim();
        if (skillText && !skills.includes(skillText)) skills.push(skillText);
      });

      // Deadline
      const deadline = card.find('.apply_by .item_body, .deadline, .item_body').first().text().trim()
        || 'Open';

      internships.push({
        id: generateId(title, company),
        title,
        company,
        location,
        stipend,
        duration,
        description: `${title} internship at ${company}. Location: ${location}. Duration: ${duration}. Stipend: ${stipend}.`,
        skills,
        applyUrl: applyUrl || `${BASE_URL}/internships`,
        deadline,
      });
    });

    console.log(`[Internshala Scraper] Found ${internships.length} internships on page`);
  } catch (error) {
    console.error('[Internshala Scraper] Page fetch error:', error instanceof Error ? error.message : error);
  }

  return internships;
}

export async function scrapeInternshala(query?: string, maxPages: number = 2): Promise<Internship[]> {
  const allInternships: Internship[] = [];

  console.log(`[Internshala Scraper] Starting scrape${query ? ` for: ${query}` : ''}`);

  for (let page = 1; page <= maxPages; page++) {
    let url: string;

    if (query) {
      url = page === 1
        ? `${BASE_URL}/internships/keywords-${encodeURIComponent(query)}`
        : `${BASE_URL}/internships/keywords-${encodeURIComponent(query)}/page-${page}`;
    } else {
      url = page === 1
        ? `${BASE_URL}/internships`
        : `${BASE_URL}/internships/page-${page}`;
    }

    const internships = await scrapePage(url);
    allInternships.push(...internships);

    // Delay between pages to avoid being blocked
    if (page < maxPages) {
      console.log(`[Internshala Scraper] Waiting 2s before next page...`);
      await delay(2000);
    }
  }

  // Remove duplicates by title+company
  const seen = new Set<string>();
  const unique = allInternships.filter(i => {
    const key = `${i.title}-${i.company}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[Internshala Scraper] Total unique internships: ${unique.length}`);

  return unique;
}

// Scrape individual internship detail page
export async function scrapeInternshipDetail(url: string): Promise<Partial<Internship> | null> {
  try {
    console.log(`[Internshala Scraper] Fetching detail: ${url}`);

    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(html);

    const title = $('h1, .heading_1').first().text().trim();
    const company = $('.company_name, .heading_6 a').first().text().trim();
    const location = $('.location_link, .locations').first().text().trim();
    const stipend = $('.stipend, .salary').first().text().trim();
    const duration = $('.duration, .other_detail_item').filter((_, el) =>
      $(el).text().toLowerCase().includes('month')
    ).first().text().trim();

    // Full description
    const descriptionParts: string[] = [];
    $('.text-container, .internship_details, .about_company p, .about_job p').each((_, el) => {
      const text = $(el).text().trim();
      if (text) descriptionParts.push(text);
    });
    const description = descriptionParts.join('\n\n') || title;

    // Skills
    const skills: string[] = [];
    $('.round_tabs_container a, .skill_tag, .tags a').each((_, el) => {
      const skill = $(el).text().trim();
      if (skill) skills.push(skill);
    });

    const deadline = $('.apply_by .item_body, .deadline').first().text().trim() || 'Open';

    return {
      title,
      company,
      location,
      stipend,
      duration,
      description,
      skills,
      deadline,
    };
  } catch (error) {
    console.error('[Internshala Scraper] Detail fetch error:', error instanceof Error ? error.message : error);
    return null;
  }
}

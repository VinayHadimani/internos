// AI call removed — parseJobQuery no longer needs it (search route handles AI)
import * as cheerio from 'cheerio'
import { normalizeSalary, type SalaryInfo } from '@/lib/utils/salary'

// Add this helper function at the top:
function cleanText(text: string): string {
  if (!text) return '';
  
  return text
    // Fix HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Fix mojibake (encoding errors)
    .replace(/â€"/g, '-')
    .replace(/â€˜/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/Ã¢â‚¬â€œ/g, '-')
    .replace(/Ã¢â‚¬â„¢/g, "'")
    .replace(/Ã‚Â/g, '')
    .replace(/Â/g, '')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

// ─── Interfaces ──────────────────────────────────────────────
export interface JobResult {
  title: string
  company: string
  location: string
  salary: string
  salaryObj: SalaryInfo | null
  url: string
  source: string
  type: string
  description?: string
  postedAt?: string | Date
  locationScore?: number
}

/**
 * Normalize a date value to ISO 8601 string.
 */
function normalizeDate(value: unknown): string | undefined {
  if (!value) return undefined
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isNaN(time) ? undefined : value.toISOString()
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try { return new Date(value).toISOString() } catch { return undefined }
  }
  if (typeof value === 'number') {
    const ts = value > 1e12 ? value : value * 1000
    try { return new Date(ts).toISOString() } catch { return undefined }
  }
  if (typeof value === 'string') {
    try { return new Date(value).toISOString() } catch { return undefined }
  }
  return undefined
}

function getPostedAtTimestamp(value: string | Date | undefined): number | null {
  if (!value) return null
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Parse relative posting timestamps from free-form text.
 */
function parseRelativePostedAt(text: string): string | undefined {
  if (!text) return undefined
  const normalized = text.toLowerCase()

  if (/\bposted\s+today\b/.test(normalized)) {
    return new Date().toISOString()
  }
  if (/\bposted\s+yesterday\b/.test(normalized)) {
    return new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString()
  }

  const match = normalized.match(/\bposted\s+(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago\b/)
  if (!match) return undefined

  const amount = Number(match[1])
  const unit = match[2]
  if (!Number.isFinite(amount)) return undefined

  const now = new Date()
  switch (unit) {
    case 'minute': now.setMinutes(now.getMinutes() - amount); break
    case 'hour': now.setHours(now.getHours() - amount); break
    case 'day': now.setDate(now.getDate() - amount); break
    case 'week': now.setDate(now.getDate() - (amount * 7)); break
    case 'month': now.setMonth(now.getMonth() - amount); break
    case 'year': now.setFullYear(now.getFullYear() - amount); break
    default: return undefined
  }

  return now.toISOString()
}

export interface ParsedQuery {
  keywords: string[]
  job_type: string
  location: string
}

// ─── Query Parser (NO AI — just string parsing) ─────────────
export async function parseJobQuery(query: string): Promise<ParsedQuery> {
  let job_type = ''
  const lower = query.toLowerCase()
  if (lower.includes('internship') || lower.includes('intern')) job_type = 'internship'
  else if (lower.includes('full-time') || lower.includes('full time')) job_type = 'full-time'
  else if (lower.includes('part-time') || lower.includes('part time')) job_type = 'part-time'
  else if (lower.includes('contract')) job_type = 'contract'
  
  let location = ''
  const locationPatterns = ['remote', 'india', 'us', 'usa', 'uk', 'germany', 'europe']
  for (const loc of locationPatterns) {
    if (lower.includes(loc)) { location = loc; break }
  }
  
  const keywords = query
    .split(/\s+/)
    .filter(w => w.length > 1)
    .filter(w => !['the', 'and', 'for', 'a', 'an', 'in', 'at', 'of', 'to', 'or'].includes(w.toLowerCase()))
  
  if (keywords.length === 0) {
    return { keywords: [query || 'internship'], job_type, location }
  }
  
  return { keywords, job_type, location }
}

/**
 * Sanitize a job description: strip HTML, trim whitespace, limit to 2500 chars.
 */
function sanitizeDescription(raw: string): string {
  if (!raw) return ''
  
  let processed = raw.replace(/<(div|p|br|li|h[1-6]|tr)[^>]*>/gi, ' ');
  processed = processed.replace(/<[^>]*>/g, ' ')
  
  processed = processed
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/\u2011/g, '-')
    .replace(/â/g, '-')
  
  const stripped = processed.replace(/\s+/g, ' ').trim()
  
  return stripped.length > 2500 ? stripped.substring(0, 2500) + '...' : stripped
}

// ─── Location Matching ───────────────────────────────────────

const LOCATION_ALIASES: Record<string, string[]> = {
  'gurgaon': ['gurgaon', 'gurugram', 'delhi ncr', 'ncr', 'delhi'],
  'bangalore': ['bangalore', 'bengaluru', 'karnataka'],
  'mumbai': ['mumbai', 'bombay', 'maharashtra', 'navi mumbai', 'thane'],
  'pune': ['pune', 'maharashtra'],
  'hyderabad': ['hyderabad', 'telangana', 'secunderabad'],
  'chennai': ['chennai', 'tamil nadu'],
  'kolkata': ['kolkata', 'calcutta', 'west bengal'],
  'delhi': ['delhi', 'new delhi', 'delhi ncr', 'ncr'],
  'noida': ['noida', 'uttar pradesh', 'delhi ncr', 'ncr'],
  'remote': ['remote', 'work from home', 'wfh', 'anywhere', 'work from anywhere'],
  'india': ['india'],
}

function normalizeLocation(loc: string): string {
  const lower = loc.toLowerCase().trim()
  for (const [canonical, aliases] of Object.entries(LOCATION_ALIASES)) {
    if (aliases.some((alias) => lower.includes(alias))) {
      return canonical
    }
  }
  return lower
}

export function calculateLocationMatch(jobLocation: string, preferredLocation: string): number {
  if (!preferredLocation || preferredLocation.trim() === '') return 0.5

  const jobNorm = normalizeLocation(jobLocation)
  const prefNorm = normalizeLocation(preferredLocation)

  if (jobNorm === prefNorm) return 1.0
  if (jobNorm.includes(prefNorm) || prefNorm.includes(jobNorm)) return 0.9

  for (const aliases of Object.values(LOCATION_ALIASES)) {
    const jobInGroup = aliases.some((a) => jobNorm.includes(a))
    const prefInGroup = aliases.some((a) => prefNorm.includes(a))
    if (jobInGroup && prefInGroup) return 0.9
  }

  const isJobRemote = ['remote', 'work from home', 'wfh', 'anywhere'].some((r) => jobNorm.includes(r))
  const isPrefRemote = ['remote', 'work from home', 'wfh', 'anywhere'].some((r) => prefNorm.includes(r))

  if (isJobRemote && isPrefRemote) return 1.0
  if (isJobRemote && !isPrefRemote) return 0.3
  if (!isJobRemote && isPrefRemote) return 0.2

  const isJobIndia = jobNorm.includes('india') || ['bangalore', 'mumbai', 'delhi', 'gurgaon', 'pune', 'hyderabad', 'chennai', 'kolkata', 'noida'].includes(jobNorm)
  const isPrefIndia = prefNorm.includes('india') || ['bangalore', 'mumbai', 'delhi', 'gurgaon', 'pune', 'hyderabad', 'chennai', 'kolkata', 'noida'].includes(prefNorm)
  if (isJobIndia && isPrefIndia) return 0.7

  return 0
}

// ─── Source Priority ─────────────────────────────────────────

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
}

const SOURCE_PRIORITY: Record<string, number> = {
  'Internshala': 1,
  'Adzuna': 2,
  'JSearch': 3,
  'Remotive': 4,
  'Himalayas': 5,
  'RemoteOK': 6,
  'WeWorkRemotely': 7,
  'Arbeitnow': 8,
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runFetchersInParallel(
  keywords: string[],
  location: string
): Promise<{
  remotive: JobResult[]
  himalayas: JobResult[]
  remoteOK: JobResult[]
  adzuna: JobResult[]
  jsearch: JobResult[]
  internshala: JobResult[]
  wework: JobResult[]
  arbeitnow: JobResult[]
}> {
  const [
    remotiveResult,
    himalayasResult,
    remoteOKResult,
    adzunaResult,
    jsearchResult,
    internshalaResult,
    weworkResult,
    arbeitnowResult,
  ] = await Promise.allSettled([
    fetchRemotive(keywords),
    fetchHimalayas(keywords),
    fetchRemoteOK(keywords),
    fetchAdzuna(keywords, location),
    fetchJSearch(keywords),
    fetchInternshala(keywords),
    fetchWeWorkRemotely(keywords),
    fetchArbeitnow(keywords),
  ])

  const extract = (result: PromiseSettledResult<JobResult[]>, name: string): JobResult[] => {
    if (result.status === 'fulfilled') return result.value
    console.log(`[Aggregator] ${name} failed:`, result.reason)
    return []
  }

  return {
    remotive: extract(remotiveResult, 'Remotive'),
    himalayas: extract(himalayasResult, 'Himalayas'),
    remoteOK: extract(remoteOKResult, 'RemoteOK'),
    adzuna: extract(adzunaResult, 'Adzuna'),
    jsearch: extract(jsearchResult, 'JSearch'),
    internshala: extract(internshalaResult, 'Internshala'),
    wework: extract(weworkResult, 'WeWorkRemotely'),
    arbeitnow: extract(arbeitnowResult, 'Arbeitnow'),
  }
}

// ─── Tier 1: Free API Fetchers ───────────────────────────────

async function parseRSSFeed(url: string): Promise<JobResult[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ScraperOS/1.0' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []

    const xml = await res.text()
    const $ = cheerio.load(xml, { xmlMode: true })

    const items: JobResult[] = []
    $('item').each((_, el) => {
      const title = $(el).find('title').text().trim()
      const link = $(el).find('link').text().trim()
      const description = $(el).find('description').text().trim()
      const postedAt = parseRelativePostedAt(description) || normalizeDate($(el).find('pubDate').text().trim())

      const companyMatch = description.match(/by\s+([A-Z][A-Za-z\s&.]+)/)
      const company = companyMatch ? companyMatch[1].trim() : 'Unknown'

      const locationMatch = description.match(/(?:location|based in|in)\s*:?\s*([A-Za-z\s,]+)/i)
      const location = locationMatch ? locationMatch[1].trim().split(',')[0].trim() : 'India'

      const salaryMatch = description.match(/₹[\d,]+(?:\s*-\s*₹[\d,]+)?(?:\s*\/\s*month)?/i)
      const salary = salaryMatch ? salaryMatch[0] : ''

      items.push({
        title,
        company,
        location: location || 'India',
        salary,
        salaryObj: normalizeSalary(salary),
        url: link,
        source: 'Internshala',
        type: 'Internship',
        description: sanitizeDescription(description),
        postedAt,
      })
    })

    return items
  } catch (err) {
    console.log(`[Aggregator] RSS parse failed for ${url}:`, err)
    return []
  }
}

const INTERN_SHALA_PROFILES: Record<string, string> = {
  'ai': 'artificial-intelligence',
  'artificial intelligence': 'artificial-intelligence',
  'machine learning': 'machine-learning',
  'web': 'web-development',
  'web development': 'web-development',
  'python': 'python',
  'data': 'data-science',
  'data science': 'data-science',
  'java': 'java',
  'android': 'android-app-development',
  'ios': 'ios-app-development',
  'react': 'react-js',
  'frontend': 'web-development',
  'backend': 'backend-development',
  'full stack': 'full-stack-development',
  'devops': 'devops',
  'cloud': 'cloud-computing',
  'cyber': 'cyber-security',
  'blockchain': 'blockchain',
  'design': 'graphic-design',
  'marketing': 'digital-marketing',
  'content': 'content-writing',
  'video': 'video-editing',
  'finance': 'finance',
  'hr': 'human-resources',
  'business': 'business-analytics',
  'consulting': 'management',
  'management': 'management',
  'strategy': 'management',
  'analyst': 'business-analytics',
  'analytics': 'business-analytics',
  'accounting': 'accounting',
  'audit': 'accounting',
  'operations': 'operations',
  'supply chain': 'operations',
  'logistics': 'operations',
  'sales': 'sales',
  'legal': 'law',
  'law': 'law',
  'research': 'research',
  'market research': 'market-research',
  'economics': 'economics',
  'investment': 'finance',
  'banking': 'finance',
  'product': 'product-management',
}

export async function fetchInternshala(keywords: string[]): Promise<JobResult[]> {
  try {
    const profiles = new Set<string>()
    for (const kw of keywords) {
      const lower = kw.toLowerCase()
      if (INTERN_SHALA_PROFILES[lower]) {
        profiles.add(INTERN_SHALA_PROFILES[lower])
      } else {
        const match = Object.entries(INTERN_SHALA_PROFILES).find(([key]) => lower.includes(key))
        if (match) {
          profiles.add(match[1])
        } else {
          profiles.add(lower.replace(/\s+/g, '-'))
        }
      }
    }

    const feedUrls = [...profiles].map(
      (profile) => `https://internshala.com/rss/internships/profile-${profile}`
    )

    const results = await Promise.all(feedUrls.map(parseRSSFeed))
    return results.flat()
  } catch (err) {
    console.log('[Aggregator] Internshala fetch failed:', err)
    return []
  }
}

export async function fetchRemotive(keywords: string[]): Promise<JobResult[]> {
  const source = 'Remotive'
  try {
    const remotiveSearch = encodeURIComponent(keywords.join(' '));
    console.log(`[${source}] Fetching: ${keywords.join(', ')}`)
    
    const res = await fetch(`https://remotive.com/api/remote-jobs?search=${remotiveSearch}&limit=25`, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(5000),
    })
    console.log(`[${source}] Response status: ${res.status}`)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.log(`[${source}] Error body (first 500): ${body.substring(0, 500)}`)
      return []
    }
    const data = await res.json()
    const jobs = data.jobs || []
    
    const realJobs = jobs.filter((job: Record<string, unknown>) => 
      typeof job.title === 'string' && job.title.length > 0 && 
      typeof job.company_name === 'string'
    );
    console.log(`[${source}] Filtered to ${realJobs.length} real jobs (from ${jobs.length} total)`);
    
    if (realJobs.length === 0) {
      console.log(`[${source}] Empty response keys: ${Object.keys(data).join(', ')}`)
      console.log(`[${source}] Response preview: ${JSON.stringify(data).substring(0, 500)}`)
    }
    return realJobs.map((job: Record<string, unknown>) => {
      const rawSalary = String(job.salary || '')
      const rawDescription = String(job.description || '')
      return {
        title: String(job.title || ''),
        company: String(job.company_name || ''),
        location: String(job.candidate_required_location || job.location || ''),
        salary: rawSalary,
        salaryObj: normalizeSalary(rawSalary),
        url: String(job.url || job.public_url || ''),
        source: 'Remotive',
        type: String(job.job_type || ''),
        description: sanitizeDescription(rawDescription),
        postedAt: normalizeDate(job.publication_date || job.posted_at || job.created_at),
      }
    })
  } catch (err) {
    console.log(`[${source}] Fetch failed:`, err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) console.log(`[${source}] Stack:`, err.stack.split('\n').slice(0, 3).join('\n'))
    return []
  }
}

export async function fetchHimalayas(keywords: string[]): Promise<JobResult[]> {
  const source = 'Himalayas'
  console.log(`[${source}] Himalayas API is deprecated, skipping for now.`);
  return []
}

export async function fetchRemoteOK(keywords: string[]): Promise<JobResult[]> {
  const source = 'RemoteOK'
  try {
    console.log(`[${source}] Fetching: ${keywords.join(', ')} | URL: https://remoteok.com/api`)
    const res = await fetch('https://remoteok.com/api', {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(5000),
    })
    console.log(`[${source}] Response status: ${res.status}`)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.log(`[${source}] Error body (first 500): ${body.substring(0, 500)}`)
      return []
    }
    const text = await res.text()
    console.log(`[${source}] Response length: ${text.length} chars`)
    const data = JSON.parse(text)
    const jobs = Array.isArray(data) ? data.slice(1) : []
    console.log(`[${source}] Returned ${jobs.length} raw items`)

    const keywordSet = keywords.map(k => k.toLowerCase())
    const filtered = jobs.filter((job: Record<string, unknown>) => {
      const title = String(job.position || '').toLowerCase()
      const desc = String(job.description || '').toLowerCase()
      const company = String(job.company || '').toLowerCase()
      const tags = String(job.tags || '').toLowerCase()
      const location = String(job.location || '').toLowerCase()
      const allText = `${title} ${desc} ${company} ${tags} ${location}`
      return keywordSet.some(k => allText.includes(k))
    })
    console.log(`[${source}] Filtered down to ${filtered.length} items`)

    if (filtered.length === 0 && jobs.length > 0) {
      return []
    }

    return filtered.map((job: Record<string, unknown>) => {
      const rawSalary = String(job.salary || '')
      const rawDescription = String(job.description || '')
      return {
        title: String(job.position || ''),
        company: String(job.company || ''),
        location: String(job.location || ''),
        salary: rawSalary,
        salaryObj: normalizeSalary(rawSalary),
        url: job.url ? (String(job.url).startsWith('http') ? String(job.url) : `https://remoteok.com${job.url}`) : '',
        source: 'RemoteOK',
        type: String(job.job_type || ''),
        description: sanitizeDescription(rawDescription),
        postedAt: normalizeDate(job.date || job.epoch),
      }
    })
  } catch (err) {
    console.log(`[${source}] Fetch failed:`, err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) console.log(`[${source}] Stack:`, err.stack.split('\n').slice(0, 3).join('\n'))
    return []
  }
}

export async function fetchWeWorkRemotely(keywords: string[]): Promise<JobResult[]> {
  const source = 'WeWorkRemotely'
  try {
    const categories = [
      'remote-programming-jobs',
      'remote-customer-service-jobs',
      'remote-sales-jobs',
      'remote-design-jobs',
      'remote-devops-jobs',
    ]

    console.log(`[${source}] Fetching ${categories.length} categories for: ${keywords.join(', ')}`)

    const results = await Promise.all(
      categories.map(async (cat) => {
        const url = `https://weworkremotely.com/categories/${cat}.json`
        try {
          const res = await fetch(url, {
            headers: BROWSER_HEADERS,
            signal: AbortSignal.timeout(5000),
          })
          if (!res.ok) return []
          const data = await res.json()
          return data.jobs || []
        } catch {
          return []
        }
      }),
    )

    const allJobs = results.flat()
    console.log(`[${source}] Returned ${allJobs.length} raw items across ${categories.length} categories`)

    const keywordSet = keywords.map(k => k.toLowerCase())
    const filtered = allJobs.filter((job: Record<string, unknown>) => {
      const title = String(job.title || '').toLowerCase()
      const desc = String(job.description || '').toLowerCase()
      const company = String(job.company || '').toLowerCase()
      const allText = `${title} ${desc} ${company}`
      return keywordSet.some(k => allText.includes(k))
    })
    console.log(`[${source}] Filtered down to ${filtered.length} items`)

    if (filtered.length === 0) {
      console.log(`[${source}] No keyword matches, returning empty.`)
      return []
    }

    return filtered.map((job: Record<string, unknown>) => {
      const rawSalary = String(job.salary || 'Not specified')
      const rawDescription = String(job.description || '')
      const jobUrl = String(job.url || '')
      return {
        title: String(job.title || ''),
        company: String(job.company || ''),
        location: 'Remote',
        salary: rawSalary,
        salaryObj: normalizeSalary(rawSalary),
        url: jobUrl.startsWith('http') ? jobUrl : `https://weworkremotely.com${jobUrl}`,
        source: 'WeWorkRemotely',
        type: 'Full-time',
        description: sanitizeDescription(rawDescription),
        postedAt: normalizeDate(job.date || job.published_at || job.created_at),
      }
    })
  } catch (err) {
    console.log(`[${source}] Fetch failed:`, err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) console.log(`[${source}] Stack:`, err.stack.split('\n').slice(0, 3).join('\n'))
    return []
  }
}

export async function fetchArbeitnow(keywords: string[]): Promise<JobResult[]> {
  const source = 'Arbeitnow'
  try {
    console.log(`[${source}] Starting fetch for: ${keywords.join(', ')}`)
    const res = await fetch('https://arbeitnow.com/api/job-board-api', {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(5000),
    })
    console.log(`[${source}] Response status: ${res.status}`)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.log(`[${source}] Error body (first 500): ${body.substring(0, 500)}`)
      return []
    }
    const data = await res.json()
    const jobs = data.data || []
    console.log(`[${source}] Total jobs before filter: ${jobs.length}`)
    if (jobs.length === 0) {
      console.log(`[${source}] Response keys: ${Object.keys(data).join(', ')}`)
      console.log(`[${source}] Response preview: ${JSON.stringify(data).substring(0, 500)}`)
    }

    const keywordSet = keywords.map(k => k.toLowerCase())
    const filtered = jobs.filter((job: Record<string, unknown>) => {
      const title = String(job.title || '').toLowerCase()
      const desc = String(job.description || '').toLowerCase()
      return keywordSet.some(k => title.includes(k) || desc.includes(k))
    })
    console.log(`[${source}] Results after keyword filter: ${filtered.length}`)

    // FALLBACK: return first 20 even if no keyword matches
    if (filtered.length === 0 && jobs.length > 0) {
      console.log(`[${source}] No keyword matches, returning first ${Math.min(20, jobs.length)} as fallback`)
      return jobs.slice(0, 20).map((job: Record<string, unknown>) => {
        const rawSalary = String(job.salary || 'Not specified')
        const rawDescription = String(job.description || '')
        return {
          title: String(job.title || ''),
          company: String(job.company_name || job.company || ''),
          location: String(job.location || 'Remote'),
          salary: rawSalary,
          salaryObj: normalizeSalary(rawSalary),
          url: String(job.url || ''),
          source: 'Arbeitnow',
          type: String(job.job_type || 'Full-time'),
          description: sanitizeDescription(rawDescription),
          postedAt: normalizeDate(job.created_at || job.created || job.published_at),
        }
      })
    }

    return filtered.map((job: Record<string, unknown>) => {
      const rawSalary = String(job.salary || 'Not specified')
      const rawDescription = String(job.description || '')
      return {
        title: String(job.title || ''),
        company: String(job.company_name || job.company || ''),
        location: String(job.location || 'Remote'),
        salary: rawSalary,
        salaryObj: normalizeSalary(rawSalary),
        url: String(job.url || ''),
        source: 'Arbeitnow',
        type: String(job.job_type || 'Full-time'),
        description: sanitizeDescription(rawDescription),
        postedAt: normalizeDate(job.created_at || job.created || job.published_at),
      }
    })
  } catch (err) {
    console.log(`[${source}] Fetch failed:`, err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) console.log(`[${source}] Stack:`, err.stack.split('\n').slice(0, 3).join('\n'))
    return []
  }
}

// ─── Tier 2: Authenticated API Fetchers ──────────────────────

export async function fetchAdzuna(keywords: string[], location: string): Promise<JobResult[]> {
  const source = 'Adzuna'
  try {
    const appId = process.env.ADZUNA_APP_ID
    const appKey = process.env.ADZUNA_APP_KEY
    if (!appId || !appKey) {
      console.log(`[${source}] Skipping: no API keys configured`)
      return []
    }

    const what = keywords.join(' ')
    const where = location || 'India'
    const url = `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=20&what=${encodeURIComponent(what)}&where=${encodeURIComponent(where)}`
    console.log(`[${source}] Starting fetch for: ${keywords.join(', ')} | Location: ${where}`)

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    console.log(`[${source}] Response status: ${res.status}`)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.log(`[${source}] Error body (first 500): ${body.substring(0, 500)}`)
      return []
    }
    const data = await res.json()
    const results = data.results || []
    console.log(`[${source}] Results returned: ${results.length}`)
    if (results.length === 0) {
      console.log(`[${source}] Response preview: ${JSON.stringify(data).substring(0, 500)}`)
    }

    return results.map((job: Record<string, unknown>) => {
      const rawSalary = job.salary_min && job.salary_max
        ? `₹${Number(job.salary_min).toLocaleString()} - ₹${Number(job.salary_max).toLocaleString()}`
        : String(job.salary || '')
      const rawDescription = String(job.description || job.adref || '')
      return {
        title: String(job.title || ''),
        company: String((job.company as Record<string, unknown>)?.display_name || job.company || ''),
        location: String((job.location as Record<string, unknown>)?.display_name || job.location || ''),
        salary: rawSalary,
        salaryObj: normalizeSalary(rawSalary),
        url: String(job.redirect_url || ''),
        source: 'Adzuna',
        type: String(job.contract_type || job.contract_time || ''),
        description: sanitizeDescription(rawDescription),
        postedAt: normalizeDate(job.created || job.publication_date),
      }
    })
  } catch (err) {
    console.log(`[${source}] Fetch failed:`, err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) console.log(`[${source}] Stack:`, err.stack.split('\n').slice(0, 3).join('\n'))
    return []
  }
}

export async function fetchJSearch(keywords: string[]): Promise<JobResult[]> {
  const source = 'JSearch'
  try {
    const apiKey = process.env.JSEARCH_API_KEY
    if (!apiKey) {
      console.log(`[${source}] Skipping: no API key configured`)
      return []
    }

    const query = keywords.join(' ')
    const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1&num_pages=2`
    console.log(`[${source}] Starting fetch for: ${keywords.join(', ')} | URL: ${url}`)

    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
      signal: AbortSignal.timeout(5000),
    })
    console.log(`[${source}] Response status: ${res.status}`)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.log(`[${source}] Error body (first 500): ${body.substring(0, 500)}`)
      return []
    }
    const data = await res.json()
    const jobs = data.data || []
    console.log(`[${source}] Results returned: ${jobs.length}`)
    if (jobs.length === 0) {
      console.log(`[${source}] Response preview: ${JSON.stringify(data).substring(0, 500)}`)
    }

    return jobs.map((job: Record<string, unknown>) => {
      const rawSalary = job.job_min_salary && job.job_max_salary
        ? `${job.job_min_salary} - ${job.job_max_salary} ${job.job_salary_period || ''}`
        : String(job.job_salary || '')
      const rawDescription = String(job.job_description || '')
      return {
        title: String(job.job_title || ''),
        company: String(job.employer_name || ''),
        location: String(job.job_city || job.job_country || job.job_is_remote ? 'Remote' : ''),
        salary: rawSalary,
        salaryObj: normalizeSalary(rawSalary),
        url: String(job.job_apply_link || ''),
        source: 'JSearch',
        type: String(job.job_employment_type || ''),
        description: sanitizeDescription(rawDescription),
        postedAt: normalizeDate(job.job_posted_at_datetime_utc || job.job_posted_at),
      }
    })
  } catch (err) {
    console.log(`[${source}] Fetch failed:`, err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) console.log(`[${source}] Stack:`, err.stack.split('\n').slice(0, 3).join('\n'))
    return []
  }
}

// ─── Main Orchestrator ───────────────────────────────────────

export async function aggregateJobs(userQuery: string, preferredLocation?: string): Promise<JobResult[]> {
  console.log(`[Aggregator] Parsing query: "${userQuery}"`)
  const { keywords, job_type, location: queryLocation } = await parseJobQuery(userQuery)
  const prefLocation = preferredLocation || queryLocation
  console.log(`[Aggregator] Keywords: ${keywords.join(', ')} | Type: ${job_type} | Location: ${prefLocation}`)

  const {
    remotive,
    himalayas,
    remoteOK,
    adzuna,
    jsearch,
    internshala,
    wework,
    arbeitnow,
  } = await runFetchersInParallel(keywords, prefLocation)

  console.log(`[Aggregator] Results — Remotive: ${remotive.length}, Himalayas: ${himalayas.length}, RemoteOK: ${remoteOK.length}, Adzuna: ${adzuna.length}, JSearch: ${jsearch.length}, Internshala: ${internshala.length}, WeWorkRemotely: ${wework.length}, Arbeitnow: ${arbeitnow.length}`)

  const combined = [...remotive, ...himalayas, ...remoteOK, ...adzuna, ...jsearch, ...internshala, ...wework, ...arbeitnow]

  combined.sort((a, b) => {
    const aTs = getPostedAtTimestamp(a.postedAt)
    const bTs = getPostedAtTimestamp(b.postedAt)
    if (aTs === null && bTs === null) return 0
    if (aTs === null) return 1
    if (bTs === null) return -1
    return bTs - aTs
  })

  const dedupeMap = new Map<string, JobResult>()
  for (const job of combined) {
    const key = `${job.title.trim().toLowerCase()}|${job.company.trim().toLowerCase()}`
    const existing = dedupeMap.get(key)
    if (!existing) {
      dedupeMap.set(key, job)
      continue
    }

    const existingTs = getPostedAtTimestamp(existing.postedAt)
    const currentTs = getPostedAtTimestamp(job.postedAt)
    const shouldReplace =
      currentTs !== null && (existingTs === null || currentTs > existingTs)

    if (shouldReplace) {
      dedupeMap.set(key, job)
    }
  }
  const deduplicated = [...dedupeMap.values()]

  const scored = deduplicated.map((job) => ({
    ...job,
    locationScore: calculateLocationMatch(job.location, prefLocation),
  }))

  scored.sort((a, b) => {
    if (b.locationScore !== a.locationScore) return b.locationScore - a.locationScore
    const aTs = getPostedAtTimestamp(a.postedAt)
    const bTs = getPostedAtTimestamp(b.postedAt)
    if (aTs !== bTs) {
      if (aTs === null) return 1
      if (bTs === null) return -1
      return bTs - aTs
    }
    const aPriority = SOURCE_PRIORITY[a.source] ?? 99
    const bPriority = SOURCE_PRIORITY[b.source] ?? 99
    if (aPriority !== bPriority) return aPriority - bPriority
    return a.title.localeCompare(b.title)
  })

  console.log(`[Aggregator] Combined: ${combined.length} -> Deduplicated: ${deduplicated.length} -> Sorted: ${scored.length}`)
  
  const cleanedJobs = scored.map(job => ({
    ...job,
    title: cleanText(job.title),
    description: cleanText(job.description || ''),
    company: cleanText(job.company),
    location: cleanText(job.location)
  }));

  return cleanedJobs;
}

export default aggregateJobs

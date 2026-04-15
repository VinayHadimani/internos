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
    .replace(/â/g, "'")
    .replace(/â€"/g, '-')
    .replace(/â€"/g, '-')
    .replace(/â€˜/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/Ã¢â‚¬â€œ/g, '-')
    .replace(/Ã¢â‚¬â„¢/g, "'")
    .replace(/Ã‚Â/g, '')
    .replace(/Â/g, '')
    .replace(/â/g, '')
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
 * Accepts: ISO string, Unix timestamp (seconds or milliseconds), Date object.
 * Returns undefined if unparseable.
 */
function normalizeDate(value: unknown): string | undefined {
  if (!value) return undefined
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isNaN(time) ? undefined : value.toISOString()
  }
  // Already ISO string
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try { return new Date(value).toISOString() } catch { return undefined }
  }
  // Unix timestamp (seconds or milliseconds)
  if (typeof value === 'number') {
    const ts = value > 1e12 ? value : value * 1000
    try { return new Date(ts).toISOString() } catch { return undefined }
  }
  // String timestamp
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
 * Examples: "Posted 2 days ago", "Posted 5 hours ago", "Posted today".
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
    case 'minute':
      now.setMinutes(now.getMinutes() - amount)
      break
    case 'hour':
      now.setHours(now.getHours() - amount)
      break
    case 'day':
      now.setDate(now.getDate() - amount)
      break
    case 'week':
      now.setDate(now.getDate() - (amount * 7))
      break
    case 'month':
      now.setMonth(now.getMonth() - amount)
      break
    case 'year':
      now.setFullYear(now.getFullYear() - amount)
      break
    default:
      return undefined
  }

  return now.toISOString()
}

export interface ParsedQuery {
  keywords: string[]
  job_type: string
  location: string
}

// ─── Query Parser (NO AI — just string parsing) ─────────────
// The search route already uses AI to generate the right queries.
// This just splits them into keywords for the fetch functions.
export async function parseJobQuery(query: string): Promise<ParsedQuery> {
  // Detect job type from query
  let job_type = ''
  const lower = query.toLowerCase()
  if (lower.includes('internship') || lower.includes('intern')) job_type = 'internship'
  else if (lower.includes('full-time') || lower.includes('full time')) job_type = 'full-time'
  else if (lower.includes('part-time') || lower.includes('part time')) job_type = 'part-time'
  else if (lower.includes('contract')) job_type = 'contract'
  
  // Detect location
  let location = ''
  const locationPatterns = ['remote', 'india', 'us', 'usa', 'uk', 'germany', 'europe']
  for (const loc of locationPatterns) {
    if (lower.includes(loc)) { location = loc; break }
  }
  
  // Split query into keywords, preserving multi-word terms
  const keywords = query
    .split(/\s+/)
    .filter(w => w.length > 1)
    .filter(w => !['the', 'and', 'for', 'a', 'an', 'in', 'at', 'of', 'to', 'or'].includes(w.toLowerCase()))
  
  if (keywords.length === 0) {
    // Use the full query as one keyword
    return { keywords: [query || 'internship'], job_type, location }
  }
  
  return { keywords, job_type, location }
}

/**
 * Sanitize a job description: strip HTML, trim whitespace, limit to 2000 chars.
 */
function sanitizeDescription(raw: string): string {
  if (!raw) return ''
  
  // 1. Replace block-level tags with spaces to avoid words sticking together
  // e.g., <div>One</div><div>Two</div> -> One Two
  let processed = raw.replace(/<(div|p|br|li|h[1-6]|tr)[^>]*>/gi, ' ');
  
  // 2. Strip all remaining HTML tags
  processed = processed.replace(/<[^>]*>/g, ' ')
  
  // 3. Decode common HTML entities and fix encoding artifacts
  processed = processed
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\u00A0/g, ' ') // Non-breaking space
    .replace(/\u2011/g, '-') // Non-breaking hyphen
    .replace(/â/g, '-')    // Common garbled hyphen artifact
  
  // 4. Collapse multiple whitespaces/newlines into a single space
  // and trim the result
  const stripped = processed.replace(/\s+/g, ' ').trim()
  
  return stripped.length > 2500 ? stripped.substring(0, 2500) + '...' : stripped
}

// ─── Location Matching ───────────────────────────────────────

/**
 * Location aliases for common variations.
 * Maps canonical names to their known variations.
 */
const LOCATION_ALIASES: Record<string, string[]> = {
  // India
  'gurgaon': ['gurgaon', 'gurugram', 'delhi ncr', 'ncr', 'delhi'],
  'bangalore': ['bangalore', 'bengaluru', 'karnataka'],
  'mumbai': ['mumbai', 'bombay', 'maharashtra', 'navi mumbai', 'thane'],
  'noida': ['noida', 'uttar pradesh', 'delhi ncr', 'ncr'],
  // Australia (Fix #10)
  'melbourne': ['melbourne', 'victoria', 'vic', 'park hill', '3045', 'vic 3045'],
  'sydney': ['sydney', 'nsw', 'new south wales'],
  'brisbane': ['brisbane', 'queensland', 'qld'],
  'perth': ['perth', 'western australia', 'wa'],
  'adelaide': ['adelaide', 'south australia', 'sa'],
  // US
  'new york': ['new york', 'nyc', 'manhattan'],
  'san francisco': ['san francisco', 'sf', 'bay area', 'california'],
  // UK
  'london': ['london', 'united kingdom', 'uk', 'england'],
  // Germany
  'germany': ['germany', 'deutschland', 'berlin', 'munich', 'hamburg', 'frankfurt'],
  // Generic Remote (Fix #10 - expanded)
  'remote': ['remote', 'work from home', 'wfh', 'anywhere', 'work from anywhere', 'virtual', 'telecommute'],
}

/**
 * Normalize a location string to its canonical form.
 */
function normalizeLocation(loc: string): string {
  const lower = loc.toLowerCase().trim()
  for (const [canonical, aliases] of Object.entries(LOCATION_ALIASES)) {
    if (aliases.some((alias) => lower.includes(alias))) {
      return canonical
    }
  }
  return lower
}

/**
 * Calculate location match score between a job's location and user's preference.
 * Returns 0-1:
 *   1.0: Exact match
 *   0.9: Partial match (same city group)
 *   0.7: Same country (India)
 *   0.5: Remote when user wants remote
 *   0.3: Remote when user wants a specific city
 *   0:   No match
 */
export function calculateLocationMatch(jobLocation: string, preferredLocation: string): number {
  if (!preferredLocation || preferredLocation.trim() === '') return 0.5 // No preference = neutral

  const jobNorm = normalizeLocation(jobLocation)
  const prefNorm = normalizeLocation(preferredLocation)

  // Exact match
  if (jobNorm === prefNorm) return 1.0

  // Partial match — check if job location contains the preferred city
  if (jobNorm.includes(prefNorm) || prefNorm.includes(jobNorm)) return 0.9

  // Same city group (aliases)
  for (const aliases of Object.values(LOCATION_ALIASES)) {
    const jobInGroup = aliases.some((a) => jobNorm.includes(a))
    const prefInGroup = aliases.some((a) => prefNorm.includes(a))
    if (jobInGroup && prefInGroup) return 0.9
  }

  // Remote logic
  const isJobRemote = ['remote', 'work from home', 'wfh', 'anywhere'].some((r) => jobNorm.includes(r))
  const isPrefRemote = ['remote', 'work from home', 'wfh', 'anywhere'].some((r) => prefNorm.includes(r))

  if (isJobRemote && isPrefRemote) return 1.0
  if (isJobRemote && !isPrefRemote) return 0.5 // Remote is a decent fallback for city seekers
  if (!isJobRemote && isPrefRemote) return 0.2 // Non-remote is poor for remote seekers

  // Same country bonus — works for ANY country, not just India
  const COUNTRY_ALIASES: Record<string, string[]> = {
    'india': ['india', 'bangalore', 'mumbai', 'delhi', 'gurgaon', 'pune', 'hyderabad', 'chennai', 'kolkata', 'noida', '+91'],
    'australia': ['australia', 'melbourne', 'sydney', 'brisbane', 'perth', 'adelaide', 'canberra', 'gold coast', 'vic', 'nsw', 'qld', 'wa', 'sa', '+61', '3045'],
    'united states': ['united states', 'usa', 'new york', 'san francisco', 'los angeles', 'chicago', 'austin', 'boston', 'texas', 'california', '+1'],
    'germany': ['germany', 'berlin', 'munich', 'frankfurt', 'hamburg', '+49'],
    'united kingdom': ['united kingdom', 'uk', 'london', 'england', '+44'],
  }
  for (const [, signals] of Object.entries(COUNTRY_ALIASES)) {
    const jobInCountry = signals.some(s => jobNorm.includes(s.toLowerCase()))
    const prefInCountry = signals.some(s => prefNorm.includes(s.toLowerCase()))
    if (jobInCountry && prefInCountry) return 0.7
  }

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
  // Run ALL fetchers in parallel with Promise.allSettled
  // so one slow/failing API doesn't block the others
  const isIndia = (location || '').toLowerCase().includes('india');
  const isAustralia = (location || '').toLowerCase().includes('australia') || (location || '').toLowerCase().includes('melbourne') || (location || '').toLowerCase().includes('sydney');
  const isEU = (location || '').toLowerCase().includes('germany') || (location || '').toLowerCase().includes('europe') || (location || '').toLowerCase().includes('poland');

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
    fetchJSearch(keywords, location),
    // Fix #14 — Gating: Only fetch from Internshala if user is in India
    (location.toLowerCase().includes('india')) ? fetchInternshala(keywords) : Promise.resolve([]),
    fetchWeWorkRemotely(keywords),
    // Fix #14 — Gating: Only fetch from Arbeitnow if user is in Germany/Europe or location is remote
    (location.toLowerCase().includes('germany') || location.toLowerCase().includes('europe') || location.toLowerCase() === 'remote') ? fetchArbeitnow(keywords) : Promise.resolve([]),
  ])

  const extract = (result: PromiseSettledResult<JobResult[]>, name: string): JobResult[] => {
    if (result.status === 'fulfilled') return result.value
    console.error(`[Aggregator] ${name} failed:`, result.reason)
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

/**
 * Parse RSS XML feed and extract job items.
 */
async function parseRSSFeed(url: string): Promise<JobResult[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ScraperOS/1.0' },
      signal: AbortSignal.timeout(7000),
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

      // Extract company from description (often appears as "by CompanyName" or similar)
      const companyMatch = description.match(/by\s+([A-Z][A-Za-z\s&.]+)/)
      const company = companyMatch ? companyMatch[1].trim() : 'Unknown'

      // Extract location from description
      const locationMatch = description.match(/(?:location|based in|in)\s*:?\s*([A-Za-z\s,]+)/i)
      const location = locationMatch ? locationMatch[1].trim().split(',')[0].trim() : 'remote'

      // Extract stipend/salary (₹ patterns)
      const salaryMatch = description.match(/₹[\d,]+(?:\s*-\s*₹[\d,]+)?(?:\s*\/\s*month)?/i)
      const salary = salaryMatch ? salaryMatch[0] : ''

      items.push({
        title,
        company,
        location: location || 'remote',
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
    console.error(`[Aggregator] RSS parse failed for ${url}:`, err)
    return []
  }
}

/**
 * Map user keywords to Internshala RSS profile slugs.
 */
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
  // Business / Consulting / Finance profiles
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
  'financial modeling': 'finance',
  'valuation': 'finance',
  'business strategy': 'management',
  'due diligence': 'finance',
  'business analysis': 'business-analytics',
  'stakeholder': 'management',
  'competitive analysis': 'market-research',
  'presentation': 'management',
  'client engagement': 'management',
  'equity research': 'finance',
  'risk management': 'finance',
  'compliance': 'finance',
  'business development': 'business-development',
  'project management': 'management',
  'recruiting': 'human-resources',
  'healthcare': 'healthcare',
  'product management': 'product-management',
  'ux': 'design',
  'user research': 'design',
  'graphic design': 'graphic-design',
  'data analysis': 'business-analytics',
  'statistical': 'data-science',
  'regression': 'data-science',
  'retail': 'retail',
  'customer service': 'customer-service',
  'hospitality': 'hospitality',
  'sports': 'sports',
  'fitness': 'sports',
  'education': 'education',
  'teaching': 'education'
}

export async function fetchInternshala(keywords: string[]): Promise<JobResult[]> {
  try {
    // Map keywords to Internshala profile slugs
    const profiles = new Set<string>()
    for (const kw of keywords) {
      const lower = kw.toLowerCase()
      // Check exact match first
      if (INTERN_SHALA_PROFILES[lower]) {
        profiles.add(INTERN_SHALA_PROFILES[lower])
      } else {
        // Check partial match
        const match = Object.entries(INTERN_SHALA_PROFILES).find(([key]) => lower.includes(key))
        if (match) {
          profiles.add(match[1])
        } else {
          // Use keyword directly as profile slug
          profiles.add(lower.replace(/\s+/g, '-'))
        }
      }
    }

    // Fetch all matched RSS feeds in parallel
    const feedUrls = [...profiles].map(
      (profile) => `https://internshala.com/rss/internships/profile-${profile}`
    )

    const results = await Promise.all(feedUrls.map(parseRSSFeed))
    return results.flat()
  } catch (err) {
    console.error('[Aggregator] Internshala fetch failed:', err)
    return []
  }
}

export async function fetchRemotive(keywords: string[]): Promise<JobResult[]> {
  const source = 'Remotive'
  try {
    const remotiveSearch = encodeURIComponent(keywords.join(' '));
    console.error(`[${source}] Fetching: ${keywords.join(', ')}`)
    
    // Use the v2 Remotive API endpoint
    const res = await fetch(`https://remotive.com/api/remote-jobs?search=${remotiveSearch}&limit=25`, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(7000),
    })
    console.error(`[${source}] Response status: ${res.status}`)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[${source}] Error body (first 500): ${body.substring(0, 500)}`)
      return []
    }
    const data = await res.json()
    const jobs = data.jobs || []
    
    // Remotive sometimes returns warning objects mixed with jobs — filter them out
    const realJobs = jobs.filter((job: Record<string, unknown>) => 
      typeof job.title === 'string' && job.title.length > 0 && 
      typeof job.company_name === 'string'
    );
    console.error(`[${source}] Filtered to ${realJobs.length} real jobs (from ${jobs.length} total)`);
    
    if (realJobs.length === 0) {
      console.error(`[${source}] Empty response keys: ${Object.keys(data).join(', ')}`)
      console.error(`[${source}] Response preview: ${JSON.stringify(data).substring(0, 500)}`)
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
    console.error(`[${source}] Fetch failed:`, err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) console.error(`[${source}] Stack:`, err.stack.split('\n').slice(0, 3).join('\n'))
    return []
  }
}

export async function fetchHimalayas(keywords: string[]): Promise<JobResult[]> {
  const source = 'Himalayas'
  console.error(`[${source}] Himalayas API is deprecated, skipping for now.`);
  return []
}

export async function fetchRemoteOK(keywords: string[]): Promise<JobResult[]> {
  const source = 'RemoteOK'
  try {
    console.error(`[${source}] Fetching: ${keywords.join(', ')} | URL: https://remoteok.com/api`)
    const res = await fetch('https://remoteok.com/api', {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(7000),
    })
    console.error(`[${source}] Response status: ${res.status}`)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[${source}] Error body (first 500): ${body.substring(0, 500)}`)
      return []
    }
    const text = await res.text()
    console.error(`[${source}] Response length: ${text.length} chars`)
    // RemoteOK returns a JSON array (first element is "status", rest are jobs)
    const data = JSON.parse(text)
    const jobs = Array.isArray(data) ? data.slice(1) : []
    console.error(`[${source}] Returned ${jobs.length} raw items`)

    // Filter locally by keywords — match multi-word keywords as phrases
    const keywordSet = keywords.map(k => k.toLowerCase())
    const filtered = jobs.filter((job: Record<string, unknown>) => {
      const title = String(job.position || '').toLowerCase()
      const desc = String(job.description || '').toLowerCase()
      const tags = Array.isArray(job.tags) 
        ? job.tags.map((t: unknown) => String(t).toLowerCase()).join(' ')
        : String(job.tags || '').toLowerCase()
      const allText = `${title} ${desc} ${tags}`
      
      // At least one keyword must match
      return keywordSet.some(k => {
        if (k.includes(' ')) {
          // Multi-word keyword: must appear as phrase
          return allText.includes(k)
        }
        // Single-word keyword: use word boundary
        return new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(allText)
      })
    })
    console.error(`[${source}] Filtered down to ${filtered.length} items`)

    // Fallback: if strict filtering returns 0 but we have jobs, return first 20
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
    console.error(`[${source}] Fetch failed:`, err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) console.error(`[${source}] Stack:`, err.stack.split('\n').slice(0, 3).join('\n'))
    return []
  }
}

export async function fetchWeWorkRemotely(keywords: string[]): Promise<JobResult[]> {
  const source = 'WeWorkRemotely'
  try {
    // Fetch from multiple categories in parallel
    const categories = [
      'remote-programming-jobs',
      'remote-customer-service-jobs',
      'remote-sales-jobs',
      'remote-design-jobs',
      'remote-devops-jobs',
      'remote-product-jobs',
      'remote-marketing-jobs'
    ]

    console.error(`[${source}] Fetching ${categories.length} categories for: ${keywords.join(', ')}`)

    const results = await Promise.all(
      categories.map(async (cat) => {
        const url = `https://weworkremotely.com/categories/${cat}.json`
        try {
          const res = await fetch(url, {
            headers: BROWSER_HEADERS,
            signal: AbortSignal.timeout(7000),
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
    console.error(`[${source}] Returned ${allJobs.length} raw items across ${categories.length} categories`)

    // Filter locally by keywords (broadened: check description and tags too)
    const keywordSet = keywords.map(k => k.toLowerCase())
    const filtered = allJobs.filter((job: Record<string, unknown>) => {
      const title = String(job.title || '').toLowerCase()
      const desc = String(job.description || '').toLowerCase()
      const company = String(job.company || '').toLowerCase()
      const allText = `${title} ${desc} ${company}`
      
      return keywordSet.some(k => {
        if (k.includes(' ')) {
          return allText.includes(k)
        }
        return new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(allText)
      })
    })
    console.error(`[${source}] Filtered down to ${filtered.length} items`)

    // Fallback: if no keyword matches, return first 20 jobs
    if (filtered.length === 0) {
      console.error(`[${source}] No keyword matches, returning empty (no random fallback).`)
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
    console.error(`[${source}] Fetch failed:`, err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) console.error(`[${source}] Stack:`, err.stack.split('\n').slice(0, 3).join('\n'))
    return []
  }
}

export async function fetchArbeitnow(keywords: string[]): Promise<JobResult[]> {
  const source = 'Arbeitnow'
  try {
    console.error(`[${source}] Starting fetch for: ${keywords.join(', ')} | URL: https://arbeitnow.com/api/job-board-api`)
    const res = await fetch('https://arbeitnow.com/api/job-board-api', {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(7000),
    })
    console.error(`[${source}] Response status: ${res.status}`)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[${source}] Error body (first 500): ${body.substring(0, 500)}`)
      return []
    }
    const data = await res.json()
    const jobs = data.data || []
    console.error(`[${source}] Total jobs before filter: ${jobs.length}`)
    if (jobs.length === 0) {
      console.error(`[${source}] Response keys: ${Object.keys(data).join(', ')}`)
      console.error(`[${source}] Response preview: ${JSON.stringify(data).substring(0, 500)}`)
    }

    // Filter locally by keywords (title or description must contain at least one keyword)
    const keywordSet = keywords.map(k => k.toLowerCase())
    const filtered = jobs.filter((job: Record<string, unknown>) => {
      const title = String(job.title || '').toLowerCase()
      const desc = String(job.description || '').toLowerCase()
      const allText = `${title} ${desc}`
      
      return keywordSet.some(k => {
        if (k.includes(' ')) {
          return allText.includes(k)
        }
        return new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(allText)
      })
    })
    console.error(`[${source}] Results after keyword filter: ${filtered.length}`)
    
    // Fallback: if no keyword matches, return the 10 most recent jobs as a wide net
    const jobsToReturn = filtered.length > 0 ? filtered : jobs.slice(0, 10);
    
    if (jobsToReturn.length === 0) {
      return []
    }

    return jobsToReturn.map((job: Record<string, unknown>) => {
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
    console.error(`[${source}] Fetch failed:`, err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) console.error(`[${source}] Stack:`, err.stack.split('\n').slice(0, 3).join('\n'))
    return []
  }
}

// ─── Tier 2: Authenticated API Fetchers ──────────────────────

// Helper for Adzuna country codes
function getAdzunaCountryCode(location: string): string {
  const lower = location.toLowerCase();
  if (lower.includes('australia') || lower.includes('melbourne') || lower.includes('sydney') || 
      lower.includes('brisbane') || lower.includes('perth') || lower.includes('adelaide') ||
      lower.includes('canberra') || lower.includes('gold coast') || lower.includes('victoria') ||
      lower.includes('new south wales') || lower.includes('queensland') || lower.includes('wa') ||
      lower.includes('sa') || lower.includes('tas') || lower.includes('nt') || lower.includes('act')) {
    return 'au';
  }
  if (lower.includes('india') || lower.includes('bangalore') || lower.includes('mumbai') || 
      lower.includes('delhi') || lower.includes('gurgaon') || lower.includes('pune') || 
      lower.includes('hyderabad') || lower.includes('chennai') || lower.includes('noida') ||
      lower.includes('kolkata')) {
    return 'in';
  }
  if (lower.includes('united states') || lower.includes(' usa') || lower.includes('new york') || 
      lower.includes('san francisco') || lower.includes('chicago') || lower.includes('texas') ||
      lower.includes('california') || lower.includes('remote, us')) {
    return 'us';
  }
  if (lower.includes('germany') || lower.includes('berlin') || lower.includes('munich') || 
      lower.includes('frankfurt') || lower.includes('hamburg')) {
    return 'de';
  }
  if (lower.includes('united kingdom') || lower.includes('london') || lower.includes('uk') || 
      lower.includes('manchester') || lower.includes('birmingham')) {
    return 'gb';
  }
  if (lower.includes('canada') || lower.includes('toronto') || lower.includes('vancouver') || 
      lower.includes('montreal')) {
    return 'ca';
  }
  return 'us'; // Default fallback for unknown or 'remote'
}

export async function fetchAdzuna(keywords: string[], location: string): Promise<JobResult[]> {
  const source = 'Adzuna'
  try {
    const appId = process.env.ADZUNA_APP_ID
    const appKey = process.env.ADZUNA_APP_KEY
    if (!appId || !appKey) {
      console.error(`[${source}] Skipping: no API keys configured`)
      return []
    }

    const what = keywords.join(' ')
    const where = location || ''
    const countryCode = getAdzunaCountryCode(location)
    const url = `http://api.adzuna.com/v1/api/jobs/${countryCode}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=20&what=${encodeURIComponent(what)}${where ? `&where=${encodeURIComponent(where)}` : ''}`
    console.error(`[${source}] Starting fetch for: ${what} ${where ? `| Location: ${where}` : ''} | Country: ${countryCode}`)

    const res = await fetch(url, { signal: AbortSignal.timeout(7000) })
    console.error(`[${source}] Response status: ${res.status}`)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[${source}] Error body (first 500): ${body.substring(0, 500)}`)
      return []
    }
    const data = await res.json()
    const results = data.results || []
    console.error(`[${source}] Results returned: ${results.length}`)
    if (results.length === 0) {
      console.error(`[${source}] Response preview: ${JSON.stringify(data).substring(0, 500)}`)
    }

    const currencySymbol = countryCode === 'in' ? '₹' : countryCode === 'au' ? 'A$' : countryCode === 'gb' ? '£' : countryCode === 'de' ? '€' : countryCode === 'ca' ? 'C$' : '$';
    return results.map((job: Record<string, unknown>) => {
      const rawSalary = job.salary_min && job.salary_max
        ? `${currencySymbol}${Number(job.salary_min).toLocaleString()} - ${currencySymbol}${Number(job.salary_max).toLocaleString()}`
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
    console.error(`[${source}] Fetch failed:`, err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) console.error(`[${source}] Stack:`, err.stack.split('\n').slice(0, 3).join('\n'))
    return []
  }
}

export async function fetchJSearch(keywords: string[], location?: string): Promise<JobResult[]> {
  const source = 'JSearch'
  try {
    const rapidApiKey = process.env.RAPID_API_KEY
    if (!rapidApiKey) {
      console.error(`[${source}] Skipping: no RapidAPI key configured`)
      return []
    }

    const query = keywords.join(' ')
    const locationParam = location && location !== 'remote' ? ` ${location}` : '';
    const fullQuery = `${query}${locationParam}`
    
    // For students, prioritize internships and part-time (Fix #3)
    const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(fullQuery)}&page=1&num_pages=1&employment_types=INTERNSHIP,PARTTIME`
    console.error(`[${source}] Starting fetch for: ${fullQuery} | URL: ${url}`)

    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
      signal: AbortSignal.timeout(12000),
    })
    console.error(`[${source}] Response status: ${res.status}`)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[${source}] Error body (first 500): ${body.substring(0, 500)}`)
      return []
    }
    const data = await res.json()
    const jobs = data.data || []
    console.error(`[${source}] Results returned: ${jobs.length}`)
    if (jobs.length === 0) {
      console.error(`[${source}] Response preview: ${JSON.stringify(data).substring(0, 500)}`)
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
    console.error(`[${source}] Fetch failed:`, err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) console.error(`[${source}] Stack:`, err.stack.split('\n').slice(0, 3).join('\n'))
    return []
  }
}

// ─── Main Orchestrator ───────────────────────────────────────

export async function aggregateJobs(userQuery: string, preferredLocation?: string): Promise<JobResult[]> {
  console.log(`[Aggregator] Parsing query: "${userQuery}"`)
  const { keywords, job_type, location: queryLocation } = await parseJobQuery(userQuery)
  const prefLocation = preferredLocation || queryLocation
  console.log(`[Aggregator] Keywords: ${keywords.join(', ')} | Type: ${job_type} | Location: ${prefLocation}`)

  // Fetch all sources in parallel to avoid rate limits and Vercel timeouts
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

  // Combine all results
  const combined = [...remotive, ...himalayas, ...remoteOK, ...adzuna, ...jsearch, ...internshala, ...wework, ...arbeitnow]

  // Sort by recency before deduplication (newest first; unknown dates at bottom)
  combined.sort((a, b) => {
    const aTs = getPostedAtTimestamp(a.postedAt)
    const bTs = getPostedAtTimestamp(b.postedAt)
    if (aTs === null && bTs === null) return 0
    if (aTs === null) return 1
    if (bTs === null) return -1
    return bTs - aTs
  })

  // Deduplicate by title + company (case-insensitive, trimmed),
  // keeping the most recent duplicate by postedAt.
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

  // Calculate location scores and sort
  const scored = deduplicated.map((job) => ({
    ...job,
    locationScore: calculateLocationMatch(job.location, prefLocation),
  }))

  scored.sort((a, b) => {
    // Primary: location score (descending)
    if (b.locationScore !== a.locationScore) return b.locationScore - a.locationScore
    // Secondary: postedAt recency (descending; unknown dates at bottom)
    const aTs = getPostedAtTimestamp(a.postedAt)
    const bTs = getPostedAtTimestamp(b.postedAt)
    if (aTs !== bTs) {
      if (aTs === null) return 1
      if (bTs === null) return -1
      return bTs - aTs
    }
    // Tertiary: source priority (lower number = higher priority)
    const aPriority = SOURCE_PRIORITY[a.source] ?? 99
    const bPriority = SOURCE_PRIORITY[b.source] ?? 99
    if (aPriority !== bPriority) return aPriority - bPriority
    // Quaternary: title alphabetical
    return a.title.localeCompare(b.title)
  })

  console.log(`[Aggregator] Combined: ${combined.length} → Deduplicated: ${deduplicated.length} → Sorted: ${scored.length}`)
  
  // Apply cleanText to EVERY job before returning:
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

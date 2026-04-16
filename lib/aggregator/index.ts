import * as cheerio from 'cheerio'
import { normalizeSalary, type SalaryInfo } from '@/lib/utils/salary'

function cleanText(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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

function parseRelativePostedAt(text: string): string | undefined {
  if (!text) return undefined
  const normalized = text.toLowerCase()

  if (/\bposted\s+today\b/.test(normalized)) return new Date().toISOString()
  if (/\bposted\s+yesterday\b/.test(normalized)) return new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString()

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
  
  if (keywords.length === 0) return { keywords: [query || 'internship'], job_type, location }
  return { keywords, job_type, location }
}

function sanitizeDescription(raw: string): string {
  if (!raw) return ''
  let processed = raw.replace(/<(div|p|br|li|h[1-6]|tr)[^>]*>/gi, ' ')
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
    if (aliases.some((alias) => lower.includes(alias))) return canonical
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

// ─── FIX: Country to Adzuna API code mapping ─────────────────

const ADZUNA_COUNTRY_MAP: Record<string, string> = {
  'US': 'us',
  'UK': 'gb',
  'IN': 'in',
  'CA': 'ca',
  'DE': 'de',
  'AU': 'au',
  'FR': 'fr',
  'NL': 'nl',
  'BR': 'br',
  'SG': 'sg',
}

async function runFetchersInParallel(
  keywords: string[],
  location: string,
  userCountry?: string | null
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
    fetchAdzuna(keywords, location, userCountry),
    fetchJSearch(keywords),
    fetchInternshala(keywords),
    fetchWeWorkRemotely(keywords),
    fetchArbeitnow(keywords),
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
      const companyMatch = description.match(/by\s+([A-Z][A-Za-z\s&.]+)/)
      const company = companyMatch ? companyMatch[1].trim() : 'Unknown'
      const locationMatch = description.match(/(?:location|based in|in)\s*:?\s*([A-Za-z\s,]+)/i)
      const location = locationMatch ? locationMatch[1].trim().split(',')[0].trim() : 'India'
      const salaryMatch = description.match(/₹[\d,]+(?:\s*-\s*₹[\d,]+)?(?:\s*\/\s*month)?/i)
      const salary = salaryMatch ? salaryMatch[0] : ''
      items.push({
        title, company, location: location || 'India', salary,
        salaryObj: normalizeSalary(salary), url: link, source: 'Internshala',
        type: 'Internship', description: sanitizeDescription(description), postedAt,
      })
    })
    return items
  } catch (err) {
    console.error(`[Aggregator] RSS parse failed for ${url}:`, err)
    return []
  }
}

// ─── FIX: Added retail, hospitality, trades, healthcare profiles ──

const INTERN_SHALA_PROFILES: Record<string, string> = {
  // Tech
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
  // Design & Media
  'design': 'graphic-design',
  'marketing': 'digital-marketing',
  'content': 'content-writing',
  'video': 'video-editing',
  // Business & Finance
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
  // NEW: Retail & Customer Service
  'retail': 'sales',
  'customer service': 'customer-service',
  'cashier': 'finance',
  'cash handling': 'finance',
  'retail assistant': 'sales',
  'store associate': 'sales',
  'store': 'sales',
  'fashion': 'fashion',
  'hospitality': 'hospitality-management',
  'hotel': 'hospitality-management',
  'food': 'food-and-beverage',
  'restaurant': 'food-and-beverage',
  'barista': 'hospitality-management',
  'chef': 'food-and-beverage',
  'receptionist': 'receptionist',
  'front desk': 'receptionist',
  // NEW: Trades & Skilled Labor
  'electrician': 'electrician',
  'plumbing': 'plumbing',
  'construction': 'construction',
  'mechanic': 'automobile',
  'automotive': 'automobile',
  'welding': 'welding',
  'carpentry': 'carpentry',
  // NEW: Healthcare
  'nursing': 'nursing',
  'medical': 'mbbs',
  'healthcare': 'healthcare',
  'pharmacy': 'pharmacy',
  'physiotherapy': 'physiotherapy',
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

    const feedUrls = [...profiles].slice(0, 5).map(
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
    const remotiveSearch = encodeURIComponent(keywords.join(' '))
    console.error(`[${source}] Fetching: ${keywords.join(', ')}`)
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
    const realJobs = jobs.filter((job: Record<string, unknown>) => 
      typeof job.title === 'string' && job.title.length > 0 && 
      typeof job.company_name === 'string'
    );
    console.error(`[${source}] Filtered to ${realJobs.length} real jobs (from ${jobs.length} total)`);
    return realJobs.map((job: Record<string, unknown>) => {
      const rawSalary = String(job.salary || '')
      const rawDescription = String(job.description || '')
      return {
        title: String(job.title || ''),
        company: String(job.company_name || ''),
        location: String(job.candidate_required_location || job.location || ''),
        salary: rawSalary, salaryObj: normalizeSalary(rawSalary),
        url: String(job.url || job.public_url || ''),
        source: 'Remotive', type: String(job.job_type || ''),
        description: sanitizeDescription(rawDescription),
        postedAt: normalizeDate(job.publication_date || job.posted_at || job.created_at),
      }
    })
  } catch (err) {
    console.error(`[${source}] Fetch failed:`, err instanceof Error ? err.message : String(err))
    return []
  }
}

export async function fetchHimalayas(keywords: string[]): Promise<JobResult[]> {
  return []
}

export async function fetchRemoteOK(keywords: string[]): Promise<JobResult[]> {
  const source = 'RemoteOK'
  try {
    console.error(`[${source}] Fetching: ${keywords.join(', ')}`)
    const res = await fetch('https://remoteok.com/api', {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(7000),
    })
    if (!res.ok) return []
    const text = await res.text()
    const data = JSON.parse(text)
    const jobs = Array.isArray(data) ? data.slice(1) : []
    console.error(`[${source}] Returned ${jobs.length} raw items`)
    const keywordSet = keywords.map(k => k.toLowerCase())
    const filtered = jobs.filter((job: Record<string, unknown>) => {
      const title = String(job.position || '').toLowerCase()
      const desc = String(job.description || '').toLowerCase()
      const tags = Array.isArray(job.tags) ? (job.tags as string[]).join(' ').toLowerCase() : String(job.tags || '').toLowerCase()
      const allText = `${title} ${desc} ${tags}`
      return keywordSet.some(k => allText.includes(k))
    })
    console.error(`[${source}] Filtered down to ${filtered.length} items`)
    return filtered.slice(0, 25).map((job: Record<string, unknown>) => {
      const rawSalary = String(job.salary || '')
      const rawDescription = String(job.description || '')
      return {
        title: String(job.position || ''),
        company: String(job.company || ''),
        location: String(job.location || ''),
        salary: rawSalary, salaryObj: normalizeSalary(rawSalary),
        url: job.url ? (String(job.url).startsWith('http') ? String(job.url) : `https://remoteok.com${job.url}`) : '',
        source: 'RemoteOK', type: String(job.job_type || ''),
        description: sanitizeDescription(rawDescription),
        postedAt: normalizeDate(job.date || job.epoch),
      }
    })
  } catch (err) {
    console.error(`[${source}] Fetch failed:`, err instanceof Error ? err.message : String(err))
    return []
  }
}

export async function fetchWeWorkRemotely(keywords: string[]): Promise<JobResult[]> {
  const source = 'WeWorkRemotely'
  try {
    // Only fetch categories likely to have matching jobs
    const allCategories = [
      'remote-programming-jobs',
      'remote-customer-service-jobs',
      'remote-sales-jobs',
      'remote-design-jobs',
      'remote-devops-jobs',
    ]
    const keywordSet = keywords.map(k => k.toLowerCase())
    
    // Pick relevant categories based on keywords
    let categories = allCategories
    const needsCS = keywordSet.some(k => ['customer', 'service', 'support', 'retail', 'sales', 'cash', 'store'].some(t => k.includes(t)))
    const needsTech = keywordSet.some(k => ['python', 'java', 'react', 'javascript', 'frontend', 'backend', 'devops', 'cloud', 'machine', 'data'].some(t => k.includes(t)))
    const needsDesign = keywordSet.some(k => ['design', 'ui', 'ux', 'graphic', 'brand'].some(t => k.includes(t)))
    
    if (needsCS) categories = ['remote-customer-service-jobs', 'remote-sales-jobs']
    else if (needsDesign) categories = ['remote-design-jobs']
    else if (needsTech) categories = ['remote-programming-jobs', 'remote-devops-jobs']
    else categories = allCategories.slice(0, 3) // Default: fetch 3, not 5

    console.error(`[${source}] Fetching ${categories.length} categories for: ${keywords.join(', ')}`)
    const results = await Promise.all(
      categories.map(async (cat) => {
        try {
          const res = await fetch(`https://weworkremotely.com/categories/${cat}.json`, {
            headers: BROWSER_HEADERS,
            signal: AbortSignal.timeout(7000),
          })
          if (!res.ok) return []
          const data = await res.json()
          return data.jobs || []
        } catch { return [] }
      }),
    )
    const allJobs = results.flat()
    const filtered = allJobs.filter((job: Record<string, unknown>) => {
      const title = String(job.title || '').toLowerCase()
      const desc = String(job.description || '').toLowerCase()
      const company = String(job.company || '').toLowerCase()
      return keywordSet.some(k => `${title} ${desc} ${company}`.includes(k))
    })
    console.error(`[${source}] ${filtered.length} matches from ${allJobs.length} items`)
    if (filtered.length === 0) return []
    return filtered.map((job: Record<string, unknown>) => {
      const rawSalary = String(job.salary || 'Not specified')
      const rawDescription = String(job.description || '')
      const jobUrl = String(job.url || '')
      return {
        title: String(job.title || ''),
        company: String(job.company || ''),
        location: 'Remote', salary: rawSalary,
        salaryObj: normalizeSalary(rawSalary),
        url: jobUrl.startsWith('http') ? jobUrl : `https://weworkremotely.com${jobUrl}`,
        source: 'WeWorkRemotely', type: 'Full-time',
        description: sanitizeDescription(rawDescription),
        postedAt: normalizeDate(job.date || job.published_at || job.created_at),
      }
    })
  } catch (err) {
    console.error(`[${source}] Fetch failed:`, err instanceof Error ? err.message : String(err))
    return []
  }
}

export async function fetchArbeitnow(keywords: string[]): Promise<JobResult[]> {
  const source = 'Arbeitnow'
  try {
    const res = await fetch('https://arbeitnow.com/api/job-board-api', {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(7000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const jobs = data.data || []
    console.error(`[${source}] Total: ${jobs.length}`)
    const keywordSet = keywords.map(k => k.toLowerCase())
    const filtered = jobs.filter((job: Record<string, unknown>) => {
      const title = String(job.title || '').toLowerCase()
      const desc = String(job.description || '').toLowerCase()
      return keywordSet.some(k => title.includes(k) || desc.includes(k))
    })
    console.error(`[${source}] After filter: ${filtered.length}`)
    if (filtered.length === 0) return []
    return filtered.map((job: Record<string, unknown>) => {
      const rawSalary = String(job.salary || 'Not specified')
      const rawDescription = String(job.description || '')
      return {
        title: String(job.title || ''),
        company: String(job.company_name || job.company || ''),
        location: String(job.location || 'Remote'), salary: rawSalary,
        salaryObj: normalizeSalary(rawSalary),
        url: String(job.url || ''),
        source: 'Arbeitnow', type: String(job.job_type || 'Full-time'),
        description: sanitizeDescription(rawDescription),
        postedAt: normalizeDate(job.created_at || job.created || job.published_at),
      }
    })
  } catch (err) {
    console.error(`[${source}] Fetch failed:`, err instanceof Error ? err.message : String(err))
    return []
  }
}

// ─── Tier 2: Authenticated API Fetchers ──────────────────────

// FIX: Adzuna now routes to the correct country based on user's location
export async function fetchAdzuna(keywords: string[], location: string, userCountry?: string | null): Promise<JobResult[]> {
  const source = 'Adzuna'
  try {
    const appId = process.env.ADZUNA_APP_ID
    const appKey = process.env.ADZUNA_APP_KEY
    if (!appId || !appKey) {
      console.error(`[${source}] Skipping: no API keys configured`)
      return []
    }

    const what = keywords.join(' ')
    
    // Route to the right country based on detected user country
    const countryCode = userCountry ? (ADZUNA_COUNTRY_MAP[userCountry] || 'us') : 'in'
    const adzunaLocation = location && location.length > 0 ? location : ''
    
    const url = `https://api.adzuna.com/v1/api/jobs/${countryCode}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=20&what=${encodeURIComponent(what)}${adzunaLocation ? `&where=${encodeURIComponent(adzunaLocation)}` : ''}`
    console.error(`[${source}] Fetching: "${what}" | Country: ${countryCode} | Location: ${adzunaLocation || 'any'}`)

    const res = await fetch(url, { signal: AbortSignal.timeout(7000) })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[${source}] Error ${res.status}: ${body.substring(0, 300)}`)
      return []
    }
    const data = await res.json()
    const results = data.results || []
    console.error(`[${source}] Returned ${results.length} results`)

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
        salary: rawSalary, salaryObj: normalizeSalary(rawSalary),
        url: String(job.redirect_url || ''),
        source: 'Adzuna', type: String(job.contract_type || job.contract_time || ''),
        description: sanitizeDescription(rawDescription),
        postedAt: normalizeDate(job.created || job.publication_date),
      }
    })
  } catch (err) {
    console.error(`[${source}] Fetch failed:`, err instanceof Error ? err.message : String(err))
    return []
  }
}

// FIX: JSearch fetches 2 pages instead of 1 for more results
export async function fetchJSearch(keywords: string[]): Promise<JobResult[]> {
  const source = 'JSearch'
  try {
    const apiKey = process.env.JSEARCH_API_KEY || process.env.RAPID_API_KEY
    if (!apiKey) {
      console.error(`[${source}] Skipping: no API key configured`)
      return []
    }

    const query = keywords.join(' ')
    // Fetch 2 pages (20 results per page = 40 total) instead of 1 page (20)
    const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1&num_pages=2`
    console.error(`[${source}] Fetching: "${query}" (2 pages)`)

    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[${source}] Error ${res.status}: ${body.substring(0, 300)}`)
      return []
    }
    const data = await res.json()
    const jobs = data.data || []
    console.error(`[${source}] Returned ${jobs.length} results`)

    return jobs.map((job: Record<string, unknown>) => {
      const rawSalary = job.job_min_salary && job.job_max_salary
        ? `${job.job_min_salary} - ${job.job_max_salary} ${job.job_salary_period || ''}`
        : String(job.job_salary || '')
      const rawDescription = String(job.job_description || '')
      return {
        title: String(job.job_title || ''),
        company: String(job.employer_name || ''),
        location: [job.job_city, job.job_state, job.job_country].filter(Boolean).join(', ') || 'Remote',
        salary: rawSalary, salaryObj: normalizeSalary(rawSalary),
        url: String(job.job_apply_link || ''),
        source: 'JSearch', type: String(job.job_employment_type || ''),
        description: sanitizeDescription(rawDescription),
        postedAt: normalizeDate(job.job_posted_at_datetime_utc || job.job_posted_at),
      }
    })
  } catch (err) {
    console.error(`[${source}] Fetch failed:`, err instanceof Error ? err.message : String(err))
    return []
  }
}

// ─── Main Orchestrator ───────────────────────────────────────
// FIX: Now accepts optional userCountry for Adzuna routing

export async function aggregateJobs(userQuery: string, preferredLocation?: string, userCountry?: string | null): Promise<JobResult[]> {
  console.log(`[Aggregator] Parsing query: "${userQuery}"`)
  const { keywords, job_type, location: queryLocation } = await parseJobQuery(userQuery)
  const prefLocation = preferredLocation || queryLocation
  console.log(`[Aggregator] Keywords: ${keywords.join(', ')} | Type: ${job_type} | Location: ${prefLocation} | Country: ${userCountry || 'unknown'}`)

  const {
    remotive, himalayas, remoteOK, adzuna, jsearch, internshala, wework, arbeitnow,
  } = await runFetchersInParallel(keywords, prefLocation, userCountry)

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
    if (!existing) { dedupeMap.set(key, job); continue }
    const existingTs = getPostedAtTimestamp(existing.postedAt)
    const currentTs = getPostedAtTimestamp(job.postedAt)
    if (currentTs !== null && (existingTs === null || currentTs > existingTs)) dedupeMap.set(key, job)
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
    if (aTs !== bTs) { if (aTs === null) return 1; if (bTs === null) return -1; return bTs - aTs }
    const aPriority = SOURCE_PRIORITY[a.source] ?? 99
    const bPriority = SOURCE_PRIORITY[b.source] ?? 99
    if (aPriority !== bPriority) return aPriority - bPriority
    return a.title.localeCompare(b.title)
  })

  console.log(`[Aggregator] Combined: ${combined.length} → Deduplicated: ${deduplicated.length} → Sorted: ${scored.length}`)
  
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

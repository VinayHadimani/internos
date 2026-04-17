// lib/aggregator/index.ts
import * as cheerio from 'cheerio'
import { normalizeSalary, type SalaryInfo } from '@/lib/utils/salary'

function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/â/g, "'").replace(/â€"/g, '-').replace(/â€"/g, '-')
    .replace(/â€˜/g, "'").replace(/â€œ/g, '"').replace(/â€/g, '"')
    .replace(/Ã¢â‚¬â€œ/g, '-').replace(/Ã¢â‚¬â„¢/g, "'")
    .replace(/Ã‚Â/g, '').replace(/Â/g, '').replace(/â/g, '')
    .replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
}

export interface JobResult {
  title: string; company: string; location: string; salary: string;
  salaryObj: SalaryInfo | null; url: string; source: string; type: string;
  description?: string; postedAt?: string | Date; locationScore?: number;
}

function normalizeDate(value: unknown): string | undefined {
  if (!value) return undefined
  if (value instanceof Date) { const t = value.getTime(); return Number.isNaN(t) ? undefined : value.toISOString() }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) { try { return new Date(value).toISOString() } catch { return undefined } }
  if (typeof value === 'number') { const ts = value > 1e12 ? value : value * 1000; try { return new Date(ts).toISOString() } catch { return undefined } }
  if (typeof value === 'string') { try { return new Date(value).toISOString() } catch { return undefined } }
  return undefined
}

function getPostedAtTimestamp(value: string | Date | undefined): number | null {
  if (!value) return null
  const p = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isNaN(p) ? null : p
}

function parseRelativePostedAt(text: string): string | undefined {
  if (!text) return undefined
  const n = text.toLowerCase()
  if (/\bposted\s+today\b/.test(n)) return new Date().toISOString()
  if (/\bposted\s+yesterday\b/.test(n)) return new Date(Date.now() - 86400000).toISOString()
  const m = n.match(/\bposted\s+(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago\b/)
  if (!m) return undefined
  const amt = Number(m[1]), unit = m[2]
  if (!Number.isFinite(amt)) return undefined
  const now = new Date()
  if (unit === 'minute') now.setMinutes(now.getMinutes() - amt)
  else if (unit === 'hour') now.setHours(now.getHours() - amt)
  else if (unit === 'day') now.setDate(now.getDate() - amt)
  else if (unit === 'week') now.setDate(now.getDate() - (amt * 7))
  else if (unit === 'month') now.setMonth(now.getMonth() - amt)
  else if (unit === 'year') now.setFullYear(now.getFullYear() - amt)
  else return undefined
  return now.toISOString()
}

export interface ParsedQuery { keywords: string[]; job_type: string; location: string }

export async function parseJobQuery(query: string): Promise<ParsedQuery> {
  let job_type = ''; const lower = query.toLowerCase()
  if (lower.includes('internship') || lower.includes('intern')) job_type = 'internship'
  let location = ''
  for (const loc of ['remote', 'india', 'us', 'usa', 'uk', 'germany', 'europe']) { if (lower.includes(loc)) { location = loc; break } }
  const keywords = query.split(/\s+/).filter(w => w.length > 1).filter(w => !['the', 'and', 'for', 'a', 'an', 'in', 'at', 'of', 'to', 'or'].includes(w.toLowerCase()))
  if (keywords.length === 0) return { keywords: [query || 'internship'], job_type, location }
  return { keywords, job_type, location }
}

function sanitizeDescription(raw: string): string {
  if (!raw) return ''
  let p = raw.replace(/<(div|p|br|li|h[1-6]|tr)[^>]*>/gi, ' ').replace(/<[^>]*>/g, ' ')
  p = p.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ').replace(/\u2011/g, '-').replace(/â/g, '-')
  const s = p.replace(/\s+/g, ' ').trim()
  return s.length > 2500 ? s.substring(0, 2500) + '...' : s
}

const LOCATION_ALIASES: Record<string, string[]> = {
  'gurgaon': ['gurgaon', 'gurugram', 'delhi ncr', 'ncr', 'delhi'], 'bangalore': ['bangalore', 'bengaluru', 'karnataka'],
  'mumbai': ['mumbai', 'bombay', 'maharashtra'], 'pune': ['pune', 'maharashtra'],
  'hyderabad': ['hyderabad', 'telangana'], 'chennai': ['chennai', 'tamil nadu'],
  'delhi': ['delhi', 'new delhi', 'delhi ncr', 'ncr'], 'remote': ['remote', 'work from home', 'wfh', 'anywhere'], 'india': ['india'],
}

function normalizeLocation(loc: string): string {
  const l = loc.toLowerCase().trim()
  for (const [c, a] of Object.entries(LOCATION_ALIASES)) { if (a.some(x => l.includes(x))) return c }
  return l
}

export function calculateLocationMatch(jobLocation: string, preferredLocation: string): number {
  if (!preferredLocation || preferredLocation.trim() === '') return 0.5
  const j = normalizeLocation(jobLocation), p = normalizeLocation(preferredLocation)
  if (j === p) return 1.0
  if (j.includes(p) || p.includes(j)) return 0.9
  for (const a of Object.values(LOCATION_ALIASES)) { if (a.some(x => j.includes(x)) && a.some(x => p.includes(x))) return 0.9 }
  const jr = ['remote', 'work from home', 'wfh', 'anywhere'].some(r => j.includes(r))
  const pr = ['remote', 'work from home', 'wfh', 'anywhere'].some(r => p.includes(r))
  if (jr && pr) return 1.0; if (jr) return 0.3; if (pr) return 0.2
  const ji = j.includes('india') || ['bangalore', 'mumbai', 'delhi', 'gurgaon', 'pune', 'hyderabad', 'chennai'].includes(j)
  const pi = p.includes('india') || ['bangalore', 'mumbai', 'delhi', 'gurgaon', 'pune', 'hyderabad', 'chennai'].includes(p)
  if (ji && pi) return 0.7
  return 0
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*', 'Accept-Language': 'en-US,en;q=0.9',
}

const SOURCE_PRIORITY: Record<string, number> = { 'Internshala': 1, 'Adzuna': 2, 'JSearch': 3, 'Remotive': 4, 'Himalayas': 5, 'RemoteOK': 6, 'WeWorkRemotely': 7, 'Arbeitnow': 8 }

const ADZUNA_COUNTRY_MAP: Record<string, string> = { 'US': 'us', 'UK': 'gb', 'IN': 'in', 'CA': 'ca', 'DE': 'de', 'AU': 'au' }

async function runFetchersInParallel(keywords: string[], location: string, userCountry?: string | null) {
  const [r1, r2, r3, r4, r5, r6, r7, r8] = await Promise.allSettled([
    fetchRemotive(keywords), fetchHimalayas(keywords), fetchRemoteOK(keywords),
    fetchAdzuna(keywords, location, userCountry), fetchJSearch(keywords),
    fetchInternshala(keywords), fetchWeWorkRemotely(keywords), fetchArbeitnow(keywords),
  ])
  const ex = (res: PromiseSettledResult<JobResult[]>, name: string): JobResult[] => {
    if (res.status === 'fulfilled') return res.value
    console.log(`[Aggregator] ${name} failed:`, res.reason); return []
  }
  return { remotive: ex(r1, 'Remotive'), himalayas: ex(r2, 'Himalayas'), remoteOK: ex(r3, 'RemoteOK'), adzuna: ex(r4, 'Adzuna'), jsearch: ex(r5, 'JSearch'), internshala: ex(r6, 'Internshala'), wework: ex(r7, 'WeWorkRemotely'), arbeitnow: ex(r8, 'Arbeitnow') }
}

async function parseRSSFeed(url: string): Promise<JobResult[]> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'ScraperOS/1.0' }, signal: AbortSignal.timeout(7000) })
    if (!res.ok) return []
    const xml = await res.text(); const $ = cheerio.load(xml, { xmlMode: true }); const items: JobResult[] = []
    $('item').each((_, el) => {
      const title = $(el).find('title').text().trim(); const link = $(el).find('link').text().trim()
      const desc = $(el).find('description').text().trim()
      const postedAt = parseRelativePostedAt(desc) || normalizeDate($(el).find('pubDate').text().trim())
      const cm = desc.match(/by\s+([A-Z][A-Za-z\s&.]+)/); const company = cm ? cm[1].trim() : 'Unknown'
      const lm = desc.match(/(?:location|based in|in)\s*:?\s*([A-Za-z\s,]+)/i); const location = lm ? lm[1].trim().split(',')[0].trim() : 'India'
      const sm = desc.match(/₹[\d,]+(?:\s*-\s*₹[\d,]+)?(?:\s*\/\s*month)?/i); const salary = sm ? sm[0] : ''
      items.push({ title, company, location: location || 'India', salary, salaryObj: normalizeSalary(salary), url: link, source: 'Internshala', type: 'Internship', description: sanitizeDescription(desc), postedAt })
    })
    return items
  } catch (err) { console.log(`[Internshala] RSS failed:`, err); return [] }
}

const INTERN_SHALA_PROFILES: Record<string, string> = {
  'ai': 'artificial-intelligence', 'artificial intelligence': 'artificial-intelligence', 'machine learning': 'machine-learning',
  'web': 'web-development', 'python': 'python', 'data': 'data-science', 'data science': 'data-science',
  'java': 'java', 'react': 'react-js', 'frontend': 'web-development', 'backend': 'backend-development',
  'full stack': 'full-stack-development', 'devops': 'devops', 'cloud': 'cloud-computing', 'cyber': 'cyber-security',
  'design': 'graphic-design', 'marketing': 'digital-marketing', 'finance': 'finance', 'hr': 'human-resources',
  'business': 'business-analytics', 'consulting': 'management', 'management': 'management', 'strategy': 'management',
  'analyst': 'business-analytics', 'analytics': 'business-analytics', 'sales': 'sales', 'law': 'law',
  'research': 'research', 'economics': 'economics', 'investment': 'finance', 'banking': 'finance',
  'product': 'product-management', 'retail': 'sales', 'customer service': 'customer-service',
  'hospitality': 'hospitality-management', 'nursing': 'nursing', 'healthcare': 'healthcare',
}

export async function fetchInternshala(keywords: string[]): Promise<JobResult[]> {
  try {
    const profiles = new Set<string>()
    for (const kw of keywords) {
      const l = kw.toLowerCase()
      if (INTERN_SHALA_PROFILES[l]) profiles.add(INTERN_SHALA_PROFILES[l])
      else { const m = Object.entries(INTERN_SHALA_PROFILES).find(([k]) => l.includes(k)); if (m) profiles.add(m[1]); else profiles.add(l.replace(/\s+/g, '-')) }
    }
    const urls = [...profiles].slice(0, 5).map(p => `https://internshala.com/rss/internships/profile-${p}`)
    console.log(`[Internshala] Fetching ${urls.length} feeds`)
    const results = await Promise.all(urls.map(parseRSSFeed))
    console.log(`[Internshala] Returned ${results.flat().length} internships`)
    return results.flat()
  } catch (err) { console.log('[Internshala] Failed:', err); return [] }
}

export async function fetchRemotive(keywords: string[]): Promise<JobResult[]> {
  try {
    console.log(`[Remotive] Fetching: ${keywords.join(', ')}`)
    const res = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(keywords.join(' '))}&limit=25`, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(7000) })
    console.log(`[Remotive] Status: ${res.status}`)
    if (!res.ok) { console.log(`[Remotive] Error: ${res.status}`); return [] }
    const data = await res.json(); const jobs = (data.jobs || []).filter((j: any) => typeof j.title === 'string' && j.title.length > 0)
    console.log(`[Remotive] Got ${jobs.length} jobs`)
    return jobs.map((j: any) => ({ title: String(j.title), company: String(j.company_name), location: String(j.candidate_required_location || j.location || ''), salary: String(j.salary || ''), salaryObj: normalizeSalary(String(j.salary || '')), url: String(j.url || ''), source: 'Remotive', type: String(j.job_type || ''), description: sanitizeDescription(String(j.description || '')), postedAt: normalizeDate(j.publication_date || j.posted_at) }))
  } catch (err) { console.log(`[Remotive] Failed:`, err); return [] }
}

export async function fetchHimalayas(keywords: string[]): Promise<JobResult[]> { return [] }

export async function fetchRemoteOK(keywords: string[]): Promise<JobResult[]> {
  try {
    console.log(`[RemoteOK] Fetching all jobs`)
    const res = await fetch('https://remoteok.com/api', { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(7000) })
    if (!res.ok) { console.log(`[RemoteOK] Error: ${res.status}`); return [] }
    const data = JSON.parse(await res.text()); const jobs = Array.isArray(data) ? data.slice(1) : []
    console.log(`[RemoteOK] Got ${jobs.length} total`)
    const kw = keywords.map(k => k.toLowerCase())
    const filtered = jobs.filter((j: any) => { const t = `${String(j.position||'')} ${String(j.description||'')} ${Array.isArray(j.tags) ? j.tags.join(' ') : ''}`.toLowerCase(); return kw.some(k => t.includes(k)) })
    console.log(`[RemoteOK] Filtered to ${filtered.length}`)
    return filtered.slice(0, 25).map((j: any) => ({ title: String(j.position || ''), company: String(j.company || ''), location: String(j.location || ''), salary: String(j.salary || ''), salaryObj: normalizeSalary(String(j.salary || '')), url: String(j.url || '').startsWith('http') ? String(j.url) : `https://remoteok.com${j.url}`, source: 'RemoteOK', type: String(j.job_type || ''), description: sanitizeDescription(String(j.description || '')), postedAt: normalizeDate(j.date || j.epoch) }))
  } catch (err) { console.log(`[RemoteOK] Failed:`, err); return [] }
}

export async function fetchWeWorkRemotely(keywords: string[]): Promise<JobResult[]> {
  try {
    const cats = ['remote-programming-jobs', 'remote-customer-service-jobs', 'remote-sales-jobs']
    console.log(`[WeWorkRemotely] Fetching ${cats.length} categories`)
    const results = await Promise.all(cats.map(async cat => { try { const r = await fetch(`https://weworkremotely.com/categories/${cat}.json`, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(7000) }); if (!r.ok) return []; const d = await r.json(); return d.jobs || [] } catch { return [] } }))
    const all = results.flat(); console.log(`[WeWorkRemotely] Got ${all.length} total`)
    const kw = keywords.map(k => k.toLowerCase())
    const filtered = all.filter((j: any) => { const t = `${String(j.title||'')} ${String(j.description||'')} ${String(j.company||'')}`.toLowerCase(); return kw.some(k => t.includes(k)) })
    console.log(`[WeWorkRemotely] Filtered to ${filtered.length}`)
    return filtered.map((j: any) => ({ title: String(j.title || ''), company: String(j.company || ''), location: 'Remote', salary: String(j.salary || ''), salaryObj: normalizeSalary(String(j.salary || '')), url: String(j.url || ''), source: 'WeWorkRemotely', type: 'Full-time', description: sanitizeDescription(String(j.description || '')), postedAt: normalizeDate(j.date) }))
  } catch (err) { console.log(`[WeWorkRemotely] Failed:`, err); return [] }
}

export async function fetchArbeitnow(keywords: string[]): Promise<JobResult[]> {
  try {
    console.log(`[Arbeitnow] Fetching`)
    const res = await fetch('https://arbeitnow.com/api/job-board-api', { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(7000) })
    if (!res.ok) { console.log(`[Arbeitnow] Error: ${res.status}`); return [] }
    const data = await res.json(); const jobs = data.data || []
    console.log(`[Arbeitnow] Got ${jobs.length} total`)
    const kw = keywords.map(k => k.toLowerCase())
    const filtered = jobs.filter((j: any) => { const t = String(j.title||'').toLowerCase(); const d = String(j.description||'').toLowerCase(); return kw.some(k => t.includes(k) || d.includes(k)) })
    console.log(`[Arbeitnow] Filtered to ${filtered.length}`)
    return filtered.map((j: any) => ({ title: String(j.title || ''), company: String(j.company_name || j.company || ''), location: String(j.location || 'Remote'), salary: String(j.salary || ''), salaryObj: normalizeSalary(String(j.salary || '')), url: String(j.url || ''), source: 'Arbeitnow', type: String(j.job_type || 'Full-time'), description: sanitizeDescription(String(j.description || '')), postedAt: normalizeDate(j.created_at) }))
  } catch (err) { console.log(`[Arbeitnow] Failed:`, err); return [] }
}

export async function fetchAdzuna(keywords: string[], location: string, userCountry?: string | null): Promise<JobResult[]> {
  try {
    const appId = process.env.ADZUNA_APP_ID, appKey = process.env.ADZUNA_APP_KEY
    if (!appId || !appKey) { console.log(`[Adzuna] Skipping: no API keys`); return [] }
    const what = keywords.join(' ')
    const cc = userCountry ? (ADZUNA_COUNTRY_MAP[userCountry] || 'us') : 'in'
    const loc = location || ''
    const url = `http://api.adzuna.com/v1/api/jobs/${cc}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=20&what=${encodeURIComponent(what)}${loc ? `&where=${encodeURIComponent(loc)}` : ''}`
    console.log(`[Adzuna] Fetching: "${what}" | Country: ${cc}`)
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) })
    if (!res.ok) { const b = await res.text().catch(() => ''); console.log(`[Adzuna] Error ${res.status}: ${b.substring(0, 200)}`); return [] }
    const data = await res.json(); const results = data.results || []
    console.log(`[Adzuna] Returned ${results.length}`)
    return results.map((j: any) => ({ title: String(j.title || ''), company: String(j.company?.display_name || ''), location: String(j.location?.display_name || ''), salary: j.salary_min ? `$${j.salary_min}-$${j.salary_max}` : '', salaryObj: normalizeSalary(''), url: String(j.redirect_url || ''), source: 'Adzuna', type: String(j.contract_type || ''), description: sanitizeDescription(String(j.description || '')), postedAt: normalizeDate(j.created) }))
  } catch (err) { console.log(`[Adzuna] Failed:`, err); return [] }
}

export async function fetchJSearch(keywords: string[]): Promise<JobResult[]> {
  try {
    const apiKey = process.env.JSEARCH_API_KEY
    if (!apiKey) { console.log(`[JSearch] Skipping: no API key`); return [] }
    const query = keywords.join(' ')
    const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1&num_pages=2`
    console.log(`[JSearch] Fetching: "${query}" (2 pages)`)
    const res = await fetch(url, { headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' }, signal: AbortSignal.timeout(10000) })
    if (!res.ok) { const b = await res.text().catch(() => ''); console.log(`[JSearch] Error ${res.status}: ${b.substring(0, 300)}`); return [] }
    const data = await res.json(); const jobs = data.data || []
    console.log(`[JSearch] Returned ${jobs.length}`)
    return jobs.map((j: any) => {
      const loc = [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', ') || 'Remote'
      return { title: String(j.job_title || ''), company: String(j.employer_name || ''), location: loc, salary: j.job_min_salary ? `${j.job_min_salary}-${j.job_max_salary}` : String(j.job_salary || ''), salaryObj: normalizeSalary(''), url: String(j.job_apply_link || ''), source: 'JSearch', type: String(j.job_employment_type || ''), description: sanitizeDescription(String(j.job_description || '')), postedAt: normalizeDate(j.job_posted_at_datetime_utc) }
    })
  } catch (err) { console.log(`[JSearch] Failed:`, err); return [] }
}

export async function aggregateJobs(userQuery: string, preferredLocation?: string, userCountry?: string | null): Promise<JobResult[]> {
  console.log(`[Aggregator] Query: "${userQuery}" | Country: ${userCountry || 'unknown'}`)
  const { keywords } = await parseJobQuery(userQuery)
  const { remotive, himalayas, remoteOK, adzuna, jsearch, internshala, wework, arbeitnow } = await runFetchersInParallel(keywords, preferredLocation || '', userCountry)
  console.log(`[Aggregator] Remotive:${remotive.length} RemoteOK:${remoteOK.length} Adzuna:${adzuna.length} JSearch:${jsearch.length} Internshala:${internshala.length} WWR:${wework.length} Arbeitnow:${arbeitnow.length}`)
  const combined = [...remotive, ...himalayas, ...remoteOK, ...adzuna, ...jsearch, ...internshala, ...wework, ...arbeitnow]
  const dedupeMap = new Map<string, JobResult>()
  for (const job of combined) { const key = `${job.title.trim().toLowerCase()}|${job.company.trim().toLowerCase()}`; if (!dedupeMap.has(key)) dedupeMap.set(key, job) }
  const deduped = [...dedupeMap.values()]
  console.log(`[Aggregator] Total: ${combined.length} → Deduped: ${deduped.length}`)
  return deduped.map(j => ({ ...j, title: cleanText(j.title), description: cleanText(j.description || ''), company: cleanText(j.company), location: cleanText(j.location) }))
}

export default aggregateJobs

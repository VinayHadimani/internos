// app/api/internships/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { aggregateJobs, type JobResult } from '@/lib/aggregator';
import { callAI } from '@/lib/rotating-ai';

interface ResumeProfile {
  hard_skills: string[]; soft_skills: string[]; roles: string[];
  industry: string; experience_level: string; search_keywords: string[];
}

function cleanResumeText(text: string): string {
  return text.replace(/\(Tip:[\s\S]*?\)/g, '').replace(/^Tip:.*$/gm, '').replace(/^Page \d+$/gm, '').replace(/^((?:Resume|CV|Curriculum Vitae)\s*)$/gim, '').replace(/\n{3,}/g, '\n\n').trim();
}

function detectCountry(text: string): string | null {
  const t = text.toLowerCase()
  if (/\bunited states\b|\bu\.s\.?a\.?\b|\bamerican\b|\bphiladelphia\b|\bchicago\b|\bboston\b|\bnew york\b|\bpennsylvania\b|\bwharton\b|\bupenn\b|\bcalifornia\b|\btexas\b|\bflorida\b/.test(t)) return 'US'
  if (/\bunited kingdom\b|\bbritain\b|\blondon\b/.test(t)) return 'UK'
  if (/\bindia\b|\bmumbai\b|\bdelhi\b|\bbangalore\b|\bpune\b/.test(t)) return 'IN'
  if (/\bcanada\b|\btoronto\b|\bvancouver\b/.test(t)) return 'CA'
  return null
}

async function aiExtractProfile(resumeText: string): Promise<ResumeProfile | null> {
  try {
    const ct = cleanResumeText(resumeText)
    if (ct.length < 50) return null
    const prompt = `Analyze this resume. Return ONLY valid JSON:
{ "hard_skills": ["specific searchable skills"], "soft_skills": ["generic traits"], "roles": ["3-5 job titles"], "industry": "their industry", "experience_level": "fresher|junior|mid|senior", "search_keywords": ["4-6 job search phrases"] }
RULES: hard_skills = only specific abilities (Python, cash handling, Excel, financial modeling). NEVER "communication" or "leadership". soft_skills = traits for display only. roles = based on actual experience. search_keywords = 2-4 word phrases (e.g. "financial analyst internship", "software engineer intern"). Read career objective first if present.

Resume:\n${ct}`
    const response = await callAI(prompt, ct.slice(0, 4000), { model: 'llama-3.3-70b-versatile', temperature: 0.1, max_tokens: 800, providerPriority: ['groq', 'gemini', 'openai'] })
    if (!response.success || !response.content) { console.log('[Search] AI failed:', response.error); return null }
    let raw = response.content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    const p = JSON.parse(match[0])
    if (!Array.isArray(p.hard_skills) || !Array.isArray(p.search_keywords)) return null
    console.log(`[Search] AI OK — Skills: ${p.hard_skills.slice(0,6).join(', ')} | Roles: ${(p.roles||[]).join(', ')} | Keywords: ${p.search_keywords.join(', ')}`)
    return { hard_skills: p.hard_skills.map((s: string) => s.toLowerCase()), soft_skills: (p.soft_skills||[]).map((s: string) => s.toLowerCase()), roles: (p.roles||[]).map((r: string) => r.toLowerCase()), industry: (p.industry||'').toLowerCase(), experience_level: (p.experience_level||'entry').toLowerCase(), search_keywords: p.search_keywords }
  } catch (err: any) { console.log('[Search] AI error:', err.message); return null }
}

function scoreJob(job: JobResult, profile: ResumeProfile): number {
  const jt = `${job.title} ${job.description}`.toLowerCase(); const tl = job.title.toLowerCase()
  let sh = 0, th = 0
  for (const s of profile.hard_skills) { if (s.length < 2) continue; if (tl.includes(s)) th++; else if (jt.includes(s)) sh++ }
  let rh = 0
  for (const r of profile.roles) { if (r.length < 3) continue; const w = r.split(/\s+/).filter(x => x.length > 2); if (w.length === 0) continue; if (w.filter(x => tl.split(/\s+/).some(t => t.includes(x) || x.includes(t))).length >= Math.max(1, w.length * 0.5)) rh++ }
  if (sh === 0 && rh === 0 && th === 0) { if (/\b(intern|junior|entry|student|graduate|trainee|assistant)\b/.test(tl)) return 5; return 0 }
  let score = Math.min(th * 15, 35) + Math.min(sh * 8, 30) + Math.min(rh * 15, 25)
  if (profile.industry && jt.includes(profile.industry)) score += 10
  if (/\b(intern|internship|junior|entry[\s.-]?level|student|graduate|trainee)\b/.test(tl)) score += 5
  if (/\b(senior|sr\.?|lead|principal|director|vp|head of|chief|staff)\b/.test(tl)) score -= 20
  return Math.max(0, Math.min(100, Math.round(score)))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resumeText: string = body.resumeText || ''
    const userLocation: string = body.location || ''
    console.log('[Search] === START ===')
    let profile = resumeText.length > 50 ? await aiExtractProfile(resumeText) : null
    if (!profile) profile = { hard_skills: [], soft_skills: [], roles: [], industry: 'general', experience_level: 'student', search_keywords: ['internship'] }
    const userCountry = resumeText ? detectCountry(resumeText) : null
    console.log(`[Search] Country: ${userCountry || 'unknown'}`)
    const kw = profile.search_keywords?.length > 0 ? profile.search_keywords : [...profile.hard_skills, ...profile.roles].slice(0, 6)
    const query = kw.join(' ')
    console.log(`[Search] Query: "${query}"`)
    const allJobs = await aggregateJobs(query, userLocation || undefined, userCountry)
    console.log(`[Search] Fetched ${allJobs?.length || 0} jobs`)
    if (!allJobs || allJobs.length === 0) { return NextResponse.json({ success: true, total: 0, detected_skills: [...profile.hard_skills, ...profile.soft_skills], detected_domains: [profile.industry], target_roles: profile.roles, jobs: [], count: 0 }) }
    const seen = new Set<string>()
    const deduped = allJobs.filter(j => { const k = `${j.title.toLowerCase().replace(/[^a-z0-9]/g, '')}|${j.company.toLowerCase().replace(/[^a-z0-9]/g, '')}`; if (seen.has(k)) return false; seen.add(k); return true })
    const scored = deduped.map(j => ({ ...j, matchScore: scoreJob(j, profile) })).sort((a, b) => b.matchScore - a.matchScore)
    const good = scored.filter(j => j.matchScore >= 15)
    const result = good.length >= 5 ? good.slice(0, 50) : scored.slice(0, 20)
    console.log(`[Search] Matches >= 15%: ${good.length} | Returning: ${result.length}`)
    if (result.length > 0) console.log(`[Search] Top 3: ${result.slice(0, 3).map(j => `${j.title} (${j.matchScore}%) [${j.source}]`).join(' | ')}`)
    console.log('[Search] === END ===')
    return NextResponse.json({ success: true, total: result.length, detected_skills: [...profile.hard_skills, ...profile.soft_skills], detected_domains: [profile.industry], target_roles: profile.roles, jobs: result, count: result.length })
  } catch (error) { console.log('[Search] Error:', error); return NextResponse.json({ success: false, error: 'Search failed' }, { status: 500 }) }
}

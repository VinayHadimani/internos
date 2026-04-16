import { NextRequest, NextResponse } from 'next/server';
import { aggregateJobs, type JobResult } from '@/lib/aggregator';
import { callAI } from '@/lib/rotating-ai';

// ============================================================
// INTERFACES
// ============================================================

interface ResumeProfile {
  hard_skills: string[];
  soft_skills: string[];
  roles: string[];
  industry: string;
  experience_level: string;
  search_keywords: string[];
}

// ============================================================
// STOPWORDS — generic single-words that inflate scores on EVERY job.
// "data", "management", "development" appear in almost all job descriptions
// and should NOT count as skill matches.
// ============================================================

const SKILL_STOPWORDS = new Set([
  'data', 'analysis', 'management', 'development', 'design',
  'support', 'services', 'solutions', 'systems', 'technology',
  'business', 'operations', 'project', 'projects', 'process',
  'processes', 'team', 'work', 'working', 'experience',
  'responsibilities', 'requirements', 'communication', 'strategy',
  'strategic', 'planning', 'reporting', 'customer', 'clients',
  'stakeholders', 'research', 'writing', 'presentation',
  'organization', 'coordination', 'implementation', 'collaboration',
  'leadership', 'marketing', 'sales', 'learning', 'education',
  'training', 'program', 'programs', 'role', 'professional',
  'office', 'administrative', 'performance', 'product', 'quality',
  'initiative', 'compliance', 'regulatory', 'risk', 'governance',
]);

// ============================================================
// FIX 1: COUNTRY DETECTION from resume text
// ============================================================

function detectCountry(resumeText: string): string | null {
  const text = resumeText.toLowerCase();

  const US_PATTERNS = [
    /\bunited states\b/, /\bu\.?s\.?a\.?\b/,
    /\bnew york\b/, /\bcalifornia\b/, /\btexas\b/, /\bflorida\b/,
    /\billinois\b/, /\bpennsylvania\b/, /\bohio\b/, /\bgeorgia\b/,
    /\bvirginia\b/, /\bwashington\b/, /\bariz(?:ona)?\b/,
    /\bmassachusetts\b/, /\btennessee\b/, /\bcolorado\b/,
    /\bminnesota\b/, /\boregon\b/, /\bmaryland\b/, /\bwisconsin\b/,
    /\bnew jersey\b/, /\bwashington d\.?c\.?\b/, /\bphiladelphia\b/,
    /\bchicago\b/, /\bhouston\b/, /\batlanta\b/, /\bboston\b/,
    /\bsan francisco\b/, /\blos angeles\b/, /\bseattle\b/,
    /\bmiami\b/, /\bdallas\b/, /\bdenver\b/, /\baustin\b/,
    /\bwharton\b/, /\bupenn\b/, /\bivy league\b/, /\bstanford\b/,
    /\bmit\b/, /\bharvard\b/, /\byale\b/, /\bprinceton\b/,
    /\bcolumbia university\b/, /\bberkeley\b/,
    /\+1[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/,
  ];
  for (const p of US_PATTERNS) if (p.test(text)) return 'US';

  const UK_PATTERNS = [
    /\bunited kingdom\b/, /\bbritain\b/, /\bengland\b/,
    /\bscotland\b/, /\bwales\b/, /\blondon\b/, /\bmanchester\b/,
    /\bbirmingham\b/, /\bedinburgh\b/, /\bglasgow\b/, /\bbristol\b/,
    /\b(?<![a-z])uk(?![a-z])\b/,
  ];
  for (const p of UK_PATTERNS) if (p.test(text)) return 'UK';

  const IN_PATTERNS = [
    /\bindia\b/, /\bmumbai\b/, /\bdelhi\b/, /\bbangalore\b/,
    /\bbengaluru\b/, /\bchennai\b/, /\bhyderabad\b/, /\bpune\b/,
    /\bkolkata\b/, /\bkarnataka\b/, /\bmaharashtra\b/, /\biit\b/,
  ];
  for (const p of IN_PATTERNS) if (p.test(text)) return 'IN';

  const CA_PATTERNS = [
    /\bcanada\b/, /\btoronto\b/, /\bvancouver\b/, /\bmontreal\b/,
    /\bcalgary\b/, /\bottawa\b/, /\bedmonton\b/, /\bontario\b/,
    /\bquebec\b/, /\bbritish columbia\b/,
  ];
  for (const p of CA_PATTERNS) if (p.test(text)) return 'CA';

  const AU_PATTERNS = [
    /\baustralia\b/, /\bmelbourne\b/, /\bsydney\b/, /\bbrisbane\b/,
    /\bperth\b/, /\badelaide\b/, /\bcanberra\b/, /\bvictoria\b/,
    /\bnew south wales\b/, /\bqueensland\b/,
  ];
  for (const p of AU_PATTERNS) if (p.test(text)) return 'AU';

  const DE_PATTERNS = [
    /\bgermany\b/, /\bdeutschland\b/, /\bberlin\b/,
    /\bmunich\b/, /\bhamburg\b/, /\bfrankfurt\b/, /\bstuttgart\b/,
  ];
  for (const p of DE_PATTERNS) if (p.test(text)) return 'DE';

  return null;
}

// ============================================================
// FIX 2: GERMAN LANGUAGE FILTER
// Removes German-language job posts for non-DE candidates
// ============================================================

function isLikelyGermanJob(job: JobResult): boolean {
  const text = `${job.title} ${job.description ?? ''}`.toLowerCase();
  const markers = [
    'wir suchen', 'aufgaben', 'qualifikation', 'ihr profil', 'sie haben',
    'wir bieten', 'm/w/d', 'werkstudent', 'bewerben sie', 'arbeitgeber',
    'vergütung', 'ihr auftrag', 'unser kunde', 'sie verantworten',
    'sie unterstützen', 'sie entwickeln', 'mitwirkung bei', 'sie bringen',
    'wir freuen', 'ihre aufgaben', 'ansprechpartner', 'sie verfügen',
    'ihre rolle', 'unsere klienten', 'sie betreuen',
  ];
  return markers.filter(m => text.includes(m)).length >= 3;
}

// ============================================================
// RESUME CLEANER
// ============================================================

function cleanResumeText(text: string): string {
  return text
    .replace(/\(Tip:[\s\S]*?\)/g, '')
    .replace(/^Tip:.*$/gm, '')
    .replace(/^Page \d+$/gm, '')
    .replace(/^((?:Resume|CV|Curriculum Vitae)\s*)$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================================
// AI PROFILE EXTRACTION — uses callAI for key rotation
// ============================================================

async function aiExtractProfile(resumeText: string): Promise<ResumeProfile | null> {
  try {
    const cleanedText = cleanResumeText(resumeText);
    if (cleanedText.length < 50) return null;

    const systemPrompt = `You are a resume analysis assistant. Always respond with valid JSON only, no markdown, no code fences, no extra text.`;

    const userPrompt = `You are a job search engine. Read this resume and figure out exactly what jobs this person should find.

This resume could be from ANY career — retail, healthcare, engineering, finance, arts, sports, hospitality, law, education, trades, government, anything.

Return ONLY valid JSON:
{
  "hard_skills": ["every SPECIFIC skill found — technical abilities, tools, software, equipment, certifications. For entry-level: cash handling, basic math, Microsoft Office are valid"],
  "soft_skills": ["communication, teamwork, leadership etc — display only, NOT used for matching"],
  "roles": ["3-5 realistic job titles this person would apply for, based on their actual experience and education"],
  "industry": "the ONE industry that best describes their work",
  "experience_level": "fresher or junior or mid or senior",
  "search_keywords": ["5-8 EXACT phrases to type into Indeed or LinkedIn. Combine role + skill + level. Examples: retail sales assistant, java developer internship, store cashier part time, financial analyst graduate. NEVER generic words like communication or teamwork."]
}

RULES:
- If Career Objective or Professional Summary exists, read it FIRST to understand what they WANT.
- hard_skills = specific searchable abilities. NOT generic traits.
- search_keywords = most important field. Never use stopwords. Always combine role+skill+level.

RESUME:
${cleanedText.slice(0, 4000)}`;

    const response = await callAI(systemPrompt, userPrompt, {
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 1000,
      providerPriority: ['groq', 'gemini', 'openai'],
    });

    if (!response.success || !response.content) return null;

    let raw = response.content;
    // Strip markdown fences if present
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) raw = fenceMatch[1];
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as ResumeProfile;

    if (!Array.isArray(parsed.hard_skills) || !Array.isArray(parsed.roles) || !Array.isArray(parsed.search_keywords)) {
      return null;
    }

    const profile: ResumeProfile = {
      hard_skills:     parsed.hard_skills.map((s: string) => s.toLowerCase().trim()),
      soft_skills:     Array.isArray(parsed.soft_skills) ? parsed.soft_skills.map((s: string) => s.toLowerCase().trim()) : [],
      roles:           parsed.roles.map((r: string) => r.toLowerCase().trim()),
      industry:        typeof parsed.industry === 'string' ? parsed.industry.toLowerCase().trim() : '',
      experience_level: typeof parsed.experience_level === 'string' ? parsed.experience_level.toLowerCase().trim() : 'entry',
      search_keywords: parsed.search_keywords,
    };

    console.log(`[Search] AI — Industry: ${profile.industry}, Level: ${profile.experience_level}`);
    console.log(`[Search] Hard Skills: ${profile.hard_skills.slice(0, 8).join(', ')}`);
    console.log(`[Search] Roles: ${profile.roles.join(', ')}`);
    console.log(`[Search] Keywords: ${profile.search_keywords.join(', ')}`);

    return profile;
  } catch (err: any) {
    console.error('[Search] AI extraction error:', err.message);
    return null;
  }
}

// Minimal fallback — only used if AI completely fails
function fallbackExtractProfile(clientSkills: string[], clientRoles: string[]): ResumeProfile {
  const SOFT = new Set([
    'communication', 'teamwork', 'leadership', 'problem solving', 'critical thinking',
    'time management', 'adaptability', 'creativity', 'work ethic', 'attention to detail',
    'collaboration', 'customer service',
  ]);
  const hardSkills = (clientSkills || []).filter(s => s && !SOFT.has(s.toLowerCase()));
  return {
    hard_skills: hardSkills,
    soft_skills: [],
    roles: (clientRoles || []).slice(0, 5),
    industry: 'general',
    experience_level: 'entry',
    search_keywords: [
      ...(clientRoles || []).slice(0, 2),
      ...hardSkills.slice(0, 2).map(s => `${s} internship`),
    ],
  };
}

// ============================================================
// FIX 3: IMPROVED SCORING
// - Stopwords prevent generic words from matching everything
// - Title matches score higher than description-only matches
// - Country penalty removes irrelevant international jobs
// ============================================================

function scoreJob(job: JobResult, profile: ResumeProfile, userCountry: string | null): number {
  const titleLower = (job.title || '').toLowerCase();
  const jobText = `${titleLower} ${(job.description || '').toLowerCase()}`;

  // --- Hard skill matching (skip stopword skills) ---
  let titleSkillMatches = 0;
  let descSkillMatches = 0;

  for (const skill of profile.hard_skills) {
    const s = skill.toLowerCase();
    if (s.length < 2) continue;
    // Skip generic words — they match every job and inflate scores
    if (SKILL_STOPWORDS.has(s)) continue;

    const words = s.split(/\s+/);
    const inTitle = words.every(w => titleLower.includes(w));
    const inDesc  = !inTitle && words.every(w => jobText.includes(w));

    if (inTitle) titleSkillMatches++;
    else if (inDesc) descSkillMatches++;
  }

  // --- Role matching (title-only, partial) ---
  let roleMatches = 0;
  for (const role of profile.roles) {
    if (role.length < 3) continue;
    const roleWords = role.split(/\s+/).filter(w => w.length > 2);
    if (roleWords.length === 0) continue;
    const titleWords = titleLower.split(/\s+/);
    const matched = roleWords.filter(w => titleWords.some(tw => tw.includes(w) || w.includes(tw))).length;
    if (matched >= Math.max(1, roleWords.length * 0.5)) roleMatches++;
  }

  // ═══ THE KEY RULE: zero matches = zero score — no free points ═══
  if (titleSkillMatches === 0 && descSkillMatches === 0 && roleMatches === 0) return 0;

  let score = 0;

  // Title skill match: strong signal — 20pts each, max 40
  score += Math.min(titleSkillMatches * 20, 40);
  // Description skill match: weaker signal — 12pts each, max 40
  score += Math.min(descSkillMatches * 12, 40);
  // Role match: 20pts each, max 30
  score += Math.min(roleMatches * 20, 30);

  // Industry keyword bonus: 8pts
  const industry = (profile.industry || '').toLowerCase();
  if (industry && industry !== 'general' && industry.length > 3) {
    const industryWords = industry.split(/\s+/).filter(w => w.length > 3);
    if (industryWords.some(w => jobText.includes(w))) score += 8;
  }

  // Entry-level bonus
  const isEntry = ['fresher', 'entry', 'junior', 'student'].includes(profile.experience_level);
  if (isEntry && /\b(intern|internship|junior|entry[\s.-]?level|student|graduate|trainee|apprentice)\b/.test(titleLower)) {
    score += 10;
  }

  // Senior penalty
  if (isEntry && /\b(senior|sr\.?|lead|principal|director|vp|vice president|head of|chief|staff)\b/.test(titleLower)) {
    score -= 30;
  }

  // ── Country boost / penalty ──
  if (userCountry) {
    const loc = (job.location || '').toLowerCase();

    if (userCountry === 'US') {
      if (/\b(remote|usa|u\.s\.?a?|united states)\b/.test(loc) || /\bremote\b/.test(titleLower)) score += 5;
      if (/\b(germany|deutschland|münchen|munich|berlin|frankfurt|hamburg|cologne|philippines|manila|india|mumbai|delhi)\b/.test(loc)) score -= 15;
    } else if (userCountry === 'UK') {
      if (/\b(united kingdom|uk|london|manchester|birmingham|remote)\b/.test(loc) || /\bremote\b/.test(titleLower)) score += 5;
      if (/\b(germany|deutschland|philippines|india|mumbai)\b/.test(loc)) score -= 15;
    } else if (userCountry === 'IN') {
      if (/\b(india|mumbai|delhi|bangalore|bengaluru|chennai|hyderabad|pune|remote)\b/.test(loc) || /\bremote\b/.test(titleLower)) score += 5;
    } else if (userCountry === 'CA') {
      if (/\b(canada|toronto|vancouver|montreal|remote)\b/.test(loc) || /\bremote\b/.test(titleLower)) score += 5;
      if (/\b(germany|deutschland|philippines|india)\b/.test(loc)) score -= 15;
    } else if (userCountry === 'AU') {
      if (/\b(australia|melbourne|sydney|brisbane|perth|adelaide|remote)\b/.test(loc) || /\bremote\b/.test(titleLower)) score += 5;
      if (/\b(germany|deutschland|india|philippines)\b/.test(loc)) score -= 15;
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getMatchLabel(score: number): string {
  if (score >= 75) return 'Excellent Match';
  if (score >= 55) return 'Good Match';
  if (score >= 35) return 'Moderate Match';
  return 'Partial Match';
}

// ============================================================
// DEDUPLICATION — prefix-match on title+company
// ============================================================

function normalizeForDedup(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function deduplicateJobs(jobs: JobResult[]): JobResult[] {
  const seen: Array<{ normTitle: string; normCompany: string }> = [];
  const result: JobResult[] = [];

  for (const job of jobs) {
    const normTitle   = normalizeForDedup(job.title);
    const normCompany = normalizeForDedup(job.company);

    const isDup = seen.some(s => {
      const titleMatch   = normTitle.startsWith(s.normTitle) || s.normTitle.startsWith(normTitle);
      const companyMatch = normCompany.startsWith(s.normCompany) || s.normCompany.startsWith(normCompany);
      return titleMatch && companyMatch;
    });

    if (!isDup) {
      seen.push({ normTitle, normCompany });
      result.push(job);
    }
  }

  return result;
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      resumeText = '',
      location: bodyLocation = '',
      skills: clientSkills = [],
      preferredRoles: clientRoles = [],
    } = body;

    if (!resumeText || resumeText.length < 50) {
      return NextResponse.json(
        { success: false, error: 'Resume text is required and must be at least 50 characters.' },
        { status: 400 }
      );
    }

    console.log('=== INTERNOS SEARCH ===');

    // ── Step 1: Extract profile ──
    const aiProfile = await aiExtractProfile(resumeText);
    const profile: ResumeProfile = aiProfile ?? fallbackExtractProfile(
      Array.isArray(clientSkills) ? clientSkills.map(String) : [],
      Array.isArray(clientRoles)  ? clientRoles.map(String)  : [],
    );

    console.log(`[Search] Profile ready in ${Date.now() - startTime}ms — Hard skills: ${profile.hard_skills.length}, Roles: ${profile.roles.length}`);

    // ── Step 2: Detect country ──
    const userCountry = detectCountry(resumeText);
    console.log(`[Search] Detected country: ${userCountry ?? 'unknown'}`);

    // ── Step 3: Build search queries ──
    const searchQueries = [...new Set([
      ...profile.search_keywords.slice(0, 4),
      ...profile.roles.slice(0, 2),
    ])].slice(0, 5);
    if (searchQueries.length === 0) searchQueries.push('internship');
    console.log(`[Search] Queries: ${searchQueries.join(' | ')}`);

    // ── Step 4: Fetch jobs in parallel for all queries ──
    const userLocation = bodyLocation || '';
    const allJobsMap = new Map<string, JobResult>();
    // ── Step 4: Fetch jobs from all sources ──
    const allJobs = await aggregateJobs(searchQueries.join(' '), bodyLocation || undefined, userCountry);
    console.log(`[Search] Fetched ${allJobs?.length || 0} total jobs in ${Date.now() - startTime}ms`);

    // ── Step 5: Keep all jobs (country penalty in scoring handles filtering) ──
    const filtered = allJobs || [];

    // ── Step 6: Deduplicate ──
    const deduped = deduplicateJobs(filtered);
    console.log(`[Search] After dedup: ${deduped.length} (removed ${filtered.length - deduped.length} duplicates)`);

    // ── Step 7: Score, filter, rank ──
    const scored = deduped
      .map(job => ({
        ...job,
        matchScore: scoreJob(job, profile, userCountry),
        matchLabel: getMatchLabel(scoreJob(job, profile, userCountry)),
      }))
      .filter(job => job.matchScore >= 20)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 50);

    const zeroCount = deduped.filter(j => scoreJob(j, profile, userCountry) === 0).length;
    console.log(`[Search] ${scored.length} relevant jobs (${zeroCount} zero-scored filtered out, top: ${scored[0]?.matchScore ?? 0}%) in ${Date.now() - startTime}ms`);
    if (scored.length > 0) {
      console.log(`[Search] Top 3: ${scored.slice(0, 3).map(j => `${j.title} (${j.matchScore}%)`).join(', ')}`);
    }

    return NextResponse.json({
      // ── Fields the frontend reads ──
      success: true,
      jobs: scored,
      total: scored.length,
      detected_skills: [...profile.hard_skills, ...profile.soft_skills],
      detected_domains: [profile.industry],
      target_roles: profile.roles,
      profile,
      // ── Debug metadata ──
      total_fetched: allJobs.length,
      zero_match_filtered: zeroCount,
      country_detected: userCountry,
      search_queries_used: searchQueries,
    });

  } catch (error) {
    console.error('[Search] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: 'Search failed. Please try again.' },
      { status: 500 }
    );
  }
}

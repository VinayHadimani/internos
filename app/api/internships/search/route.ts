// app/api/internships/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { aggregateJobs, type JobResult as Job } from '@/lib/aggregator';

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

// ==========================================
// UTILS
// ==========================================

function cleanResumeText(text: string): string {
  // Remove template instructions/tips from common resume builders
  // Use character class to support multi-line matching on older targets
  return text
    .replace(/\(Tip:[\s\S]*?\)/gi, '')
    .replace(/^Tip:.*$/gm, '')
    .replace(/^Page \d+$/gm, '')
    .replace(/^((?:Resume|CV|Curriculum Vitae)\s*)$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function detectCountry(resumeText: string): string | null {
  const text = resumeText.toLowerCase();
  
  // Standard location patterns
  const usPatterns = [
    /\bunited states\b/, /\bu\.s\.?a\.?\b/, /\bamerican\b/,
    /\bnew york\b/, /\bcalifornia\b/, /\btexas\b/, /\bflorida\b/,
    /\billinois\b/, /\bpennsylvania\b/, /\bohio\b/, /\bgeorgia\b/,
    /\bnorth carolina\b/, /\bmichigan\b/, /\bvirginia\b/, /\bwashington\b/,
    /\barizona\b/, /\bmassachusetts\b/, /\btennessee\b/, /\bindiana\b/,
    /\bcolorado\b/, /\bminnesota\b/, /\boregon\b/, /\bconnecticut\b/,
    /\bmaryland\b/, /\bwisconsin\b/, /\bnevada\b/, /\bnew jersey\b/,
    /\bwashington d\.?c\.?\b/, /\bphiladelphia\b/, /\bchicago\b/,
    /\bhouston\b/, /\batlanta\b/, /\bboston\b/, /\bsan francisco\b/,
    /\blos angeles\b/, /\bseattle\b/, /\bmiami\b/, /\bdallas\b/,
    /\bdenver\b/, /\baustin\b/, /\bnashville\b/, /\bphoenix\b/,
    /\bwharton\b/, /\bupenn\b/, /\bivy league\b/,
    /\bstanford\b/, /\bmit\b/, /\bharvard\b/, /\byale\b/,
    /\bprinceton\b/, /\bcolumbia university\b/, /\bberkeley\b/,
    /\+1[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/, // US phone
  ];
  for (const p of usPatterns) { if (p.test(text)) return 'US'; }

  const ukPatterns = [
    /\bunited kingdom\b/, /\bbritain\b/, /\blondon\b/, /\bmanchester\b/,
    /\bbirmingham\b/, /\bedinburgh\b/, /\buk\b/, /\bengland\b/, /\bscotland\b/,
    /\bwalsh\b/, /\boxford\b/, /\bcambridge\b/, /\blse\b/, /\bucl\b/,
  ];
  for (const p of ukPatterns) { if (p.test(text)) return 'UK'; }

  const inPatterns = [
    /\bindia\b/, /\bmumbai\b/, /\bdelhi\b/, /\bbangalore\b/, /\bpune\b/,
    /\bchennai\b/, /\bhyderabad\b/, /\biit\b/, /\bnit\b/, /\bbits\b/,/\bbengaluru\b/,/\bgurgaon\b/,/\bnoida\b/
  ];
  for (const p of inPatterns) { if (p.test(text)) return 'IN'; }

  const caPatterns = [
    /\bcanada\b/, /\btoronto\b/, /\bvancouver\b/, /\bmontreal\b/, /\bontario\b/, /\bcbc\b/, /\buoft\b/, /\bmcgill\b/, /\buwaterloo\b/
  ];
  for (const p of caPatterns) { if (p.test(text)) return 'CA'; }

  const auPatterns = [
    /\baustralia\b/, /\bsydney\b/, /\bmelbourne\b/, /\bbrisbane\b/, /\bperth\b/, /\bau\b/
  ];
  for (const p of auPatterns) { if (p.test(text)) return 'AU'; }

  const dePatterns = [
    /\bgermany\b/, /\bdeutschland\b/, /\bberlin\b/, /\bmünchen\b/, /\bhamburg\b/, /\bfrankfurt\b/, /\bmunich\b/
  ];
  for (const p of dePatterns) { if (p.test(text)) return 'DE'; }

  return null;
}

// ==========================================
// AI PROFILE EXTRACTION
// ==========================================

async function aiExtractProfile(resumeText: string): Promise<ResumeProfile | null> {
  try {
    const cleanedText = cleanResumeText(resumeText);
    const prompt = `You are a professional resume analyzer. Analyze this resume effectively.

IMPORTANT RULES:
1. Only extract skills explicitly mentioned.
2. Separate HARD SKILLS (technical, tools, POS systems, certifications) from SOFT SKILLS (communication, teamwork).
3. Identify TARGET ROLES based on career objective + experience.
4. "cash handling", "operating cash register", "POS systems" are HARD SKILLS for retail.
5. Generate 5-8 specific search keywords for finding relevant jobs.

Return ONLY valid JSON:
{
  "hard_skills": ["skill1", "skill2"],
  "soft_skills": ["skill1", "skill2"],
  "roles": ["role1", "role2"],
  "industry": "primary industry",
  "experience_level": "student" | "entry" | "mid" | "senior",
  "search_keywords": ["keyword1", "keyword2"]
}

Resume:
${cleanedText}`;

    const apiKey = process.env.GROQ_API_KEY || process.env.GROQ_API_KEYS;
    if (!apiKey) return null;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.split(',')[0]}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a professional resume parser. Return valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const profile = JSON.parse(jsonMatch[0]);

    return {
      hard_skills: Array.isArray(profile.hard_skills) ? profile.hard_skills.map((s: string) => s.toLowerCase().trim()) : [],
      soft_skills: Array.isArray(profile.soft_skills) ? profile.soft_skills.map((s: string) => s.toLowerCase().trim()) : [],
      roles: Array.isArray(profile.roles) ? profile.roles.map((r: string) => r.toLowerCase().trim()) : [],
      industry: typeof profile.industry === 'string' ? profile.industry.toLowerCase().trim() : '',
      experience_level: typeof profile.experience_level === 'string' ? profile.experience_level.toLowerCase().trim() : 'entry',
      search_keywords: Array.isArray(profile.search_keywords) ? profile.search_keywords : [],
    };
  } catch (err) {
    console.error('[Search] AI extraction error:', err);
    return null;
  }
}

function fallbackExtractProfile(data: any): ResumeProfile {
  return {
    hard_skills: (data.skills || []).map((s: string) => s.toLowerCase().trim()),
    soft_skills: [],
    roles: (data.roles || []).map((r: string) => r.toLowerCase().trim()),
    industry: data.industry || '',
    experience_level: data.experience_level || 'entry',
    search_keywords: [],
  };
}

// ==========================================
// SCORING ENGINE
// ==========================================

function scoreJob(job: Job, profile: ResumeProfile): number {
  const jobText = `${job.title} ${job.description}`.toLowerCase();
  const titleLower = job.title.toLowerCase();

  let hardSkillMatches = 0;
  let titleSkillMatches = 0;

  for (const skill of profile.hard_skills) {
    if (skill.length < 2) continue;
    if (titleLower.includes(skill)) {
      titleSkillMatches++;
    } else if (jobText.includes(skill)) {
      hardSkillMatches++;
    }
  }

  let roleMatches = 0;
  for (const role of profile.roles) {
    if (role.length < 3) continue;
    const roleWords = role.split(/\s+/).filter(w => w.length > 2);
    if (roleWords.length === 0) continue;
    const titleWords = titleLower.split(/\s+/);
    const matchCount = roleWords.filter(
      w => titleWords.some(tw => tw.includes(w) || w.includes(tw))
    ).length;
    if (matchCount >= Math.max(1, roleWords.length * 0.5)) {
      roleMatches++;
    }
  }

  // Zero match = Zero score
  if (hardSkillMatches === 0 && roleMatches === 0 && titleSkillMatches === 0) {
    return 0;
  }

  let score = 0;
  score += Math.min(titleSkillMatches * 20, 40);
  score += Math.min(hardSkillMatches * 12, 40);
  score += Math.min(roleMatches * 20, 30);

  if (profile.industry && jobText.includes(profile.industry)) {
    score += 8;
  }

  if (profile.experience_level === 'student' || profile.experience_level === 'entry') {
    if (/\b(intern|internship|junior|entry[\s.-]?level|student|graduate|trainee|apprentice)\b/.test(titleLower)) {
      score += 10;
    }
  }

  // Penalty for seniors
  if (profile.experience_level === 'student' || profile.experience_level === 'entry') {
    if (/\b(senior|sr\.?|lead|principal|director|vp|vice president|head of|chief|staff)\b/.test(titleLower)) {
      score -= 30;
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ==========================================
// DEDUPLICATION
// ==========================================

function normalizeForDedup(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function deduplicateJobs(jobs: Job[]): Job[] {
  const seen = new Map<string, string[]>();
  return jobs.filter(job => {
    const normTitle = normalizeForDedup(job.title);
    const normCompany = normalizeForDedup(job.company);

    for (const [, entries] of seen) {
      for (const entry of entries) {
        const titleMatch = normTitle.includes(entry) || entry.includes(normTitle);
        const companyMatch = normCompany.includes(entry) || entry.includes(normCompany);
        if (titleMatch && companyMatch) return false;
      }
    }

    const key = normCompany;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(normTitle);
    return true;
  });
}

// ==========================================
// MAIN ROUTE
// ==========================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeText, location: bodyLocation } = body;

    if (!resumeText || typeof resumeText !== 'string' || resumeText.length < 50) {
      return NextResponse.json({ error: 'Resume text is required' }, { status: 400 });
    }

    const startTime = Date.now();

    // ── Step 1: Detect country ──
    const userCountry = detectCountry(resumeText);
    console.log(`[Search] Detected country: ${userCountry || 'unknown'}`);

    // ── Step 2: Extract profile ──
    const profile = await aiExtractProfile(resumeText);
    const finalProfile = profile || fallbackExtractProfile({ skills: [], roles: [] });

    console.log(`[Search] Hard skills: ${finalProfile.hard_skills.join(', ')}`);
    console.log(`[Search] Target roles: ${finalProfile.roles.join(', ')}`);

    // ── Step 3: Build search keywords ──
    const keywords = finalProfile.search_keywords.length > 0
      ? finalProfile.search_keywords
      : [...finalProfile.hard_skills, ...finalProfile.roles].slice(0, 6);
    
    if (keywords.length === 0) keywords.push('internship');
    console.log(`[Search] Queries: ${keywords.join(' | ')}`);

    // ── Step 4: Fetch jobs from all sources ──
    // FIX: keywords.join(' ') handles array to string conversion
    const allJobs = await aggregateJobs(keywords.join(' '), bodyLocation || undefined, userCountry);
    console.log(`[Search] Fetched ${allJobs?.length || 0} total jobs in ${Date.now() - startTime}ms`);

    // ── Step 5: Keep all jobs (allow cross-country results) ──
    const filtered = allJobs || [];

    // ── Step 6: Deduplicate ──
    const deduped = deduplicateJobs(filtered);
    console.log(`[Search] After dedup: ${deduped.length}`);

    // ── Step 7: Score, filter, rank ──
    const scored = deduped
      .map(job => ({
        ...job,
        matchScore: scoreJob(job, finalProfile),
      }))
      .filter(job => job.matchScore >= 15) // Minimal match threshold
      .sort((a, b) => b.matchScore - a.matchScore);

    console.log(`[Search] ${scored.length} relevant jobs scored >= 15%`);
    if (scored.length > 0) {
      console.log(`[Search] Top 3: ${scored.slice(0, 3).map(j => `${j.title} (${j.matchScore}%)`).join(', ')}`);
    }

    return NextResponse.json({
      success: true,
      jobs: scored.slice(0, 50),
      total: scored.length,
      detected_skills: [...finalProfile.hard_skills, ...finalProfile.soft_skills],
      target_roles: finalProfile.roles,
      profile: finalProfile,
      country_detected: userCountry,
    });

  } catch (error) {
    console.error('[Search] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: 'Search failed. Please try again.' },
      { status: 500 }
    );
  }
}

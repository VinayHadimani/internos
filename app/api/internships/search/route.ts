import { NextRequest, NextResponse } from 'next/server';
import { aggregateJobs, type JobResult } from '@/lib/aggregator';
import { callAI } from '@/lib/rotating-ai';

// ══════════════════════════════════════════════════════
// AI-POWERED RESUME → JOB MATCHING PIPELINE
//
// Flow:
// 1. AI reads resume → extracts skills, target roles, domain
// 2. Build search queries from AI output
// 3. Fetch jobs from aggregator using those queries
// 4. Score each job against AI-extracted profile
// ══════════════════════════════════════════════════════

interface ResumeProfile {
  skills: string[];
  target_roles: string[];
  domain: string;
  experience_level: string;
  search_queries: string[];
}

/**
 * Use AI (Groq/Gemini) to deeply analyze the resume and extract
 * what kind of jobs this person should be searching for.
 */
async function aiExtractProfile(resumeText: string): Promise<ResumeProfile | null> {
  try {
    const response = await callAI(
      `You are a career advisor AI. Analyze the resume and extract a structured profile.
Return ONLY valid JSON, no markdown, no explanation.`,
      `RESUME:
${resumeText.slice(0, 4000)}

Return this exact JSON structure:
{
  "skills": ["list", "of", "all", "technical", "and", "domain", "skills", "found"],
  "target_roles": ["specific role titles this person should apply for, e.g. 'management consulting intern', 'data analyst', 'frontend developer'"],
  "domain": "the primary career domain: one of 'consulting', 'finance', 'software_engineering', 'data_science', 'marketing', 'operations', 'healthcare', 'design', 'legal', 'hr', 'product_management', 'general'",
  "experience_level": "one of: 'student', 'fresher', 'junior', 'mid', 'senior'",
  "search_queries": ["5-6 specific job search queries to find matching internships/jobs, e.g. 'management consulting intern', 'strategy analyst internship', 'business analyst summer 2026'"]
}

RULES:
- Extract ALL skills mentioned: technical (python, excel, sql), domain (financial modeling, case studies), soft skills (leadership, communication)
- target_roles should be SPECIFIC and realistic for this person's background (not generic like 'software developer')
- search_queries should be practical search terms for job boards - include "intern" or "internship" for students/freshers
- If this is a consulting resume, search for consulting/strategy/analyst roles, NOT software engineering
- If this is a finance resume, search for finance/banking/analyst roles
- If this is a tech resume, search for developer/engineer/SWE roles
- Be domain-aware: consulting people want McKinsey/BCG-type roles, not React developer jobs`,
      {
        model: 'gemini-1.5-flash', // Try 1.5 flash since 2.0 quota is maxed
        temperature: 0.1,
        max_tokens: 800,
        providerPriority: ['gemini', 'groq', 'openai'] // Try Gemini first since Groq often 429s
      }
    );

    if (!response.success || !response.content) {
      console.error('[Search] AI profile extraction failed:', response.error);
      return null;
    }

    let raw = response.content;
    // Clean markdown wrapping if present
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    
    const parsed = JSON.parse(raw) as ResumeProfile;
    
    // Validate
    if (!parsed.skills || !Array.isArray(parsed.skills)) return null;
    if (!parsed.search_queries || !Array.isArray(parsed.search_queries)) return null;
    
    console.log(`[Search] AI Profile — Domain: ${parsed.domain}, Skills: ${parsed.skills.slice(0, 8).join(', ')}`);
    console.log(`[Search] AI Profile — Target Roles: ${parsed.target_roles?.join(', ')}`);
    console.log(`[Search] AI Profile — Search Queries: ${parsed.search_queries.join(', ')}`);
    
    return parsed;
  } catch (err: any) {
    console.error('[Search] AI profile extraction error:', err.message);
    return null;
  }
}

/**
 * Fallback: basic keyword extraction when AI is unavailable.
 */
function fallbackExtractProfile(resumeText: string, clientSkills: string[], clientRoles: string[]): ResumeProfile {
  const lower = resumeText.toLowerCase();
  
  const allKeywords = [
    'javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue', 'node',
    'mongodb', 'sql', 'postgresql', 'aws', 'docker', 'kubernetes', 'git',
    'html', 'css', 'figma', 'redux', 'nextjs', 'django', 'flask', 'spring',
    'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'nlp',
    'excel', 'powerpoint', 'tableau', 'power bi', 'r', 'stata', 'spss',
    'financial modeling', 'valuation', 'consulting', 'strategy', 'case study',
    'marketing', 'seo', 'social media', 'brand management', 'salesforce',
    'product management', 'agile', 'scrum', 'jira',
    'supply chain', 'logistics', 'operations',
    'photoshop', 'illustrator', 'indesign',
  ];
  
  const found = allKeywords.filter(kw => {
    if (kw.length <= 2) return new RegExp(`\\b${kw}\\b`, 'i').test(resumeText);
    return lower.includes(kw);
  });
  
  const skills = [...new Set([...found, ...clientSkills])].filter(Boolean);
  
  // Detect domain
  let domain = 'general';
  if (['consulting', 'strategy', 'mckinsey', 'bain', 'bcg', 'deloitte', 'advisory'].some(k => lower.includes(k))) domain = 'consulting';
  else if (['finance', 'banking', 'investment', 'valuation', 'equity'].some(k => lower.includes(k))) domain = 'finance';
  else if (['react', 'angular', 'node', 'python', 'javascript', 'developer', 'engineer'].some(k => lower.includes(k))) domain = 'software_engineering';
  else if (['machine learning', 'data science', 'tensorflow', 'pytorch'].some(k => lower.includes(k))) domain = 'data_science';
  else if (['marketing', 'seo', 'social media', 'brand'].some(k => lower.includes(k))) domain = 'marketing';
  
  const roles = clientRoles.length > 0 ? clientRoles : [domain.replace('_', ' ') + ' intern'];
  
  return {
    skills,
    target_roles: roles,
    domain,
    experience_level: 'student',
    search_queries: roles.map(r => `${r} internship`).slice(0, 4)
  };
}

/**
 * Score a job against the AI-extracted profile.
 */
function scoreJob(job: any, profile: ResumeProfile): number {
  const jobText = `${job.title || ''} ${job.description || ''} ${job.company || ''}`.toLowerCase();
  const title = (job.title || '').toLowerCase();
  
  let score = 15; // base

  // ── Skill matching (0-40 pts) ──
  if (profile.skills.length > 0) {
    let matched = 0;
    const normalizedSkills = profile.skills.map(s => s.toLowerCase());
    for (const skill of normalizedSkills) {
      if (jobText.includes(skill)) matched++;
    }
    const ratio = matched / Math.min(normalizedSkills.length, 15);
    score += Math.round(ratio * 40);
    if (matched >= 4) score += 5;
    if (matched >= 7) score += 5;
  }

  // ── Role title matching (0-25 pts) ──
  for (const role of profile.target_roles || []) {
    const lowerRole = role.toLowerCase();
    // Check if key words from the target role appear in the title
    const roleWords = lowerRole.split(/\s+/).filter(w => w.length > 3);
    const titleMatches = roleWords.filter(w => title.includes(w)).length;
    const textMatches = roleWords.filter(w => jobText.includes(w)).length;
    
    if (titleMatches >= 2) { score += 25; break; }
    else if (titleMatches >= 1) { score += 15; break; }
    else if (textMatches >= 2) { score += 10; break; }
  }

  // ── Internship / entry-level bonus (0-10 pts) ──
  if (profile.experience_level === 'student' || profile.experience_level === 'fresher') {
    if (title.includes('intern') || title.includes('internship') || title.includes('trainee') || title.includes('apprentice')) {
      score += 10;
    } else if (title.includes('junior') || title.includes('entry') || title.includes('associate') || title.includes('analyst')) {
      score += 5;
    }
  }

  // ── Penalties for senior roles ──
  const seniorKw = ['senior', 'sr.', 'staff', 'lead', 'manager', 'director', 'principal', 'head of', 'vp', 'chief', 'architect'];
  if (seniorKw.some(k => title.includes(k))) score -= 25;

  // High experience penalty
  const expPattern = /(\d+)\+?\s*years?\s*(of\s*)?(experience|exp)/gi;
  const expMatches = [...(job.description || '').toLowerCase().matchAll(expPattern)];
  const maxExp = expMatches.reduce((mx: number, m: RegExpExecArray) => Math.max(mx, parseInt(m[1])), 0);
  if (maxExp >= 5) score -= 20;
  else if (maxExp >= 3) score -= 10;

  return Math.max(0, Math.min(100, score));
}

function getMatchLabel(score: number): string {
  if (score >= 75) return 'Excellent Match';
  if (score >= 55) return 'Good Match';
  if (score >= 35) return 'Moderate Match';
  return 'Low Match';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      query = 'software developer', 
      location: bodyLocation = '', 
      skills: clientSkills = [], 
      preferredRoles: clientRoles = [],
    } = body;
    
    const resumeText: string = body.resumeText || '';
    const userLocation = bodyLocation || 'India';

    console.log('=== INTERNOS SEARCH ===');

    // ────────────────────────────────────────────
    // Step 1: AI-powered resume analysis
    // Uses Gemini (primary) → Groq (fallback)
    // ────────────────────────────────────────────
    let profile: ResumeProfile | null = null;

    if (resumeText && resumeText.length > 50) {
      // Try AI extraction (Gemini/Groq)
      profile = await aiExtractProfile(resumeText);
    }

    // If AI failed, use keyword fallback
    if (!profile) {
      console.log('[Search] AI unavailable, using keyword fallback');
      profile = fallbackExtractProfile(
        resumeText, 
        Array.isArray(clientSkills) ? clientSkills.map(String) : [],
        Array.isArray(clientRoles) ? clientRoles.map(String) : []
      );
    }

    console.log(`[Search] Final profile — Domain: ${profile.domain}`);
    console.log(`[Search] Final skills (${profile.skills.length}): ${profile.skills.slice(0, 10).join(', ')}`);
    console.log(`[Search] Search queries: ${profile.search_queries.join(' | ')}`);

    // ────────────────────────────────────────────
    // Step 2: Fetch jobs using AI-generated queries
    // ────────────────────────────────────────────
    const searchQueries = profile.search_queries.slice(0, 6);
    
    const allJobsMap = new Map<string, JobResult>();
    for (const q of searchQueries) {
      try {
        const batch = await aggregateJobs(q, userLocation);
        for (const job of batch) {
          const key = `${job.title}-${job.company}`.toLowerCase().replace(/\s+/g, '');
          if (!allJobsMap.has(key)) {
            allJobsMap.set(key, job);
          }
        }
      } catch (e) {
        console.error(`aggregateJobs failed for "${q}":`, e);
      }
    }

    const rawJobs = Array.from(allJobsMap.values());
    console.log(`[Search] Total unique jobs fetched: ${rawJobs.length}`);

    // ────────────────────────────────────────────
    // Step 3: Score and rank against profile
    // ────────────────────────────────────────────
    const scoredJobs = rawJobs.map(job => {
      const matchScore = scoreJob(job, profile!);
      return { ...job, matchScore, matchLabel: getMatchLabel(matchScore) };
    });

    const finalJobs = scoredJobs
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 50);

    console.log(`[Search] Returning ${finalJobs.length} jobs (top: ${finalJobs[0]?.matchScore || 0}%)`);

    return NextResponse.json({
      success: true,
      total: finalJobs.length,
      detected_skills: profile.skills,
      detected_domains: [profile.domain],
      target_roles: profile.target_roles,
      jobs: finalJobs,
      count: finalJobs.length
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { success: false, error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
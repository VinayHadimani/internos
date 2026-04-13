import { NextRequest, NextResponse } from 'next/server';
import { aggregateJobs, type JobResult } from '@/lib/aggregator';
import { callAI } from '@/lib/rotating-ai';

// ─── Server-side skill extraction (fast, reliable) ────────────
const SKILL_KEYWORDS = [
  'javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue', 'node',
  'mongodb', 'sql', 'postgresql', 'mysql', 'aws', 'docker', 'kubernetes', 'git',
  'html', 'css', 'tailwind', 'bootstrap', 'figma', 'redux', 'nextjs', 'next.js', 'django',
  'flask', 'spring', 'android', 'ios', 'flutter', 'react native', 'machine learning',
  'data science', 'pandas', 'numpy', 'tensorflow', 'pytorch', 'graphql', 'rest api',
  'c++', 'c#', 'go', 'rust', 'php', 'laravel', 'ruby', 'swift', 'kotlin',
  'express', 'langchain', 'openai', 'llm', 'deep learning', 'computer vision',
  'nlp', 'natural language processing', 'devops', 'ci/cd', 'linux', 'azure',
  'gcp', 'firebase', 'supabase', 'vercel', 'netlify', 'heroku',
  'excel', 'tableau', 'power bi', 'r', 'matlab', 'scikit-learn',
  'selenium', 'playwright', 'cypress', 'jest', 'mocha',
];

function extractSkillsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const found = SKILL_KEYWORDS.filter(skill => {
    // For short skills like 'r', 'go', 'c#', need word boundary check
    if (skill.length <= 2) {
      const regex = new RegExp(`\\b${skill.replace(/[+#]/g, '\\$&')}\\b`, 'i');
      return regex.test(text);
    }
    return lower.includes(skill);
  });
  return [...new Set(found)];
}

// Detect role types from resume text
function detectRoleTypes(text: string): string[] {
  const lower = text.toLowerCase();
  const roles: string[] = [];
  
  const roleMap: Record<string, string[]> = {
    'frontend': ['react', 'angular', 'vue', 'html', 'css', 'frontend', 'front-end', 'ui', 'ux'],
    'backend': ['node', 'express', 'django', 'flask', 'spring', 'backend', 'back-end', 'api', 'server'],
    'fullstack': ['full stack', 'fullstack', 'full-stack', 'mern', 'mean'],
    'ai/ml': ['machine learning', 'deep learning', 'tensorflow', 'pytorch', 'nlp', 'computer vision', 'ai', 'ml', 'langchain', 'llm'],
    'data science': ['data science', 'pandas', 'numpy', 'tableau', 'power bi', 'data analysis', 'statistics'],
    'mobile': ['android', 'ios', 'flutter', 'react native', 'swift', 'kotlin'],
    'devops': ['docker', 'kubernetes', 'ci/cd', 'devops', 'aws', 'azure', 'gcp'],
    'web development': ['web development', 'web developer', 'website'],
  };

  for (const [role, keywords] of Object.entries(roleMap)) {
    if (keywords.some(k => lower.includes(k))) {
      roles.push(role);
    }
  }

  return roles.length > 0 ? roles : ['software developer'];
}

/**
 * Build targeted search queries from extracted skills and roles.
 * These go directly to the aggregator APIs as search terms.
 */
function buildSearchQueries(skills: string[], roles: string[], fallbackQuery: string): string[] {
  const out: string[] = [];

  // Role-based queries (most important for relevance)
  for (const role of roles.slice(0, 2)) {
    out.push(`${role} intern`);
    out.push(`${role} internship`);
  }

  // Top skill queries
  for (const skill of skills.slice(0, 3)) {
    out.push(`${skill} intern`);
  }

  // Broader fallback
  if (out.length === 0) {
    out.push(`${fallbackQuery} internship`);
    out.push(`${fallbackQuery} developer intern`);
  }

  return [...new Set(out.map(q => q.replace(/\s+/g, ' ').trim()))].slice(0, 5);
}

/**
 * Fast keyword-based match scoring.
 * No LLM calls — runs in <1ms per job.
 */
function calculateMatchScore(job: any, userSkills: string[], userRoles: string[]): number {
  const jobText = `${job.title || ''} ${job.description || ''} ${job.company || ''}`.toLowerCase();
  const title = (job.title || '').toLowerCase();

  let score = 20; // base

  // ── Skill matching (0-45 points) ──
  if (userSkills.length > 0) {
    let matched = 0;
    for (const skill of userSkills) {
      if (jobText.includes(skill.toLowerCase())) matched++;
    }
    // Scale: if you match 50%+ of skills, that's a strong match
    const ratio = matched / userSkills.length;
    score += Math.round(ratio * 45);
    
    // Bonus for many absolute matches
    if (matched >= 3) score += 5;
    if (matched >= 5) score += 5;
  }

  // ── Role relevance (0-20 points) ──
  for (const role of userRoles) {
    const lowerRole = role.toLowerCase();
    if (title.includes(lowerRole)) {
      score += 20; // Title match = strong signal
      break;
    } else if (jobText.includes(lowerRole)) {
      score += 10; // Description match = weaker signal
      break;
    }
  }

  // ── Internship/entry-level bonus (0-10 points) ──
  if (title.includes('intern') || title.includes('internship') || 
      title.includes('trainee') || title.includes('apprentice')) {
    score += 10;
  } else if (title.includes('junior') || title.includes('entry') || 
             jobText.includes('fresher') || jobText.includes('no experience required')) {
    score += 5;
  }

  // ── Penalties ──
  const seniorKeywords = ['senior', 'sr.', 'staff', 'lead', 'manager', 'director', 'principal', 'head of', 'vp', 'chief', 'architect'];
  if (seniorKeywords.some(k => title.includes(k))) {
    score -= 30;
  }

  // High experience penalty
  const expPattern = /(\d+)\+?\s*years?\s*(of\s*)?(experience|exp)/gi;
  const expMatches = [...(job.description || '').toLowerCase().matchAll(expPattern)];
  const maxExp = expMatches.reduce((max: number, m: RegExpExecArray) => Math.max(max, parseInt(m[1])), 0);
  if (maxExp >= 5) score -= 25;
  else if (maxExp >= 3) score -= 15;
  else if (maxExp >= 2) score -= 5;

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
    // Step 1: Extract skills from the ACTUAL resume text
    // This is the key fix — we read the resume directly
    // ────────────────────────────────────────────
    let extractedSkills: string[] = [];
    let extractedRoles: string[] = [];

    if (resumeText && resumeText.length > 50) {
      // Fast keyword extraction (instant, no AI needed)
      extractedSkills = extractSkillsFromText(resumeText);
      extractedRoles = detectRoleTypes(resumeText);
      console.log('Extracted Skills from Resume:', extractedSkills);
      console.log('Detected Roles from Resume:', extractedRoles);
    }

    // Merge with anything the client sent (in case they pre-extracted on the frontend)
    const allSkills = [...new Set([
      ...extractedSkills,
      ...(Array.isArray(clientSkills) ? clientSkills.map(String) : [])
    ])].filter(Boolean);

    const allRoles = [...new Set([
      ...extractedRoles,
      ...(Array.isArray(clientRoles) ? clientRoles.map(String) : [])
    ])].filter(Boolean);

    console.log('Final Skills for Search:', allSkills);
    console.log('Final Roles for Search:', allRoles);

    // ────────────────────────────────────────────
    // Step 2: Build targeted search queries
    // ────────────────────────────────────────────
    const searchQueries = buildSearchQueries(allSkills, allRoles, query);
    console.log('Search Queries:', searchQueries);

    // ────────────────────────────────────────────
    // Step 3: Fetch jobs from all aggregator sources
    // ────────────────────────────────────────────
    const allJobsMap = new Map<string, JobResult>();
    for (const q of searchQueries) {
      try {
        const batch = await aggregateJobs(q, userLocation);
        for (const job of batch) {
          const key = `${job.title}-${job.company}`.toLowerCase();
          if (!allJobsMap.has(key)) {
            allJobsMap.set(key, job);
          }
        }
      } catch (e) {
        console.error(`aggregateJobs failed for "${q}":`, e);
      }
    }

    const rawJobs: JobResult[] = Array.from(allJobsMap.values());
    console.log(`Total unique jobs found: ${rawJobs.length}`);

    // ────────────────────────────────────────────
    // Step 4: Score and rank all jobs
    // ────────────────────────────────────────────
    const scoredJobs = rawJobs.map(job => {
      const matchScore = calculateMatchScore(job, allSkills, allRoles);
      return {
        ...job,
        matchScore,
        matchLabel: getMatchLabel(matchScore),
      };
    });

    // Sort by score, return all (let user see everything)
    const finalJobs = scoredJobs
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 50);

    console.log(`Returning ${finalJobs.length} scored jobs (top score: ${finalJobs[0]?.matchScore || 0})`);

    return NextResponse.json({
      success: true,
      total: finalJobs.length,
      detected_skills: allSkills,
      detected_roles: allRoles,
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
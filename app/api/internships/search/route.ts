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
  roles: string[];
  industry: string;
  experience_level: string;
  keywords: string[];
}

/**
 * Use AI (Groq/Gemini) to deeply analyze the resume and extract
 * what kind of jobs this person should be searching for.
 */
async function aiExtractProfile(resumeText: string): Promise<ResumeProfile | null> {
  try {
    const prompt = `You are an expert career analyst. Analyze the resume the user provides and extract a comprehensive profile. This could be from ANY industry.

Return a JSON object with exactly these fields:
{
  "skills": ["skill1", "skill2", "skill3"],
  "roles": ["role1", "role2"],
  "experience_level": "entry",
  "keywords": ["keyword1", "keyword2"],
  "industry": "the primary industry"
}

Rules:
- Extract ALL relevant skills mentioned in the resume — technical skills, soft skills, tools, methodologies, frameworks, platforms, certifications
- Roles should be job titles or functions relevant to the person's experience (e.g., "Business Analyst", "Marketing Intern", "Data Scientist", "Consultant", "Project Manager")
- Keywords should be search-friendly terms that would find relevant job postings (e.g., "business development", "market research", "financial modeling", "UI/UX design", "supply chain")
- Do NOT assume this is a software engineering resume. Read the resume carefully and extract what is ACTUALLY there
- Include at least 5-10 skills and 2-5 roles
- Include at least 3-5 search keywords

Return ONLY valid JSON, no explanation.`;

    const response = await callAI(
      prompt,  // system prompt with instructions
      resumeText.slice(0, 4000),  // Put resume in USER message, not system
      {
        model: 'llama-3.3-70b-versatile',  // Use Groq model (most reliable free tier)
        temperature: 0.1,
        max_tokens: 800,
        providerPriority: ['groq', 'gemini', 'openai']  // Try Groq FIRST — it's your most reliable provider
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
    if (!parsed.keywords || !Array.isArray(parsed.keywords)) return null;
    
    console.log(`[Search] AI Profile — Industry: ${parsed.industry}, Skills: ${(parsed.skills||[]).slice(0, 8).join(', ')}`);
    console.log(`[Search] AI Profile — Roles: ${(parsed.roles||[]).join(', ')}`);
    console.log(`[Search] AI Profile — Keywords: ${(parsed.keywords||[]).join(', ')}`);
    
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
  
  // Industry-agnostic keyword list — covers ALL major fields
  const allKeywords = [
    // Tech & Engineering
    'javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue', 'node',
    'mongodb', 'sql', 'postgresql', 'aws', 'docker', 'kubernetes', 'git',
    'html', 'css', 'figma', 'redux', 'nextjs', 'django', 'flask', 'spring',
    'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'nlp',
    'c++', 'c#', 'go', 'rust', 'php', 'swift', 'kotlin',
    
    // Data & Analytics
    'excel', 'google sheets', 'tableau', 'power bi', 'r studio', 'spss', 'sas', 'vba', 'stata',
    'data analysis', 'data visualization', 'statistical analysis', 'regression analysis',
    'sql', 'mysql', 'bigquery', 'pandas', 'numpy',
    
    // Consulting & Strategy
    'financial modeling', 'valuation', 'consulting', 'strategy', 'case study',
    'due diligence', 'business analysis', 'market research', 'competitive analysis',
    'stakeholder management', 'client engagement', 'presentation skills',
    'management consulting', 'business strategy', 'financial analysis',
    'mcKinsey', 'bain', 'bcg', 'deloitte', 'advisory', 'big four',
    'problem solving', 'analytical skills', 'critical thinking',
    
    // Finance & Accounting
    'investment banking', 'equity research', 'portfolio management',
    'risk management', 'compliance', 'audit', 'accounting', 'tax',
    'financial planning', 'budgeting', 'forecasting', 'treasury',
    'derivatives', 'private equity', 'venture capital', 'hedge fund',
    
    // Marketing & Sales
    'marketing', 'seo', 'sem', 'social media', 'brand management', 'salesforce',
    'content marketing', 'digital marketing', 'email marketing', 'google analytics',
    'market segmentation', 'customer acquisition', 'lead generation',
    'brand strategy', 'public relations', 'event management',
    
    // Product & Design
    'product management', 'product design', 'ux research', 'user research',
    'wireframing', 'prototyping', 'adobe creative suite', 'photoshop', 'illustrator',
    'indesign', 'sketch', 'invision', 'figma',
    
    // Operations & Supply Chain
    'supply chain', 'logistics', 'operations management', 'process improvement',
    'lean six sigma', 'project management', 'agile', 'scrum', 'jira',
    'erp', 'sap', 'salesforce', 'crm',
    
    // HR & People
    'human resources', 'recruiting', 'talent acquisition', 'organizational development',
    'performance management', 'compensation', 'employee relations',
    
    // Legal
    'contract negotiation', 'legal research', 'compliance', 'regulatory affairs',
    'intellectual property', 'corporate law', 'litigation',
    
    // Healthcare & Life Sciences
    'clinical research', 'healthcare management', 'pharmaceutical', 'biotechnology',
    'medical devices', 'regulatory affairs', 'fda',
    
    // General Business
    'business development', 'partnership management', 'revenue growth',
    'customer success', 'account management', 'relationship management',
    'cross-functional', 'leadership', 'team management', 'communication',
  ];
  
  const found = allKeywords.filter(kw => {
    if (kw.length <= 2) return new RegExp(`\\b${kw}\\b`, 'i').test(resumeText);
    return lower.includes(kw);
  });
  
  const skills = [...new Set([...found, ...clientSkills])].filter(Boolean);
  
  // Detect domain — more comprehensive
  let domain = 'general';
  const domainChecks: [string[], string][] = [
    [['embedded', 'arduino', 'raspberry', 'microcontroller', 'fpga', 'pcb', 'firmware', 'ocaml', 'verilog', 'vhdl', 'iot', 'rtos', 'stm32', 'esp32', 'hardware design', 'circuit', 'signal processing', 'robotics', 'control systems'], 'embedded_systems'],
    [['consulting', 'strategy', 'mckinsey', 'bain', 'bcg', 'deloitte', 'advisory', 'big four', 'case study'], 'consulting'],
    [['finance', 'banking', 'investment', 'valuation', 'equity', 'portfolio', 'derivatives', 'private equity', 'venture capital'], 'finance'],
    [['marketing', 'seo', 'social media', 'brand', 'content marketing', 'digital marketing', 'market research'], 'marketing'],
    [['react', 'angular', 'node', 'python', 'javascript', 'developer', 'engineer', 'software'], 'software_engineering'],
    [['machine learning', 'data science', 'tensorflow', 'pytorch', 'data analysis', 'statistical'], 'data_science'],
    [['supply chain', 'logistics', 'operations', 'lean', 'six sigma', 'erp'], 'operations'],
    [['human resources', 'recruiting', 'talent', 'organizational', 'performance management'], 'hr'],
    [['legal', 'compliance', 'contract', 'regulatory', 'intellectual property'], 'legal'],
    [['healthcare', 'clinical', 'pharmaceutical', 'biotech', 'medical'], 'healthcare'],
    [['product management', 'product design', 'ux', 'user research'], 'product'],
    [['accounting', 'audit', 'tax', 'financial planning', 'budgeting'], 'accounting'],
    [['business development', 'partnership', 'revenue', 'customer success', 'account management'], 'business_development'],
  ];
  
  for (const [keywords, domainName] of domainChecks) {
    if (keywords.some(k => lower.includes(k))) {
      domain = domainName;
      break;
    }
  }
  
  // Better role generation from domain
  const domainRoleMap: Record<string, string[]> = {
    'embedded_systems': ['embedded systems engineer', 'firmware developer', 'iot developer', 'hardware engineer'],
    'consulting': ['consultant', 'business analyst', 'strategy analyst', 'management consultant'],
    'finance': ['financial analyst', 'investment analyst', 'risk analyst'],
    'marketing': ['marketing analyst', 'marketing coordinator', 'digital marketing specialist'],
    'software_engineering': ['software developer', 'web developer', 'full stack developer'],
    'data_science': ['data analyst', 'data scientist', 'ml engineer'],
    'operations': ['operations analyst', 'supply chain analyst', 'process analyst'],
    'hr': ['hr coordinator', 'talent acquisition specialist', 'hr analyst'],
    'legal': ['legal assistant', 'compliance analyst', 'paralegal'],
    'healthcare': ['healthcare analyst', 'clinical research coordinator'],
    'product': ['product analyst', 'product manager', 'ux researcher'],
    'accounting': ['accounting assistant', 'audit associate', 'financial analyst'],
    'business_development': ['business development associate', 'account manager', 'partnership manager'],
    'general': ['business analyst', 'project coordinator', 'operations associate'],
  };
  
  const roles = clientRoles.length > 0 ? clientRoles : (domainRoleMap[domain] || ['intern']);
  
  // Generate better search keywords from found skills
  const searchKeywords: string[] = [];
  if (domain !== 'general') {
    searchKeywords.push(`${domain.replace('_', ' ')} intern`);
    searchKeywords.push(`${domain.replace('_', ' ')} analyst`);
  }
  // Add top 3 most relevant found skills as search terms
  for (const skill of found.slice(0, 3)) {
    searchKeywords.push(`${skill} intern`);
  }
  // Add roles as search terms
  for (const role of roles.slice(0, 2)) {
    searchKeywords.push(`${role} internship`);
  }
  
  return {
    skills,
    roles,
    industry: domain,
    experience_level: 'student',
    keywords: [...new Set(searchKeywords)].slice(0, 6)
  };
}

/**
 * Score a job against the AI-extracted profile.
 */
function scoreJob(job: any, profile: ResumeProfile): number {
  let score = 0;
  const jobTitle = (job.title || '').toLowerCase();
  const jobDesc = (job.description || '').toLowerCase();
  const jobText = `${jobTitle} ${jobDesc}`;

  // 50% — Skills match
  const userSkills = profile.skills || [];
  const normalizedSkills = userSkills.map(s => s.toLowerCase());
  const skillsMatched = normalizedSkills.filter(skill => {
    const skillWords = skill.split(/\s+/);
    return skillWords.every(word => jobText.includes(word));
  });
  const skillScore = userSkills.length > 0
    ? (skillsMatched.length / normalizedSkills.length) * 50
    : 0;
  score += skillScore;

  // 30% — Role/title match
  const userRoles = profile.roles || [];
  const normalizedRoles = userRoles.map(r => r.toLowerCase());
  const rolesMatched = normalizedRoles.filter(role => {
    const roleWords = role.split(/\s+/);
    return roleWords.every(word => jobTitle.includes(word) || jobText.includes(word));
  });
  const roleScore = userRoles.length > 0
    ? (rolesMatched.length / normalizedRoles.length) * 30
    : 0;
  score += roleScore;

  // 20% — Experience level + role-type bonus (ONLY if some skills or roles matched)
  const hasSomeMatch = skillsMatched.length > 0 || rolesMatched.length > 0;
  
  if (hasSomeMatch) {
    const expLevel = (profile.experience_level || '').toLowerCase();
    if (expLevel && jobText.includes(expLevel)) {
      score += 10;
    }
    if (jobTitle.includes('intern') || jobTitle.includes('entry') || jobTitle.includes('trainee') || jobTitle.includes('junior')) {
      score += 10;
    } else {
      score += 5;  // Reduced from 10 — mid-level jobs get less
    }
  }
  // If NOTHING matched, score stays at 0 (no free points)

  // Senior penalties
  const seniorKw = ['senior', 'sr.', 'lead', 'manager', 'director', 'vp', 'chief', 'staff', 'principal', 'architect'];
  if (seniorKw.some(k => jobTitle.includes(k))) score -= 25;

  // Industry penalty: if the job is clearly from a different industry
  const techOnlyKw = ['software engineer', 'fullstack developer', 'frontend developer', 'backend developer', 'devops engineer', 'site reliability'];
  if (profile.industry === 'consulting' && techOnlyKw.some(k => jobTitle.includes(k))) score -= 15;
  if (profile.industry === 'finance' && techOnlyKw.some(k => jobTitle.includes(k))) score -= 15;

  return Math.max(0, Math.min(Math.round(score), 100));
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
    // STEP 1: Run AI extraction AND first batch of jobs IN PARALLEL
    // This saves 3-5 seconds by not waiting for AI before fetching
    // ────────────────────────────────────────────
    
    // Start AI extraction in background
    const aiPromise = (async () => {
      if (resumeText && resumeText.length > 50) {
        return await aiExtractProfile(resumeText);
      }
      return null;
    })();

    // Also start fetching jobs with a basic query in parallel
    // Use client skills/roles if available for a better initial query
    const initialQuery = (Array.isArray(clientSkills) && clientSkills.length > 0)
      ? String(clientSkills[0])
      : query;
    const initialJobsPromise = aggregateJobs(initialQuery, userLocation);

    // Wait for BOTH to complete
    const [aiProfile, initialJobs] = await Promise.all([aiPromise, initialJobsPromise]);

    let profile: ResumeProfile | null = aiProfile;

    // If AI failed, use fallback
    if (!profile) {
      console.log('[Search] AI unavailable, using keyword fallback');
      profile = fallbackExtractProfile(
        resumeText, 
        Array.isArray(clientSkills) ? clientSkills.map(String) : [],
        Array.isArray(clientRoles) ? clientRoles.map(String) : []
      );
    }

    console.log(`[Search] Final profile — Industry: ${profile.industry}`);
    console.log(`[Search] Final skills (${profile.skills.length}): ${(profile.skills||[]).slice(0, 10).join(', ')}`);

    // ────────────────────────────────────────────
    // STEP 2: Build targeted queries from AI profile
    // ────────────────────────────────────────────
    const searchQueries: string[] = [];

    if (profile.industry && profile.industry !== 'general') {
      searchQueries.push(profile.industry.replace('_', ' '));
    }
    if (profile.roles && profile.roles.length > 0) {
      searchQueries.push(...profile.roles.slice(0, 1)); // Only top 1 role
    }
    if (profile.keywords && profile.keywords.length > 0) {
      searchQueries.push(...profile.keywords.slice(0, 2)); // Only top 2 keywords
    }

    const uniqueQueries = [...new Set(searchQueries)].slice(0, 3);
    console.log(`[Search] Running ${uniqueQueries.length} additional queries: ${uniqueQueries.join(' | ')}`);

    // ────────────────────────────────────────────
    // STEP 3: Fetch additional jobs for remaining queries (ALL IN PARALLEL)
    // ────────────────────────────────────────────
    const additionalPromises = uniqueQueries
      .filter(q => q.toLowerCase() !== initialQuery.toLowerCase())
      .map(q => aggregateJobs(q, userLocation));
    
    const additionalResults = await Promise.all(additionalPromises);

    // ────────────────────────────────────────────
    // STEP 4: Combine, deduplicate, score, filter
    // ────────────────────────────────────────────
    const allJobsMap = new Map<string, JobResult>();

    // Add initial jobs
    for (const job of initialJobs) {
      const key = `${job.title}-${job.company}`.toLowerCase().replace(/\s+/g, '');
      if (!allJobsMap.has(key)) allJobsMap.set(key, job);
    }

    // Add additional jobs
    for (const batch of additionalResults) {
      for (const job of batch) {
        const key = `${job.title}-${job.company}`.toLowerCase().replace(/\s+/g, '');
        if (!allJobsMap.has(key)) allJobsMap.set(key, job);
      }
    }

    const rawJobs = Array.from(allJobsMap.values());
    console.log(`[Search] Total unique jobs fetched: ${rawJobs.length}`);

    // Score every job
    const scoredJobs = rawJobs.map(job => {
      const matchScore = scoreJob(job, profile!);
      return { ...job, matchScore, matchLabel: getMatchLabel(matchScore) };
    });

    // Location filter with minimum score floor
    const locationFiltered = scoredJobs.filter(job => {
      if (job.matchScore < 5) return false;
      
      const jobLoc = (job.location || '').toLowerCase();
      const userLoc = (userLocation || 'india').toLowerCase();
      
      if (jobLoc.includes('remote') || jobLoc.includes('anywhere') || jobLoc.includes('wfh')) {
        return job.matchScore >= 15;
      }
      if (jobLoc.includes(userLoc)) return true;
      if (userLoc.includes('india') && (
        jobLoc.includes('india') || jobLoc.includes('bangalore') || jobLoc.includes('bengaluru') ||
        jobLoc.includes('mumbai') || jobLoc.includes('delhi') || jobLoc.includes('pune') ||
        jobLoc.includes('chennai') || jobLoc.includes('hyderabad') || jobLoc.includes('noida') ||
        jobLoc.includes('gurgaon') || jobLoc.includes('kolkata')
      )) return true;
      return job.matchScore >= 50;
    });

    const finalJobs = locationFiltered
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 50);

    console.log(`[Search] Returning ${finalJobs.length} jobs (top: ${finalJobs[0]?.matchScore || 0}%)`);

    return NextResponse.json({
      success: true,
      total: finalJobs.length,
      detected_skills: profile.skills,
      detected_domains: [profile.industry],
      target_roles: profile.roles,
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

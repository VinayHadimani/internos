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
    const prompt = `You are an expert career analyst. Analyze this resume with EXTREME care.

CRITICAL INSTRUCTION: This could be from ANY industry — sports, retail, consulting, finance, engineering, healthcare, hospitality, education, creative arts, or anything else. Do NOT default to tech/software.

STEP 1: Find the Career Objective section. This is the MOST IMPORTANT signal for what jobs this person wants. Extract the exact domain/industry keywords from it.

STEP 2: Extract skills using this PRIORITY ORDER:
- TIER 1 (Domain-specific): Words from the Career Objective target (e.g., "sports retail", "customer service", "financial modeling")
- TIER 2 (Technical/hard): Tools, software, certifications mentioned (e.g., "cash handling", "Excel", "SAP", "photography")
- TIER 3 (Soft skills): ONLY include if uniquely demonstrated. NEVER include generic ones like "communication", "teamwork", "leadership" — they inflate scores for every job equally

Resume (first 4000 chars):
\${resumeText.slice(0, 4000)}

Return JSON with exactly these fields:
{
  "skills": ["domain_skill_1", "domain_skill_2", "technical_skill_1", "specific_soft_skill"],
  "roles": ["target_role_1", "target_role_2"],
  "experience_level": "entry",
  "keywords": ["search_query_1", "search_query_2", "search_query_3"],
  "industry": "primary_industry"
}

RULES:
- "skills" (5-12 items): Domain + technical first. The Career Objective domain keywords MUST be first.
- "roles" (2-5 items): Job titles the person is TARGETING (from Career Objective), not just what they've done
- "keywords" (3-8 items): Search-friendly phrases that would find relevant job postings. Include the Career Objective domain phrase. Example: if seeking "sports retail", include "sports retail", "retail associate", "retail sales"
- "industry": Single word — the PRIMARY target industry from the Career Objective
- If the person is a student seeking part-time work, set experience_level to "student"

Return ONLY valid JSON, no explanation.`;

    const response = await callAI(
      prompt,
      ``,
      {
        model: 'gemini-1.5-flash',
        temperature: 0.1,
        max_tokens: 800,
        providerPriority: ['gemini', 'groq', 'openai']
      }
    );

    if (!response.success || !response.content) {
      console.error('[Search] AI profile extraction failed:', response.error);
      return null;
    }

    let raw = response.content;
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    
    const parsed = JSON.parse(raw) as ResumeProfile;
    
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
  
  // Detect domain — pick the one with the MOST keyword matches
  let domain = 'general';
  let maxMatches = 0;
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
    const matchCount = keywords.filter(k => lower.includes(k)).length;
    if (matchCount >= 2 && matchCount > maxMatches) {
      maxMatches = matchCount;
      domain = domainName;
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
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'in', 'of', 'for', 'with', 'to', 'at', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'because', 'as', 'until', 'while', 'about', 'between', 'through', 'during', 'before', 'after', 'above', 'below', 'from', 'up', 'down', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'any', 'nor'
]);

const SOFT_NOISE_WORDS = new Set([
  'experience', 'work', 'working', 'team', 'teams', 'role', 'roles', 'position', 'opportunity', 'join', 'looking', 'seeking', 'hire', 'hiring', 'company', 'organization', 'environment', 'culture', 'values', 'benefits', 'including', 'ability', 'strong', 'excellent', 'good', 'great', 'preferred', 'required', 'requirements', 'qualifications', 'responsibilities', 'duties', 'tasks', 'must', 'year', 'years', 'month', 'months', 'time', 'full', 'part', 'based', 'related', 'relevant', 'etc', 'e.g', 'i.e', 'via', 'per', 'plus', 'well', 'also', 'new', 'make', 'ensure', 'help', 'support', 'develop', 'development', 'using', 'across', 'within', 'along', 'multiple', 'knowledge', 'understanding', 'skills', 'skill'
]);

function scoreJob(job: any, profile: ResumeProfile, userLocation: string): number {
  let score = 0;
  const jobTitle = (job.title || '').toLowerCase();
  const jobDesc = (job.description || '').toLowerCase();
  
  // Clean job descriptions from BOTH stop words and soft noise words
  const titleWords = jobTitle.split(/[\s,;.!]+/).filter((w: string) => !STOP_WORDS.has(w) && !SOFT_NOISE_WORDS.has(w));
  const descWords = jobDesc.split(/[\s,;.!]+/).filter((w: string) => !STOP_WORDS.has(w) && !SOFT_NOISE_WORDS.has(w));
  
  const cleanedJobTitle = titleWords.join(' ');
  const cleanedJobDesc = descWords.join(' ');

  // ── Bonus: Location match (+8 City, +5 State, +4 Remote) ──
  const jobLocation = (job.location || '').toLowerCase();
  if (userLocation && jobLocation) {
    const userParts = userLocation.split(',').map(s => s.trim().toLowerCase());
    const userCity = userParts[0];
    const userSubRegion = userParts[1];
    const isRemote = jobLocation.includes('remote');
    
    if (userCity && jobLocation.includes(userCity)) {
       score += 8;
    } else if (userSubRegion && jobLocation.includes(userSubRegion)) {
       score += 5;
    } else if (isRemote) {
       score += 4;
    }
  }

  // ── Skills match (phrase-level, filtered) ──
  const userSkills = profile.skills || [];
  
  // Only remove STOP_WORDS from user skills (keep "python", "react", etc.)
  const validSkills = userSkills.map(s => {
    return s.toLowerCase().split(/\s+/).filter(w => !STOP_WORDS.has(w)).join(' ');
  }).filter(s => s.length > 1);

  if (validSkills.length > 0) {
    let weightedMatch = 0;
    
    for (const skill of validSkills) {
      if (!skill) continue;
      
      let phraseScore = 0;
      
      // Found in job title
      if (cleanedJobTitle.includes(skill)) {
        phraseScore = 3; // 3.0x match vs desc
      } else {
        // Industry / title keyword bonus implementation
        // Partial phrase matching across Requirements section vs General Desc
        const requirementsIdx = cleanedJobDesc.indexOf('require');
        if (requirementsIdx !== -1 && cleanedJobDesc.substring(requirementsIdx).includes(skill)) {
           phraseScore = 1.5; // Found inside requirements block
        } else if (cleanedJobDesc.includes(skill)) {
           phraseScore = 1.0; // Basic desc match
        }
      }
      
      // Industry Keyword boost
      if (phraseScore > 0 && profile.industry && (skill.includes(profile.industry.toLowerCase()) || skill.includes('intern'))) {
        phraseScore += 1;
      }
      
      weightedMatch += phraseScore;
    }
    
    // Score = (sum of weighted matches) / (total user skills) × 100, capped at 99%
    score += Math.min(80, (weightedMatch / validSkills.length) * 100); 
  }

  // ── Role/title match (phrase-level) ──
  const userRoles = profile.roles || [];
  let rolesMatched = 0;
  for (const role of userRoles) {
    const r = role.toLowerCase().split(/\s+/).filter(w => !STOP_WORDS.has(w)).join(' ');
    if (!r) continue;
    
    if (cleanedJobTitle.includes(r)) {
      rolesMatched++;
    } else if (cleanedJobDesc.includes(r)) {
      rolesMatched += 0.5;
    }
  }
  if (userRoles.length > 0) {
    score += (rolesMatched / userRoles.length) * 20;
  }

  // ── Bonus: Student/Entry/Intern title match ──
  if (jobTitle.includes('intern') || jobTitle.includes('internship') || (job.title_tags && job.title_tags.includes('internship'))) {
    score += 10;
  } else if (jobTitle.includes('student') || jobTitle.includes('entry level') || jobTitle.includes('entry') || jobTitle.includes('junior') || jobTitle.includes('trainee') || jobTitle.includes('graduate')) {
    score += 5;
  }
  
  // ── Penalty: Senior titles ──
  const seniorKw = ['senior', 'sr.', 'sr ', 'lead', 'manager', 'director', 'vp', 'chief', 'principal', 'head', 'staff'];
  if (seniorKw.some(k => jobTitle.includes(k))) score -= 5;

  return Math.max(0, Math.min(Math.round(score), 99));
}

function getMatchLabel(score: number): string {
  if (score >= 75) return 'Excellent Match';
  if (score >= 60) return 'Good Match';
  if (score >= 40) return 'Moderate Match';
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
    console.log(`[Search] Final roles (${profile.roles.length}): ${(profile.roles||[]).join(', ')}`);

    // ────────────────────────────────────────────
    // Step 2: Fetch jobs using AI-generated queries
    // DETERMINISTIC: always run ALL queries, always return same results
    // ────────────────────────────────────────────
    const rawQueries = [
      ...(profile.keywords || []),  // Keywords first (most targeted, e.g. AI internship, Machine Learning)
      ...(profile.roles || []),
      ...(profile.skills || [])
    ];
    
    // Prioritize keywords over raw skills, remove duplicates, limit to 8
    const searchQueries = [...new Set(rawQueries)].filter(q => q && q.trim().length > 0).slice(0, 8);
    
    const allJobsMap = new Map<string, JobResult>();

    // Add initial jobs fetched concurrently in Step 1
    for (const job of initialJobs) {
      const key = `${job.title}-${job.company}`.toLowerCase().replace(/\s+/g, '');
      if (!allJobsMap.has(key)) allJobsMap.set(key, job);
    }

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
    // Step 3: Score, rank, and return ALL results
    // ────────────────────────────────────────────
    const scoredJobs = rawJobs.map(job => {
      const matchScore = scoreJob(job, profile!, userLocation);
      return { ...job, matchScore, matchLabel: getMatchLabel(matchScore) };
    });

    // DETERMINISTIC sort: by score desc, then title alpha for stable ordering
    const finalJobs = scoredJobs.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return (a.title || '').localeCompare(b.title || '');
    });

    console.log(`[Search] Returning ALL ${finalJobs.length} jobs (top: ${finalJobs[0]?.matchScore || 0}%, bottom: ${finalJobs[finalJobs.length - 1]?.matchScore || 0}%)`);

    return NextResponse.json({
      success: true,
      total: finalJobs.length,           // Total count for pagination
      page: 1,                           // Current page
      pageSize: 25,                      // Items per page
      totalPages: Math.ceil(finalJobs.length / 25),
      detected_skills: profile.skills,
      detected_domains: [profile.industry],
      target_roles: profile.roles,
      jobs: finalJobs,                   // ALL jobs — client handles pagination
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

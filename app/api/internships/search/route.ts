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
  education_level?: string;
  currently_enrolled?: boolean;
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

- "industry": Single word — the PRIMARY target industry from the Career Objective
- Detect experience_level: "high_school", "college_student", "recent_graduate", or "early_career"
- Detect education_level: "high_school", "bachelors", "masters"
- Currently enrolled: true/false
- If the person is a high school student or seeking part-time/casual work, explicitly mark it.

Return exactly this JSON:
{
  "skills": [...],
  "roles": [...],
  "experience_level": "...",
  "education_level": "...",
  "currently_enrolled": true/false,
  "keywords": [...],
  "industry": "..."
}

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
    [['retail', 'customer service', 'sales assistant', 'cash handling', 'store', 'shop', 'point of sale', 'pos', 'merchandising'], 'retail'],
    [['hospitality', 'food service', 'restaurant', 'barista', 'waiter', 'waitress', 'catering', 'hotel', 'front desk', 'reception'], 'hospitality'],
    [['sports', 'coaching', 'fitness', 'athletic', 'recreation', 'umpire', 'referee', 'personal training'], 'sports'],
    [['education', 'teaching', 'tutoring', 'childcare', 'early childhood', 'teacher aide', 'substitute teacher'], 'education'],
    [['healthcare', 'aged care', 'disability support', 'caregiver', 'nursing assistant', 'medical assistant'], 'healthcare_support'],
    [['trades', 'carpentry', 'plumbing', 'electrical', 'mechanic', 'welding', 'construction', 'apprentice'], 'trades'],
    [['creative', 'photography', 'videography', 'graphic design', 'writing', 'journalism', 'content creation', 'social media'], 'creative'],
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
    'accounting': ['accounting assistant', 'audit associate', 'financial analyst'],
    'business_development': ['business development associate', 'account manager', 'partnership manager'],
    'retail': ['retail assistant', 'customer service representative', 'sales associate', 'store team member'],
    'hospitality': ['customer service representative', 'food service worker', 'hospitality assistant'],
    'sports': ['sports coach', 'recreation assistant', 'community sports officer'],
    'education': ['teacher aide', 'tutor', 'learning support assistant'],
    'healthcare_support': ['care assistant', 'medical receptionist', 'healthcare support worker'],
    'trades': ['apprentice', 'trade assistant', 'helper'],
    'creative': ['content creator', 'creative assistant', 'photographer assistant'],
    'general': ['customer service representative', 'business analyst', 'project coordinator', 'operations associate'],
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
  const jobText = `${jobTitle} ${jobDesc}`;
  
  // ── 1. Skills Match (Weighted, Max 50 points) ──
  const userSkills = profile.skills || [];
  const normalizedSkills = userSkills.map(s => s.toLowerCase().trim()).filter(s => s.length > 2);
  
  if (normalizedSkills.length > 0) {
    let skillPoints = 0;
    const matches: string[] = [];
    
    for (const skill of normalizedSkills) {
      // Regex for whole word match to avoid partials like "java" matching "javascript"
      const skillRegex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      
      const titleMatches = (jobTitle.match(skillRegex) || []).length;
      const descMatches = (jobDesc.match(skillRegex) || []).length;
      
      if (titleMatches > 0) {
        skillPoints += 12; // Heavy weight for title match
        matches.push(skill);
      } else if (descMatches > 0) {
        skillPoints += 7; // Good weight for description match
        matches.push(skill);
      }
    }
    
    // Cap skills score at 50
    score += Math.min(50, skillPoints);
  }

  // ── 2. Role/Title Match (Max 30 points) ──
  const targetRoles = profile.roles || [];
  const GENERIC_ROLE_SUFFIXES = ['representative', 'specialist', 'associate', 'coordinator', 'manager', 'professional', 'officer', 'executive', 'assistant', 'intern', 'trainee'];
  
  let rolePoints = 0;
  for (const role of targetRoles) {
    const cleanRole = role.toLowerCase();
    const roleWords = cleanRole.split(/\s+/).filter(w => !STOP_WORDS.has(w) && !GENERIC_ROLE_SUFFIXES.includes(w));
    
    if (roleWords.length >= 2) {
      // For multi-word roles, require at least the first 2 significant words
      const primaryPhrase = roleWords.slice(0, 2).join(' ');
      if (jobTitle.includes(primaryPhrase)) {
        rolePoints += 30; // Direct match on primary phrase
        break;
      } else if (jobDesc.includes(primaryPhrase)) {
        rolePoints += 15;
      }
    } else if (roleWords.length === 1) {
      if (new RegExp(`\\b${roleWords[0]}\\b`, 'i').test(jobTitle)) {
        rolePoints += 20;
        break;
      }
    }
  }
  score += Math.min(30, rolePoints);

  // ── 3. Student/Seniority Fit (Max 10 points) ──
  const isStudent = profile.experience_level === 'high_school' || profile.experience_level === 'college_student' || profile.experience_level === 'student';
  const isHighSchool = profile.experience_level === 'high_school';
  
  // Seniority Penalty
  const seniorKw = ['senior', 'sr.', 'sr ', 'lead', 'manager', 'director', 'vp', 'executive', 'chief', 'principal', 'staff', 'head of'];
  if (seniorKw.some(k => jobTitle.includes(k))) {
    score -= 40; // Heavy penalty for senior roles if seeking entry level
  }
  
  // Student/Entry Bonus
  if (isStudent) {
    if (jobTitle.includes('intern') || jobTitle.includes('student') || jobTitle.includes('trainee')) score += 10;
    if (isHighSchool && (jobText.includes('high school') || jobText.includes('teen') || jobText.includes('school leaver') || jobText.includes('casual'))) {
      score += 10;
    }
  }

  // ── 4. Location Fit (Max 10 points) ──
  if (userLocation && userLocation !== 'Any' && userLocation !== 'Remote') {
    const jobLocation = (job.location || '').toLowerCase();
    const userCity = userLocation.split(',')[0].toLowerCase().trim();
    
    if (jobLocation.includes(userCity)) {
      score += 10;
    } else if (jobLocation.includes('remote')) {
      score += 5;
    }
  } else {
    // If no location preference or remote preference, remain neutral
    score += 5;
  }

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
      experience: clientExperience = 'fresher'
    } = body;
    
    const resumeText: string = body.resumeText || '';
    const userLocation = bodyLocation || '';

    console.log('=== INTERNOS SEARCH ===');
    console.log(`[Search] Location: ${userLocation || 'Any'}`);

    let profile: ResumeProfile | null = null;

    // Fast Path: Only skip AI if we have SUFFICIENT skills and roles
    if (clientSkills.length >= 3 && clientRoles.length >= 1) {
      console.log('[Search] Using client-provided profile');
      profile = {
        skills: clientSkills,
        roles: clientRoles,
        industry: 'general',
        experience_level: clientExperience,
        keywords: [
          ...clientRoles.slice(0, 2).map((r: string) => `${r} internship`),
          ...clientSkills.slice(0, 3).map((s: string) => `${s} intern`)
        ]
      };
    } else {
      // Start AI extraction in background
      profile = await aiExtractProfile(resumeText);
      if (!profile) {
        console.log('[Search] AI unavailable, using keyword fallback');
        profile = fallbackExtractProfile(
          resumeText, 
          Array.isArray(clientSkills) ? clientSkills.map(String) : [],
          Array.isArray(clientRoles) ? clientRoles.map(String) : []
        );
      }
    }

    // Smart Query Building
    const isStudent = profile.experience_level === 'high_school' || profile.experience_level === 'student';
    
    const searchQueries = [...new Set([
      ...(profile.keywords || []),
      ...(profile.roles || []),
      // If student, definitely search for their top skills + "casual" or "part-time"
      ...(isStudent ? profile.skills.slice(0, 2).map(s => `${s} casual`) : [])
    ])].filter(q => q && q.trim().length > 0).slice(0, 6);
    
    if (isStudent) {
       searchQueries.push(...profile.skills.slice(0, 1).map(s => `${s} part-time`));
    }
    
    const allJobsMap = new Map<string, JobResult>();

    // Sequential batching with timeout check
    for (const q of searchQueries) {
      try {
        const batch = await aggregateJobs(q, userLocation);
        for (const job of batch) {
          const key = `${job.title}-${job.company}`.toLowerCase().replace(/\s+/g, '');
          if (!allJobsMap.has(key)) allJobsMap.set(key, job);
        }
        if (allJobsMap.size >= 100) break; // Hard limit for speed
      } catch (e) {
        console.error(`aggregateJobs failed for "${q}"`);
      }
    }

    const rawJobs = Array.from(allJobsMap.values());
    const scoredJobs = rawJobs.map(job => {
      const matchScore = scoreJob(job, profile!, userLocation);
      return { ...job, matchScore, matchLabel: getMatchLabel(matchScore) };
    });

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

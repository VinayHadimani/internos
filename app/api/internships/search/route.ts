import { NextRequest, NextResponse } from 'next/server';
import { aggregateJobs, type JobResult } from '@/lib/aggregator';
import { callAI } from '@/lib/rotating-ai';
import { matchJobListings, type JobListing } from '@/lib/matching/match-engine';
import { type StudentProfile } from '@/lib/resume-parser';

interface ResumeProfile {
  skills: string[];
  roles: string[];
  industry: string;
  experience_level: string;
  education_level?: string;
  currently_enrolled?: boolean;
  keywords: string[];
  location?: string;
  detected_country?: string;
}

/**
 * Use AI (Groq/Gemini) to deeply analyze the resume and extract
 * what kind of jobs this person should be searching for.
 */
async function aiExtractProfile(resumeText: string): Promise<ResumeProfile | null> {
  try {
    const prompt = `You are an expert career analyst. Analyze this resume with EXTREME care.

CRITICAL INSTRUCTION: This could be from ANY industry — sports, retail, consulting, finance, engineering, healthcare, hospitality, education, creative arts, or anything else. Do NOT default to tech/software.

STEP 1: detect the candidate's country/location with 100% accuracy.
- Signals for AUSTRALIA: Phone starts with +61 or 04xx/045xx. Postcodes like 3xxx, 2xxx. Terms: "Secondary College", "Year 11/12", "VET", "ATAR", "Casual", "Part-time".
- Signals for INDIA: Phone starts with +91. 6-digit postcodes.
- Signals for USA: Phone starts with +1. 5-digit zip codes.
- If unsure, set detected_country to "remote".

STEP 2: Extract skills that are ACTUALLY present. DOMAIN-SPECIFIC skills are 10x more important than generic soft skills.

STEP 3: Detect experience_level: "high_school", "student", "recent_graduate", or "junior".

Return exactly this JSON:
{
  "skills": [...],
  "roles": [...],
  "experience_level": "...",
  "education_level": "...",
  "currently_enrolled": true/false,
  "keywords": [...],
  "industry": "...",
  "detected_country": "..."
}`;

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
    if (matchCount >= 1 && matchCount > maxMatches) {
      maxMatches = matchCount;
      domain = domainName;
    }
  }

  // Explicit mapping for non-tech industries to roles
  const domainRoleMap: Record<string, string[]> = {
    'retail': ['retail assistant', 'sales associate', 'cashier', 'merchandiser'],
    'hospitality': ['waiter', 'waitress', 'barista', 'front desk associate'],
    'sports': ['sports coach', 'recreation assistant', 'fitness instructor'],
    'healthcare_support': ['care assistant', 'medical receptionist', 'healthcare aide'],
    'trades': ['trades assistant', 'apprentice', 'labourer'],
    'creative': ['graphic design assistant', 'social media intern', 'content creator'],
    'admin_office': ['office assistant', 'receptionist', 'admin intern'],
    'general': ['customer service representative', 'business intern', 'administrative assistant']
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
 * Maps our internal prompt profile to the StudentProfile format 
 * required by the match-engine.
 */
function mapToStudentProfile(p: ResumeProfile, userLoc: string): StudentProfile {
  return {
    name: "Candidate",
    education: {
      degree: p.education_level || "Student",
      year: p.currently_enrolled ? "Currently Enrolled" : "Completed",
      graduation_year: new Date().getFullYear() + 2,
      institution: "Detected School"
    },
    experience_level: "student_fresher",
    verified_skills: {
      languages: [],
      frameworks: [],
      tools: p.skills || [],
      ai_ml: [],
      domains: [p.industry || "general"]
    },
    projects: [],
    certifications: [],
    availability: {
      type: "part-time",
      remote_only: false,
      location: p.detected_country || userLoc || "remote"
    },
    total_effective_experience_months: 0
  };
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
      experience: clientExperience = 'fresher',
      cacheBuster = ''
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
      
      // CRITICAL FIX: Merge dashboard skills with AI roles/experience
      // Do not let AI ignore the perfectly detected dashboard skills
      if (profile && clientSkills.length > 0) {
        profile.skills = [...new Set([...clientSkills, ...profile.skills])];
      }
      
      if (!profile) {
        console.log('[Search] AI unavailable, using keyword fallback');
        profile = fallbackExtractProfile(
          resumeText, 
          Array.isArray(clientSkills) ? clientSkills.map(String) : [],
          Array.isArray(clientRoles) ? clientRoles.map(String) : []
        );
      }
    }

    // Smart Query Building (Fix #4)
    const DOMAIN_QUERIES: Record<string, string[]> = {
      retail: ['retail assistant', 'customer service assistant', 'shop assistant', 'sales assistant', 'store associate', 'retail casual', 'part time retail'],
      sports: ['sports retail assistant', 'sports store casual', 'recreation assistant', 'community sports officer'],
      hospitality: ['waiter', 'barista', 'cafe assistant', 'restaurant staff', 'hospitality casual'],
    };

    const industryLower = (profile.industry || '').toLowerCase();
    let searchQueries: string[] = [];
    
    // Check if industry matches any domain queries
    const matchedDomain = Object.keys(DOMAIN_QUERIES).find(d => industryLower.includes(d));

    if (matchedDomain) {
      console.log(`[Search] Using hardcoded queries for domain: ${matchedDomain}`);
      // Merge top 3 skills with 3 domain queries
      searchQueries = [
        ...DOMAIN_QUERIES[matchedDomain].slice(0, 3),
        ...profile.skills.slice(0, 3).map(s => `${s} role`)
      ];
    } else {
      searchQueries = [...new Set([
        ...(profile.keywords || []),
        ...(profile.roles || []),
        ...(profile.skills.slice(0, 2).map(s => `${s} intern`))
      ])].filter(q => q && q.trim().length > 0).slice(0, 6);
    }
    
    const allJobsMap = new Map<string, JobResult>();

    // Sequential batching with timeout check
    // Fix #2: Use detected country if available
    const searchLocation = profile.detected_country || userLocation || 'remote';
    
    for (const q of searchQueries) {
      try {
        const batch = await aggregateJobs(q, searchLocation);
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
    
    // Fix #5: Integrate the robust matching engine
    const studentProfileObj = mapToStudentProfile(profile!, userLocation);
    const jobListings: JobListing[] = rawJobs.map(j => ({
      title: j.title,
      company: j.company,
      location: j.location,
      description: j.description || "",
      requirements: [] // match-engine will parse requirements from description if needed
    }));

    const matchedResults = matchJobListings(studentProfileObj, jobListings);
    
    // Map back to our job structure
    const scoredJobs = matchedResults.map(res => {
      const original = rawJobs.find(rj => rj.title === res.title && rj.company === res.company)!;
      return { 
        ...original, 
        matchScore: res.match_score, 
        matchLabel: getMatchLabel(res.match_score) 
      };
    });

    const finalJobs = scoredJobs; // matchJobListings already sorts them

    console.log(`[Search] Returning ALL ${finalJobs.length} jobs (top: ${finalJobs[0]?.matchScore || 0}%, bottom: ${finalJobs[finalJobs.length - 1]?.matchScore || 0}%)`);

    return NextResponse.json({
      success: true,
      total: finalJobs.length,
      page: 1,
      pageSize: 25,
      totalPages: Math.ceil(finalJobs.length / 25),
      detected_skills: profile.skills,
      detected_domains: [profile.industry],
      target_roles: profile.roles,
      jobs: finalJobs,
      count: finalJobs.length,
      cacheBuster
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { success: false, error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { aggregateJobs, type JobResult } from '@/lib/aggregator';

// ══════════════════════════════════════════════════════
// COMPREHENSIVE SKILL & DOMAIN DETECTION
// Covers Tech, Consulting, Finance, Marketing, Science,
// Healthcare, Design, Legal, HR, Operations, etc.
// ══════════════════════════════════════════════════════

const SKILL_DICTIONARY: Record<string, string[]> = {
  // ── Tech / Engineering ──
  'javascript': ['javascript', 'js', 'es6', 'es2015'],
  'typescript': ['typescript', 'ts'],
  'python': ['python'],
  'java': ['java', 'jvm'],
  'c++': ['c++', 'cpp'],
  'c#': ['c#', 'csharp', '.net'],
  'go': ['golang'],
  'rust': ['rust'],
  'ruby': ['ruby', 'rails'],
  'php': ['php', 'laravel'],
  'swift': ['swift'],
  'kotlin': ['kotlin'],
  'react': ['react', 'reactjs', 'react.js'],
  'angular': ['angular', 'angularjs'],
  'vue': ['vue', 'vuejs', 'vue.js'],
  'next.js': ['next.js', 'nextjs'],
  'node.js': ['node.js', 'nodejs', 'node'],
  'express': ['express', 'expressjs'],
  'django': ['django'],
  'flask': ['flask'],
  'spring boot': ['spring boot', 'spring'],
  'html/css': ['html', 'css'],
  'tailwind': ['tailwind', 'tailwindcss'],
  'mongodb': ['mongodb', 'mongo'],
  'postgresql': ['postgresql', 'postgres'],
  'mysql': ['mysql'],
  'redis': ['redis'],
  'sql': ['sql'],
  'graphql': ['graphql'],
  'rest api': ['rest api', 'restful', 'api development'],
  'aws': ['aws', 'amazon web services', 'ec2', 's3', 'lambda'],
  'azure': ['azure', 'microsoft azure'],
  'gcp': ['gcp', 'google cloud'],
  'docker': ['docker', 'containerization'],
  'kubernetes': ['kubernetes', 'k8s'],
  'git': ['git', 'github', 'gitlab', 'bitbucket'],
  'ci/cd': ['ci/cd', 'cicd', 'jenkins', 'github actions'],
  'linux': ['linux', 'ubuntu', 'centos'],
  'terraform': ['terraform', 'infrastructure as code'],
  'firebase': ['firebase'],
  'supabase': ['supabase'],
  'machine learning': ['machine learning', 'ml'],
  'deep learning': ['deep learning', 'neural network'],
  'tensorflow': ['tensorflow', 'tf'],
  'pytorch': ['pytorch'],
  'nlp': ['nlp', 'natural language processing'],
  'computer vision': ['computer vision', 'cv', 'opencv'],
  'langchain': ['langchain'],
  'llm': ['llm', 'large language model', 'gpt', 'openai'],
  'data science': ['data science', 'data scientist'],
  'pandas': ['pandas'],
  'numpy': ['numpy'],
  'scikit-learn': ['scikit-learn', 'sklearn'],
  'selenium': ['selenium'],
  'playwright': ['playwright'],
  'figma': ['figma'],

  // ── Finance / Consulting / Business ──
  'financial modeling': ['financial modeling', 'financial model', 'dcf', 'discounted cash flow'],
  'valuation': ['valuation', 'company valuation', 'equity valuation'],
  'investment banking': ['investment banking', 'ib', 'i-banking'],
  'private equity': ['private equity', 'pe', 'buyout'],
  'venture capital': ['venture capital', 'vc'],
  'mergers and acquisitions': ['m&a', 'mergers', 'acquisitions', 'mergers and acquisitions'],
  'equity research': ['equity research'],
  'asset management': ['asset management', 'portfolio management', 'wealth management'],
  'hedge fund': ['hedge fund'],
  'financial analysis': ['financial analysis', 'financial analyst'],
  'accounting': ['accounting', 'gaap', 'ifrs', 'cpa'],
  'auditing': ['auditing', 'audit', 'internal audit', 'external audit'],
  'bloomberg': ['bloomberg', 'bloomberg terminal'],
  'capital iq': ['capital iq', 'capitaliq', 'cap iq'],
  'pitchbook': ['pitchbook'],
  'factset': ['factset'],
  'management consulting': ['management consulting', 'strategy consulting', 'consulting'],
  'strategy': ['strategy', 'strategic planning', 'corporate strategy'],
  'market research': ['market research', 'market analysis', 'competitive analysis'],
  'business development': ['business development', 'biz dev', 'bd'],
  'case study': ['case study', 'case interview', 'case studies'],
  'due diligence': ['due diligence'],
  'pitch deck': ['pitch deck', 'investor deck'],
  'excel': ['excel', 'microsoft excel', 'advanced excel', 'vlookup', 'pivot table'],
  'powerpoint': ['powerpoint', 'ppt', 'presentations', 'slide deck'],
  'tableau': ['tableau'],
  'power bi': ['power bi', 'powerbi'],
  'sas': ['sas'],
  'stata': ['stata'],
  'spss': ['spss'],
  'r': ['r programming', 'r studio', 'rstudio'],
  'matlab': ['matlab'],
  'vba': ['vba', 'macro'],

  // ── Marketing / Communications ──
  'digital marketing': ['digital marketing', 'online marketing'],
  'social media': ['social media', 'social media marketing', 'smm'],
  'seo': ['seo', 'search engine optimization'],
  'sem': ['sem', 'google ads', 'ppc', 'pay per click'],
  'content marketing': ['content marketing', 'content strategy', 'copywriting'],
  'email marketing': ['email marketing', 'mailchimp', 'hubspot'],
  'brand management': ['brand management', 'branding'],
  'market analysis': ['market analysis', 'market sizing', 'tam sam som'],
  'crm': ['crm', 'salesforce', 'hubspot crm'],
  'google analytics': ['google analytics', 'ga4'],
  'adobe creative': ['photoshop', 'illustrator', 'indesign', 'premiere', 'after effects'],

  // ── Product / Project Management ──
  'product management': ['product management', 'product manager', 'pm'],
  'project management': ['project management', 'pmp', 'prince2'],
  'agile': ['agile', 'scrum', 'kanban', 'sprint'],
  'jira': ['jira'],
  'stakeholder management': ['stakeholder management', 'stakeholder engagement'],

  // ── Operations / Supply Chain ──
  'operations': ['operations', 'ops', 'operations management'],
  'supply chain': ['supply chain', 'logistics', 'procurement'],
  'lean': ['lean', 'six sigma', 'lean six sigma', 'kaizen'],
  'erp': ['erp', 'sap', 'oracle erp'],

  // ── Healthcare / Science ──
  'clinical research': ['clinical research', 'clinical trials', 'clinical data'],
  'biotech': ['biotech', 'biotechnology', 'bioinformatics'],
  'pharmaceuticals': ['pharma', 'pharmaceutical'],
  'lab research': ['lab research', 'laboratory', 'wet lab', 'dry lab'],
  'public health': ['public health', 'epidemiology'],

  // ── Legal ──
  'legal research': ['legal research', 'legal analysis'],
  'compliance': ['compliance', 'regulatory compliance', 'regulatory affairs'],
  'contract law': ['contract law', 'contracts'],

  // ── Soft / General ──
  'leadership': ['leadership', 'team lead', 'team leader', 'led a team'],
  'communication': ['communication', 'public speaking', 'presentation skills'],
  'problem solving': ['problem solving', 'analytical thinking', 'critical thinking'],
  'teamwork': ['teamwork', 'collaboration', 'cross-functional'],
};

const DOMAIN_SIGNALS: Record<string, { keywords: string[]; searchTerms: string[] }> = {
  'consulting': {
    keywords: ['consulting', 'consultant', 'mckinsey', 'bain', 'bcg', 'deloitte', 'accenture', 'kpmg', 'ey', 'pwc',
               'strategy', 'case study', 'due diligence', 'management consulting', 'advisory', 'client engagement'],
    searchTerms: ['consulting intern', 'management consulting internship', 'strategy analyst intern', 'business analyst intern', 'advisory intern']
  },
  'finance': {
    keywords: ['finance', 'financial', 'banking', 'investment', 'equity', 'trading', 'portfolio', 'asset management',
               'valuation', 'dcf', 'm&a', 'ipo', 'pe', 'vc', 'hedge fund', 'capital markets', 'credit', 'wealth management',
               'goldman sachs', 'jp morgan', 'morgan stanley', 'citi', 'bank of america', 'barclays'],
    searchTerms: ['finance intern', 'investment banking summer analyst', 'financial analyst intern', 'private equity intern', 'asset management intern']
  },
  'accounting': {
    keywords: ['accounting', 'audit', 'tax', 'gaap', 'ifrs', 'cpa', 'bookkeeping', 'financial reporting',
               'deloitte', 'ey', 'kpmg', 'pwc', 'grant thornton', 'big four', 'big 4'],
    searchTerms: ['accounting intern', 'audit intern', 'tax intern']
  },
  'software engineering': {
    keywords: ['software', 'developer', 'engineer', 'programming', 'code', 'full stack', 'frontend', 'backend',
               'web development', 'mobile development', 'app development', 'devops', 'swe'],
    searchTerms: ['software engineering intern', 'developer intern', 'SWE intern', 'full stack intern']
  },
  'ai/ml': {
    keywords: ['machine learning', 'deep learning', 'artificial intelligence', 'ai', 'ml', 'neural', 'nlp',
               'computer vision', 'tensorflow', 'pytorch', 'langchain', 'llm', 'data science'],
    searchTerms: ['machine learning intern', 'AI engineer intern', 'data science intern']
  },
  'frontend': {
    keywords: ['react', 'angular', 'vue', 'frontend', 'front-end', 'ui', 'ux', 'web design', 'css', 'html'],
    searchTerms: ['frontend intern', 'react developer intern', 'UI/UX intern']
  },
  'data analytics': {
    keywords: ['data analytics', 'data analysis', 'business intelligence', 'bi', 'tableau', 'power bi', 'sql',
               'data visualization', 'reporting', 'metrics', 'kpi', 'dashboard'],
    searchTerms: ['data analyst intern', 'business intelligence intern', 'analytics intern']
  },
  'marketing': {
    keywords: ['marketing', 'digital marketing', 'social media', 'seo', 'content', 'brand', 'campaign',
               'advertising', 'growth', 'acquisition', 'retention'],
    searchTerms: ['marketing intern', 'digital marketing intern', 'social media intern', 'growth intern']
  },
  'product management': {
    keywords: ['product manager', 'product management', 'pm', 'product development', 'roadmap', 'user stories',
               'product strategy', 'product owner'],
    searchTerms: ['product management intern', 'product manager intern', 'associate product manager']
  },
  'operations': {
    keywords: ['operations', 'supply chain', 'logistics', 'procurement', 'lean', 'six sigma', 'process improvement',
               'warehouse', 'inventory'],
    searchTerms: ['operations intern', 'supply chain intern', 'logistics intern']
  },
  'healthcare': {
    keywords: ['healthcare', 'clinical', 'medical', 'hospital', 'patient', 'pharma', 'biotech', 'health',
               'epidemiology', 'public health', 'nursing'],
    searchTerms: ['healthcare intern', 'clinical research intern', 'pharma intern', 'biotech intern']
  },
  'design': {
    keywords: ['graphic design', 'ui design', 'ux design', 'figma', 'sketch', 'adobe', 'photoshop',
               'illustrator', 'user experience', 'user interface', 'visual design'],
    searchTerms: ['design intern', 'UX design intern', 'graphic design intern']
  },
  'hr': {
    keywords: ['human resources', 'hr', 'recruiting', 'talent acquisition', 'people operations',
               'organizational development', 'compensation', 'benefits'],
    searchTerms: ['HR intern', 'human resources intern', 'recruiting intern']
  },
  'legal': {
    keywords: ['law', 'legal', 'attorney', 'lawyer', 'paralegal', 'litigation', 'corporate law',
               'intellectual property', 'compliance', 'regulatory'],
    searchTerms: ['legal intern', 'law intern', 'compliance intern']
  },
};

/**
 * Extract skills from resume text using comprehensive dictionary matching.
 */
function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  
  for (const [skillName, variants] of Object.entries(SKILL_DICTIONARY)) {
    for (const variant of variants) {
      if (variant.length <= 2) {
        // Short terms need word boundary matching
        const regex = new RegExp(`\\b${variant.replace(/[+#.]/g, '\\$&')}\\b`, 'i');
        if (regex.test(text)) {
          found.push(skillName);
          break;
        }
      } else if (lower.includes(variant)) {
        found.push(skillName);
        break;
      }
    }
  }
  
  return [...new Set(found)];
}

/**
 * Detect which domains/industries the resume belongs to.
 */
function detectDomains(text: string): string[] {
  const lower = text.toLowerCase();
  const domainScores: Record<string, number> = {};
  
  for (const [domain, config] of Object.entries(DOMAIN_SIGNALS)) {
    let score = 0;
    for (const keyword of config.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        score++;
      }
    }
    if (score >= 2) { // Need at least 2 keyword hits to count as a domain
      domainScores[domain] = score;
    }
  }
  
  // Sort by score descending, return top 3
  return Object.entries(domainScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([domain]) => domain);
}

/**
 * Build search queries based on detected domains and skills.
 */
function buildSearchQueries(domains: string[], skills: string[], fallbackQuery: string): string[] {
  const queries: string[] = [];

  // Domain-specific queries (highest value)
  for (const domain of domains) {
    const config = DOMAIN_SIGNALS[domain];
    if (config) {
      queries.push(...config.searchTerms.slice(0, 2));
    }
  }

  // Skill-based queries for top skills
  const techSkills = skills.filter(s => 
    !['excel', 'powerpoint', 'communication', 'leadership', 'teamwork', 'problem solving'].includes(s)
  );
  for (const skill of techSkills.slice(0, 2)) {
    queries.push(`${skill} intern`);
  }

  // Fallback
  if (queries.length === 0) {
    queries.push(`${fallbackQuery} internship`);
    queries.push(`${fallbackQuery} intern`);
  }

  return [...new Set(queries)].slice(0, 6);
}

/**
 * Score a job against the user's profile.
 */
function scoreJob(job: any, skills: string[], domains: string[]): number {
  const jobText = `${job.title || ''} ${job.description || ''} ${job.company || ''}`.toLowerCase();
  const title = (job.title || '').toLowerCase();
  
  let score = 15; // base

  // ── Skill matching (0-40 pts) ──
  if (skills.length > 0) {
    let matched = 0;
    for (const skill of skills) {
      if (jobText.includes(skill.toLowerCase())) matched++;
    }
    const ratio = matched / Math.min(skills.length, 15); // cap at 15 to avoid diluting
    score += Math.round(ratio * 40);
    if (matched >= 4) score += 5;
    if (matched >= 7) score += 5;
  }

  // ── Domain matching (0-25 pts) ──
  for (const domain of domains) {
    const config = DOMAIN_SIGNALS[domain];
    if (config) {
      let domainHits = 0;
      for (const kw of config.keywords) {
        if (jobText.includes(kw.toLowerCase())) domainHits++;
      }
      if (domainHits >= 3) { score += 25; break; }
      else if (domainHits >= 2) { score += 15; break; }
      else if (domainHits >= 1) { score += 8; break; }
    }
  }

  // ── Internship/entry bonus (0-10 pts) ──
  if (title.includes('intern') || title.includes('internship') || title.includes('trainee') || title.includes('apprentice')) {
    score += 10;
  } else if (title.includes('junior') || title.includes('entry') || title.includes('analyst') || title.includes('associate')) {
    score += 5;
  }

  // ── Penalties ──
  const seniorKw = ['senior', 'sr.', 'staff', 'lead', 'manager', 'director', 'principal', 'head of', 'vp', 'chief', 'architect'];
  if (seniorKw.some(k => title.includes(k))) score -= 25;

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
    // Step 1: Deep profile extraction from resume
    // ────────────────────────────────────────────
    let detectedSkills: string[] = [];
    let detectedDomains: string[] = [];

    if (resumeText && resumeText.length > 50) {
      detectedSkills = extractSkills(resumeText);
      detectedDomains = detectDomains(resumeText);
    }

    // Merge with client-provided data
    const allSkills = [...new Set([
      ...detectedSkills,
      ...(Array.isArray(clientSkills) ? clientSkills.map(String).filter(Boolean) : [])
    ])];
    const allDomains = [...new Set([
      ...detectedDomains,
      ...(Array.isArray(clientRoles) ? clientRoles.map(String).filter(Boolean) : [])
    ])];

    console.log('Detected Skills:', detectedSkills.slice(0, 15));
    console.log('Detected Domains:', detectedDomains);
    console.log('Merged Skills count:', allSkills.length);

    // ────────────────────────────────────────────
    // Step 2: Build domain-aware search queries
    // ────────────────────────────────────────────
    const searchQueries = buildSearchQueries(allDomains, allSkills, query);
    console.log('Search Queries:', searchQueries);

    // ────────────────────────────────────────────
    // Step 3: Fetch jobs from all aggregator sources
    // ────────────────────────────────────────────
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
    console.log(`Total unique jobs found: ${rawJobs.length}`);

    // ────────────────────────────────────────────
    // Step 4: Score and rank
    // ────────────────────────────────────────────
    const scoredJobs = rawJobs.map(job => {
      const matchScore = scoreJob(job, allSkills, allDomains);
      return { ...job, matchScore, matchLabel: getMatchLabel(matchScore) };
    });

    const finalJobs = scoredJobs
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 50);

    console.log(`Returning ${finalJobs.length} jobs (top: ${finalJobs[0]?.matchScore || 0}%, domains: ${allDomains.join(',')})`);

    return NextResponse.json({
      success: true,
      total: finalJobs.length,
      detected_skills: allSkills,
      detected_domains: allDomains,
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
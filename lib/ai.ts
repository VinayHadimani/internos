"use server";

import { callAI } from '@/lib/rotating-ai';

export interface ExtractedSkills {
  skills: string[];
  experienceLevel: 'high_school' | 'student' | 'fresh_graduate' | 'junior' | 'mid' | 'senior';
  industries: string[];
  roleTypes: string[];
  location: string;
  detected_country: string;
}

export async function extractSkillsFromResume(resumeText: string): Promise<ExtractedSkills> {
  try {
    const extractResponse = await callAI(
      `You are an expert recruiter and career analyst AI. Analyze this resume with EXTREME attention to what makes this candidate unique.

CRITICAL RULES FOR EXTRACTION:
1. Extract skills that are ACTUALLY present. Do NOT favor any specific industry (like tech/finance). 
2. DOMAIN-SPECIFIC skills are 10x more important than generic soft skills.
3. If the candidate is in Retail, Hospitality, Healthcare, Trades, Creative Arts, Sport, or Law, extract the specific terminology and tools for that domain.
4. You MUST detect the candidate's country and city from the resume.
   - SIGNALS FOR AUSTRALIA: (1) Phone numbers starting with 04 or +61. (2) Postcodes 3000-3999 (VIC), 2000-2999 (NSW), 4000-4999 (QLD), 6000-6999 (WA), 5000-5999 (SA). (3) School names containing 'Secondary College', 'High School', 'VCE', 'HSC', 'ATAR', 'VET studies'. (4) Terms: 'casual/part-time', 'fortnight', 'HECS'. If Victorian signals found, set city to 'Melbourne'.
   - SIGNALS FOR INDIA: Phone starts with +91. 6-digit postcodes.
   - SIGNALS FOR USA: Phone starts with +1. 5-digit zip codes.
   - If unsure, set detected_country to "remote". NEVER default to India or USA.
5. You MUST identify the experience_level: 'high_school' (no degree, currently in school), 'student' (college/university), 'fresh_graduate' (0-1 yrs), 'junior' (1-3 yrs), 'mid' (3-7 yrs), 'senior' (7+ yrs).

Return exact JSON:
{
  "skills": ["skill1", "skill2", "..."],
  "experienceLevel": "high_school" | "student" | "fresh_graduate" | "junior" | "mid" | "senior",
  "industries": ["industry1", "..."],
  "roleTypes": ["role1", "..."],
  "location": "City",
  "detected_country": "Country Name"
}`,
      resumeText,
      {
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      }
    );

    if (!extractResponse.success) {
      throw new Error(extractResponse.error || 'AI Extraction failed');
    }

    let raw = extractResponse.content || '{}';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    
    const result = JSON.parse(raw) as ExtractedSkills;
    
    return {
      skills: result.skills?.length > 0 ? result.skills : extractSkillsByKeywords(resumeText),
      experienceLevel: result.experienceLevel || 'student',
      industries: result.industries || [],
      roleTypes: result.roleTypes || [],
      location: result.location || 'remote',
      detected_country: result.detected_country || 'remote'
    };
  } catch (error) {
    console.error("Failed to extract skills:", error);
    return {
      skills: extractSkillsByKeywords(resumeText),
      experienceLevel: 'student',
      industries: [],
      roleTypes: [],
      location: 'remote',
      detected_country: 'remote'
    };
  }
}

// Fallback keyword extraction
function extractSkillsByKeywords(text: string): string[] {
  const lowerText = text.toLowerCase();
  
  const skillCategories = {
    tech: ['javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue', 'node',
      'mongodb', 'sql', 'postgresql', 'mysql', 'aws', 'docker', 'kubernetes', 'git',
      'html', 'css', 'tailwind', 'bootstrap', 'figma', 'redux', 'nextjs', 'django',
      'flask', 'spring', 'android', 'ios', 'flutter', 'machine learning',
      'data science', 'pandas', 'numpy', 'tensorflow', 'pytorch', 'graphql', 'c++', 'c#', 'go'],
    analytics: ['excel', 'google sheets', 'tableau', 'power bi', 'spss', 'sas', 'vba', 'stata',
      'r studio', 'data analysis', 'data visualization', 'statistical analysis'],
    business: ['strategy', 'market research', 'business development', 'stakeholder management', 'presentation skills', 'client engagement'],
    finance: ['investment banking', 'equity research', 'risk management', 'accounting', 'financial planning', 'budgeting'],
    marketing: ['seo', 'sem', 'social media marketing', 'content marketing', 'digital marketing', 'google analytics'],
    retail_hospitality: ['customer service', 'cash handling', 'pos', 'retail', 'merchandising', 'inventory', 'food service', 'hospitality', 'barista', 'waitstaff'],
    healthcare: ['patient care', 'cpr', 'medical records', 'phlebotomy', 'clinical', 'nursing'],
    creative: ['graphic design', 'illustration', 'photography', 'video editing', 'adobe photoshop', 'ui ux', 'copywriting'],
    legal: ['legal research', 'paralegal', 'contract drafting', 'compliance', 'litigation'],
    trades: ['electrical', 'plumbing', 'carpentry', 'welding', 'hvac', 'blueprint reading', 'osha'],
    sports_fitness: ['coaching', 'fitness training', 'sports management', 'athletic training', 'first aid', 'officiating'],
    education: ['lesson planning', 'classroom management', 'tutoring', 'curriculum development', 'grading']
  };
  
  const found: string[] = [];
  for (const categorySkills of Object.values(skillCategories)) {
    for (const skill of categorySkills) {
      if (lowerText.includes(skill.toLowerCase()) && !found.some(f => f.toLowerCase() === skill.toLowerCase())) {
        found.push(skill);
      }
    }
  }
  
  // Sort: longer/more specific skills first (they're more meaningful)
  found.sort((a, b) => b.length - a.length);
  
  if (/(^|[^a-z])r([^a-z]|$)/i.test(text) && !found.some((s) => s.toLowerCase() === 'r studio')) {
    found.push('R');
  }
  
  return found;
}

function isEnglish(text: string): boolean {
  if (!text) return true;
  // Check for common non-English characters
  const nonEnglishPatterns = /[\u0900-\u097F\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\u0400-\u04FF\u0600-\u06FF\u0E00-\u0E7F]/;
  
  if (nonEnglishPatterns.test(text)) {
    return false;
  }
  
  // If mostly ASCII characters, assume English
  const asciiCount = (text.match(/[\x00-\x7F]/g) || []).length;
  return asciiCount / text.length > 0.95;
}

export async function translateJobToEnglish(text: string, sourceLanguage?: string): Promise<string> {
  // Skip if already in English or empty
  if (!text || isEnglish(text)) {
    return text;
  }
  
  try {
    const response = await callAI(
      `You are a professional translator. Translate the following job posting to English.
          
  Rules:
  1. Maintain all formatting and structure
  2. Keep company names, URLs, and technical terms unchanged
  3. Use professional business English
  4. Preserve all job details accurately
  5. Return ONLY the translated text, no explanations`,
      `Translate this job posting to English:\n\n${text}`,
      {
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2000
      }
    );

    return response.content || text;
  } catch (error) {
    console.error("Translation failed:", error);
    return text; // Fallback to original text
  }
}

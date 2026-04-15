"use server";

import { callAI } from '@/lib/rotating-ai';

export interface ExtractedSkills {
  skills: string[];
  experienceLevel: 'fresher' | 'junior' | 'mid' | 'senior';
  industries: string[];
  roleTypes: string[];
  location: string;
}

export async function extractSkillsFromResume(resumeText: string): Promise<ExtractedSkills> {
  try {
    const extractResponse = await callAI(
      `You are an expert recruiter and career analyst AI. Analyze this resume with EXTREME attention to what makes this candidate unique.

CRITICAL RULES FOR SKILL EXTRACTION:
1. Extract skills that are ACTUALLY present on the resume. Do NOT favor any specific industry (like tech or finance) over others.
2. DOMAIN-SPECIFIC skills are 10x more important than generic soft skills.
3. If the candidate is in Retail, Hospitality, Healthcare, Trades, Creative Arts, Sport, or Law, extract the specific terminology and tools for that domain.
4. If the resume mentions a Career Objective or target role, those keywords MUST be prioritized as top skills.
5. Derive target roles from what the candidate WANTS to do (Objective), not just past experience.

SKILL EXTRACTION HIERARCHY:
- TIER 1 (Domain-specific): Industry terms, specialized tools (e.g., "point of sale", "patient care", "CAD software", "litigation research"), domain certifications, target role keywords.
- TIER 2 (Technical/Hard skills): Specific software, measurable capabilities, methodologies.
- TIER 3 (Soft skills): Only include if exceptional and backed by evidence. Avoid generic terms like "communication" or "teamwork" unless they are the primary focus of the role.

Return exact JSON:
{
  "skills": ["skill1", "skill2", "..."],
  "experienceLevel": "fresher" | "junior" | "mid" | "senior",
  "industries": ["industry1", "industry2"],
  "roleTypes": ["role1", "role2"],
  "location": "City, Country"
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
      experienceLevel: result.experienceLevel || 'fresher',
      industries: result.industries || [],
      roleTypes: result.roleTypes || [],
      location: result.location || 'India'
    };
  } catch (error) {
    console.error("Failed to extract skills:", error);
    return {
      skills: extractSkillsByKeywords(resumeText),
      experienceLevel: 'fresher',
      industries: [],
      roleTypes: [],
      location: 'India'
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

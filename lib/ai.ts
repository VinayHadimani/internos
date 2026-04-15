"use server";

import { callAI } from '@/lib/rotating-ai';

export interface ExtractedSkills {
  skills: string[];
  roles: string[];
  keywords: string[];
  location: string;
  industry: string;
  experience_level: string;
  detected_country: string;
}

export async function extractSkillsFromResume(resumeText: string): Promise<ExtractedSkills> {
  try {
    const prompt = `You are an expert recruiter and skill extraction AI. Analyze the resume thoroughly.
Extract:
- Technical, domain-specific, and soft skills (not just tech - sports, retail, service, etc.).
- Target roles the candidate is seeking or qualified for.
- 5-8 search keywords that would find relevant entry-level jobs/internship.
- Location (City/State) AND Detect Country based on:
  * Phone prefixes (+61 AU, +91 IN, +1 US, +44 UK, +49 DE).
  * Postcode patterns (3xxx/2xxx AU, 5-6 digits IN/US, etc.).
  * School names and terms (Secondary College, Year 11/12 = AU).
- Industry/Domain (Retail, Sport, Software, Finance, etc.).
- Experience level: "high_school", "student", "recent_grad", or "junior".

Return ONLY JSON:
{
  "skills": [],
  "roles": [],
  "keywords": [],
  "location": "City, State",
  "detected_country": "australia/india/us/uk/germany/canada",
  "industry": "...",
  "experience_level": "..."
}`;

    const response = await callAI(prompt, resumeText, {
      model: 'gemini-1.5-flash',
      temperature: 0.1
    });

    if (response.success && response.content) {
       const cleaned = response.content.replace(/```json|```/g, '').trim();
       const parsed = JSON.parse(cleaned);
       return {
         skills: parsed.skills || [],
         roles: parsed.roles || [],
         keywords: parsed.keywords || [],
         location: parsed.location || 'remote',
         industry: parsed.industry || 'General',
         experience_level: parsed.experience_level || 'student',
         detected_country: parsed.detected_country || 'remote'
       };
    }
  } catch (e) {
    console.error("AI Skill extraction failed:", e);
  }
  
  // High-School / Student sensitive fallback
  return { 
    skills: ["Communication", "Teamwork"], 
    roles: ["Intern"], 
    keywords: ["internship"], 
    location: "remote", 
    industry: "General", 
    experience_level: "student",
    detected_country: "remote" 
  };
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

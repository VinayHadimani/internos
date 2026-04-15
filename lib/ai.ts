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
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      providerPriority: ['groq', 'gemini', 'openai']
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
  
  // Organized by domain for better coverage (Fix #7)
  const allSkills: Record<string, string[]> = {
    tech: ['javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue', 'node',
      'mongodb', 'sql', 'postgresql', 'mysql', 'aws', 'docker', 'kubernetes', 'git',
      'html', 'css', 'tailwind', 'bootstrap', 'figma', 'redux', 'nextjs', 'django',
      'flask', 'spring', 'android', 'ios', 'flutter', 'react native', 'machine learning',
      'data science', 'pandas', 'numpy', 'tensorflow', 'pytorch', 'graphql', 'rest api',
      'c++', 'c#', 'go', 'rust', 'php', 'laravel', 'ruby', 'swift', 'kotlin'],
    business: ['excel', 'google sheets', 'tableau', 'power bi', 'spss', 'sas', 'vba', 'stata',
      'r studio', 'ggplot', 'financial modeling', 'case studies', 'strategy', 'market research',
      'due diligence', 'management consulting', 'business strategy', 'financial analysis',
      'valuation', 'consulting', 'accounting', 'bookkeeping', 'auditing', 'budgeting'],
    soft_skills: ['leadership', 'communication', 'teamwork', 'problem solving', 'time management',
      'critical thinking', 'presentation', 'negotiation', 'project management', 'organization',
      'adaptability', 'conflict resolution', 'decision making', 'attention to detail'],
    retail: ['customer service', 'cash handling', 'pos systems', 'point of sale', 'sales',
      'merchandising', 'inventory management', 'stock management', 'visual merchandising',
      'store management', 'loss prevention', 'retail operations'],
    sports: ['coaching', 'fitness', 'personal training', 'athletic training', 'sports management',
      'first aid', 'event coordination', 'team management', 'recreation', 'exercise science'],
    marketing: ['social media', 'content writing', 'seo', 'email marketing', 'brand management',
      'copywriting', 'digital marketing', 'market research', 'analytics', 'campaign management'],
    design: ['photoshop', 'illustrator', 'indesign', 'canva', 'ui design', 'ux design',
      'graphic design', 'video editing', 'photography', 'animation'],
    operations: ['supply chain', 'logistics', 'operations management', 'quality assurance',
      'process improvement', 'vendor management', 'procurement'],
    healthcare: ['patient care', 'clinical', 'medical records', 'healthcare', 'phlebotomy',
      'vital signs', 'electronic health records', 'hipaa', 'cpr'],
  };
  
  const found: string[] = [];
  for (const [, skills] of Object.entries(allSkills)) {
    for (const skill of skills) {
      if (lowerText.includes(skill.toLowerCase())) {
        found.push(skill);
      }
    }
  }
  
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

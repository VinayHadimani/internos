"use server";

import { callAI } from '@/lib/rotating-ai';

export interface ExtractedSkills {
  hard_skills: string[];
  soft_skills: string[];
  experienceLevel: 'fresher' | 'junior' | 'mid' | 'senior';
  industries: string[];
  roleTypes: string[];
  location: string;
}

export async function extractSkillsFromResume(resumeText: string): Promise<ExtractedSkills> {
  try {
    const prompt = `You are a resume analysis engine. Read the resume and extract a professional profile.

The resume could be from ANY career field. Do not assume any default industry.

Extract and return JSON:
{
  "hard_skills": ["specific, searchable abilities from the resume"],
  "soft_skills": ["generic interpersonal traits"],
  "experienceLevel": "fresher or junior or mid or senior",
  "industries": ["primary industry from their work experience"],
  "roleTypes": ["3-5 job titles they should search for, based on their actual work"],
  "location": "city, country from their address"
}

RULES:
1. hard_skills = specific searchable skills (Python, SEO, AutoCAD, patient care, inventory management). NO soft skills.
2. soft_skills = generic traits (communication, teamwork, leadership). Separate from hard_skills.
3. industries = what industry their WORK EXPERIENCE is in. Not what they studied unless they have no work experience.
4. roleTypes = realistic job titles for this person. Based on WHERE they worked, not just what they know. 3-5 titles.
5. location = extract from address/contact info.
6. Return ONLY valid JSON, no explanation.`;

    const response = await callAI(prompt, resumeText, {
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      providerPriority: ['groq', 'gemini', 'openai']
    });

    if (response.success && response.content) {
       const cleaned = response.content.replace(/```json|```/g, '').trim();
       const parsed = JSON.parse(cleaned);
       return {
         hard_skills: parsed.hard_skills?.length > 0 ? parsed.hard_skills : extractSkillsByKeywords(resumeText),
         soft_skills: parsed.soft_skills || [],
         experienceLevel: parsed.experienceLevel || 'fresher',
         industries: parsed.industries || [],
         roleTypes: parsed.roleTypes || [],
         location: parsed.location || 'India'
       };
    }
  } catch (e) {
    console.error("AI Skill extraction failed:", e);
  }
  
  // Fallback — use keyword extraction for hard skills
  return { 
    hard_skills: extractSkillsByKeywords(resumeText),
    soft_skills: [],
    experienceLevel: 'fresher',
    industries: [],
    roleTypes: [],
    location: 'India'
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
    retail: ['cash handling', 'pos systems', 'point of sale', 'sales',
      'merchandising', 'inventory management', 'stock management', 'visual merchandising',
      'store management', 'loss prevention', 'retail operations'],
    sports: ['coaching', 'fitness', 'personal training', 'athletic training', 'sports management',
      'first aid', 'event coordination', 'team management', 'recreation', 'exercise science',
      'umpiring', 'refereeing'],
    marketing: ['social media', 'content writing', 'seo', 'email marketing', 'brand management',
      'copywriting', 'digital marketing', 'market research', 'analytics', 'campaign management'],
    design: ['photoshop', 'illustrator', 'indesign', 'canva', 'ui design', 'ux design',
      'graphic design', 'video editing', 'photography', 'animation'],
    operations: ['supply chain', 'logistics', 'operations management', 'quality assurance',
      'process improvement', 'vendor management', 'procurement'],
    healthcare: ['patient care', 'clinical', 'medical records', 'healthcare', 'phlebotomy',
      'vital signs', 'electronic health records', 'hipaa', 'cpr'],
    hospitality: ['food service', 'front desk', 'hotel management', 'bartending',
      'food safety', 'housekeeping', 'reservation systems'],
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

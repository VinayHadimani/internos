"use server";

import { callAI } from '@/lib/rotating-ai';

function cleanResumeText(text: string): string {
  return text
    .replace(/\(Tip:[\s\S]*?\)/g, '')
    .replace(/^Tip:.*$/gm, '')
    .replace(/^Page \d+$/gm, '')
    .replace(/^((?:Resume|CV|Curriculum Vitae)\s*)$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

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
    const cleanedText = cleanResumeText(resumeText);

    const prompt = `You are a resume analysis engine. Read the resume and extract a professional profile.

The resume could be from ANY career field and ANY experience level (high school student to senior professional).
Do not assume any default industry.

IMPORTANT: Many resumes contain template "(Tip: ...)" paragraphs. IGNORE these — they are resume-writing instructions, not real content.

If the resume has a "Career Objective" or "Objective" section, READ IT CAREFULLY. It states what job they want — use it as the PRIMARY source for roleTypes and industries.

Extract and return JSON:
{
  "hard_skills": ["specific abilities found in the resume"],
  "soft_skills": ["generic interpersonal traits"],
  "experienceLevel": "fresher or junior or mid or senior",
  "industries": ["industry from career objective or work experience"],
  "roleTypes": ["3-5 job titles from their career objective or work experience"],
  "location": "city, country"
}

RULES:
1. hard_skills = specific searchable skills. For entry-level workers with NO technical skills, include basic abilities: "cash handling", "operating cash register", "customer service", "basic math", "serving customers", "food preparation". NEVER leave this empty.
2. soft_skills = generic traits only (communication, teamwork, leadership). Keep separate from hard_skills.
3. industries = what industry they want to work in. Use the Career Objective first. One or two words.
4. roleTypes = job titles that match THEIR career objective or work. Not generic. 3-5 titles.
5. location = extract from address/contact info.
6. Return ONLY valid JSON, no explanation.`;

    const response = await callAI(prompt, cleanedText, {
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

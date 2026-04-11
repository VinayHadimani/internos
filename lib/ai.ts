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
      `You are a skill extraction expert. Extract from the resume:
- Technical and soft skills
- Experience level (fresher/junior/mid/senior based on years)
- Industries they've worked in
- Role types they're suited for
- Location/City from their address or contact info

Return JSON:
{
  "skills": ["skill1", "skill2"],
  "experienceLevel": "fresher",
  "industries": ["tech"],
  "roleTypes": ["frontend"],
  "location": "Bangalore, India"
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
  const techSkills = [
    'javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue', 'node',
    'mongodb', 'sql', 'postgresql', 'mysql', 'aws', 'docker', 'kubernetes', 'git',
    'html', 'css', 'tailwind', 'bootstrap', 'figma', 'redux', 'nextjs', 'django',
    'flask', 'spring', 'android', 'ios', 'flutter', 'react native', 'machine learning',
    'data science', 'pandas', 'numpy', 'tensorflow', 'pytorch', 'graphql', 'rest api',
    'c++', 'c#', 'go', 'rust', 'php', 'laravel', 'ruby', 'swift', 'kotlin',
    'excel', 'google sheets', 'tableau', 'power bi', 'spss', 'sas', 'vba', 'stata',
    'r studio', 'ggplot',
  ];

  const lowerText = text.toLowerCase();
  const found = techSkills.filter((skill) => lowerText.includes(skill));
  if (/(^|[^a-z])r([^a-z]|$)/i.test(text) && !found.some((s) => s === 'r studio')) {
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

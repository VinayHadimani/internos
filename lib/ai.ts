"use server";

import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

export interface ExtractedSkills {
  skills: string[];
  experienceLevel: 'fresher' | 'junior' | 'mid' | 'senior';
  industries: string[];
  roleTypes: string[];
  location: string;
}

export async function extractSkillsFromResume(resumeText: string): Promise<ExtractedSkills> {
  try {
    const extractResponse = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a skill extraction expert. Extract from the resume:
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
}`
        },
        {
          role: 'user',
          content: resumeText
        }
      ],
      max_tokens: 500,
      temperature: 0.1,
    });

    let raw = extractResponse.choices[0]?.message?.content || '{}';
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
    'c++', 'c#', 'go', 'rust', 'php', 'laravel', 'ruby', 'swift', 'kotlin'
  ];
  
  const lowerText = text.toLowerCase();
  return techSkills.filter(skill => lowerText.includes(skill));
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
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the following job posting to English.
          
  Rules:
  1. Maintain all formatting and structure
  2. Keep company names, URLs, and technical terms unchanged
  3. Use professional business English
  4. Preserve all job details accurately
  5. Return ONLY the translated text, no explanations`
        },
        {
          role: 'user',
          content: `Translate this job posting to English:\n\n${text}`
        }
      ],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2000
    });

    return response.choices[0]?.message?.content || text;
  } catch (error) {
    console.error("Translation failed:", error);
    return text; // Fallback to original text
  }
}

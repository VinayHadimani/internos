"use server";

import { callAI } from '@/lib/rotating-ai';

function cleanResumeText(text: string): string {
  return text
    .replace(/\(Tip:[\s\S]*?\)/g, '')
    .replace(/\(Optional:[\s\S]*?\)/g, '')
    .replace(/\[[\s\S]*?Tip:[\s\S]*?\]/g, '')
    .replace(/^Tip:.*$/gm, '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .join('\n');
}

export interface ExtractedSkills {
  hard_skills: string[];
  soft_skills: string[];
  skills: string[];           // combined hard + soft (backward compat)
  experience: string;
  location: string;
  education: string;
  roles: string[];
  industry: string;
  experience_level: string;
  name: string;
  email: string;
  phone: string;
  // legacy aliases kept for backward compat
  experienceLevel: string;
  industries: string[];
  roleTypes: string[];
}

export async function extractSkillsFromResume(resumeText: string): Promise<ExtractedSkills> {
  const empty: ExtractedSkills = {
    hard_skills: [],
    soft_skills: [],
    skills: [],
    experience: '',
    location: '',
    education: '',
    roles: [],
    industry: '',
    experience_level: 'entry',
    name: '',
    email: '',
    phone: '',
    experienceLevel: 'entry',
    industries: [],
    roleTypes: [],
  };

  try {
    const clean = cleanResumeText(resumeText);

    const systemPrompt = `You are a resume analyst. Extract structured data from resumes. Return ONLY valid JSON, no markdown, no explanation.`;

    const userPrompt = `Analyze this resume and extract structured data.

RULES:
- CAREER OBJECTIVE comes first: if there's a Professional Summary, Career Objective, or About Me section, read it to understand what roles they WANT
- Separate HARD SKILLS (technical, tools, software, certifications, equipment, operational abilities) from SOFT SKILLS (communication, teamwork, leadership)
- Operational abilities ARE hard skills: "cash handling", "operating cash register", "inventory management", "food preparation", "serving customers" etc
- For students/entry-level: coursework, projects, and part-time jobs count as valid experience
- DO NOT leave hard_skills empty. If they have no technical skills, list whatever specific abilities they DO have.
- roles should match the CAREER OBJECTIVE, not generic titles
- industry = where they WANT to work (from career objective), not just where they've worked
- experience_level: "entry" (student/0-1yr), "junior" (1-3yr), "mid" (3-7yr), "senior" (7+yr)

Return ONLY this JSON:
{
  "hard_skills": ["skill1", "skill2"],
  "soft_skills": ["skill1", "skill2"],
  "experience": "summary of their work experience",
  "location": "City, Country",
  "education": "Degree from University",
  "roles": ["Target Role 1", "Target Role 2"],
  "industry": "industry they want to work in",
  "experience_level": "entry",
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "phone number"
}

RESUME:
${clean.slice(0, 5000)}`;

    const response = await callAI(systemPrompt, userPrompt, {
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      providerPriority: ['groq', 'gemini', 'openai'],
    });

    if (!response.success || !response.content) {
      console.error('[ai.ts] AI extraction failed:', response.error);
      return empty;
    }

    const jsonStr = response.content
      .replace(/```json\n?/g, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(jsonStr);

    const hard_skills: string[] = Array.isArray(parsed.hard_skills) ? parsed.hard_skills : [];
    const soft_skills: string[] = Array.isArray(parsed.soft_skills) ? parsed.soft_skills : [];
    const roles: string[] = Array.isArray(parsed.roles) ? parsed.roles : [];

    return {
      hard_skills,
      soft_skills,
      skills: [...hard_skills, ...soft_skills],
      experience: parsed.experience || '',
      location: parsed.location || '',
      education: parsed.education || '',
      roles,
      industry: parsed.industry || '',
      experience_level: parsed.experience_level || 'entry',
      name: parsed.name || '',
      email: parsed.email || '',
      phone: parsed.phone || '',
      // legacy aliases
      experienceLevel: parsed.experience_level || 'entry',
      industries: parsed.industry ? [parsed.industry] : [],
      roleTypes: roles,
    };
  } catch (err) {
    console.error('[ai.ts] Extract skills error:', err);
    return empty;
  }
}

/**
 * Translates foreign-language job descriptions to English using AI.
 */
export async function translateJobToEnglish(text: string, sourceLanguage?: string): Promise<string> {
  try {
    const response = await callAI(
      'You are a professional translator. Translate the provided text to English. Return ONLY the translated text, no explanation.',
      sourceLanguage
        ? `Translate this ${sourceLanguage} text to English:\n\n${text}`
        : `Translate this text to English:\n\n${text}`,
      { model: 'llama-3.3-70b-versatile', temperature: 0.1, providerPriority: ['groq', 'gemini', 'openai'] }
    );
    return response.success && response.content ? response.content : text;
  } catch {
    return text;
  }
}

// Keyword-based fallback (legacy — only used if AI completely unavailable)
export function extractSkillsByKeywords(text: string): string[] {
  const KNOWN_SKILLS = [
    'python', 'javascript', 'typescript', 'java', 'c++', 'c#', 'react', 'node.js',
    'sql', 'mongodb', 'postgresql', 'aws', 'docker', 'kubernetes', 'git',
    'html', 'css', 'angular', 'vue', 'next.js', 'express', 'django', 'flask',
    'machine learning', 'data analysis', 'excel', 'tableau', 'power bi',
    'figma', 'photoshop', 'illustrator', 'seo', 'google analytics',
    'cash handling', 'inventory management', 'customer service', 'food preparation',
    'microsoft office', 'word', 'powerpoint', 'outlook',
  ];
  const lower = text.toLowerCase();
  return KNOWN_SKILLS.filter(skill => lower.includes(skill));
}

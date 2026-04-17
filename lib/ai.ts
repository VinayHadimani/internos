import { callAI } from '@/lib/rotating-ai';

export interface ExtractedSkills {
  hard_skills: string[];
  soft_skills: string[];
  skills: string[];
  experience: string;
  location: string;
  education: string;
  roles: string[];
  industry: string;
  experience_level: string;
  name: string;
  email: string;
  phone: string;
}

function cleanResumeText(text: string): string {
  return text
    .replace(/\(Tip:[\s\S]*?\)/g, '')
    .replace(/\(Optional:.*?\)/gi, '')
    .replace(/\[.*?Tip:.*?\]/gi, '')
    .replace(/Tip:.*?(?:\n|$)/gi, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n');
}

export async function extractSkillsFromResume(resumeText: string): Promise<ExtractedSkills> {
  try {
    const clean = cleanResumeText(resumeText);

    const extractResponse = await callAI(
      `You are a resume analyst. Analyze this resume and extract structured data.

RULES:
- CAREER OBJECTIVE comes first: if there's a Professional Summary, Career Objective, or About Me section, read it to understand what roles they WANT
- Separate HARD SKILLS (technical, tools, software, certifications, equipment) from SOFT SKILLS (communication, teamwork, leadership)
- Operational abilities are hard skills: "cash handling", "operating cash register", "inventory management", "food preparation" etc.
- For students/entry-level: coursework, projects, and part-time jobs count as valid experience
- Extract actual experience level: "entry" (student/0-1yr), "junior" (1-3yr), "mid" (3-7yr), "senior" (7+yr)

Return ONLY valid JSON:
{
  "hard_skills": ["skill1", "skill2"],
  "soft_skills": ["skill1", "skill2"],
  "experience": "2 years at Company X as Role",
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
${clean}`,
      clean,
      {
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      }
    );

    if (!extractResponse.success) {
      throw new Error(extractResponse.error || 'AI Extraction failed');
    }

    let raw = extractResponse.content || '{}';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

    const parsed = JSON.parse(raw);

    const hard_skills = Array.isArray(parsed.hard_skills) ? parsed.hard_skills : [];
    const soft_skills = Array.isArray(parsed.soft_skills) ? parsed.soft_skills : [];

    return {
      hard_skills,
      soft_skills,
      skills: [...hard_skills, ...soft_skills],
      experience: parsed.experience || '',
      location: parsed.location || '',
      education: parsed.education || '',
      roles: Array.isArray(parsed.roles) ? parsed.roles : [],
      industry: parsed.industry || '',
      experience_level: parsed.experience_level || 'entry',
      name: parsed.name || '',
      email: parsed.email || '',
      phone: parsed.phone || '',
    };
  } catch (err) {
    console.error('Extract skills error:', err);
    return {
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
    };
  }
}

function isEnglish(text: string): boolean {
  if (!text) return true;
  const nonEnglishPatterns = /[\u0900-\u097F\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\u0400-\u04FF\u0600-\u06FF\u0E00-\u0E7F]/;
  if (nonEnglishPatterns.test(text)) return false;
  const asciiCount = (text.match(/[\x00-\x7F]/g) || []).length;
  return asciiCount / text.length > 0.95;
}

export async function translateJobToEnglish(text: string, sourceLanguage?: string): Promise<string> {
  if (!text || isEnglish(text)) return text;

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
    console.error('Translation failed:', error);
    return text;
  }
}

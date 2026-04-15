"use server";

import { getDocumentProxy, extractText } from 'unpdf';
import { callAI } from './rotating-ai';

export interface StudentProfile {
  name: string;
  education: {
    degree: string;
    year: string;
    graduation_year: number;
    institution: string;
  };
  experience_level: "student_fresher";
  verified_skills: {
    languages: string[];
    frameworks: string[];
    tools: string[];
    ai_ml: string[];
    domains: string[];
  };
  projects: {
    name: string;
    tech_used: string[];
    complexity: "low" | "medium" | "high";
    counts_as_experience_months: number;
  }[];
  certifications: string[];
  availability: {
    type: "part-time" | "full-time" | "project-based";
    remote_only: boolean;
    location: string;
  };
  total_effective_experience_months: number;
}

/**
 * Extracts clean text from a PDF file buffer.
 * Uses 'unpdf' which is already in package.json.
 */
export async function parseResumePDF(buffer: ArrayBuffer): Promise<string> {
  try {
    const uint8Array = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8Array);
    const { text } = await extractText(pdf);
    
    // Join pages and sanitize
    const rawText = text.join('\n');
    
    // Clean template instructions and artifacts (Fix #2)
    let cleanText = rawText
      .replace(/\s+/g, ' ')
      .trim();

    // Remove template "Tip:" paragraphs and instructional text (Fix #1)
    cleanText = cleanText.replace(/\(Tip:[\s\S]*?\)/g, ' ');
    cleanText = cleanText.replace(/\(Note:[\s\S]*?\)/g, ' ');
    cleanText = cleanText.replace(/\(Advice:[\s\S]*?\)/g, ' ');
    cleanText = cleanText.replace(/\(Suggestion:[\s\S]*?\)/g, ' ');
    cleanText = cleanText.replace(/\(Example:[\s\S]*?\)/g, ' ');
    cleanText = cleanText.replace(/\[Optional\]/gi, ' ');
    cleanText = cleanText.replace(/^[A-Z][a-z]+:.*(?:click here|replace this|your name here|fill in|example).*$/gim, ' ');
    // Clean up any double spaces created by removal
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    return cleanText;
  } catch (error) {
    console.error('[Resume Parser] PDF parsing failed:', error);
    throw new Error('Failed to extract text from PDF. Please ensure it is a valid document.');
  }
}

/**
 * Fallback for plain text files.
 */
export async function parseResumeText(text: string): Promise<string> {
  let cleaned = text
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
    .trim();
  // Remove template "Tip:" paragraphs and instructional text (Fix #1)
  cleaned = cleaned.replace(/\(Tip:[\s\S]*?\)/g, ' ');
  cleaned = cleaned.replace(/\(Note:[\s\S]*?\)/g, ' ');
  cleaned = cleaned.replace(/\(Advice:[\s\S]*?\)/g, ' ');
  cleaned = cleaned.replace(/\(Suggestion:[\s\S]*?\)/g, ' ');
  cleaned = cleaned.replace(/\(Example:[\s\S]*?\)/g, ' ');
  cleaned = cleaned.replace(/\[Optional\]/gi, ' ');
  cleaned = cleaned.replace(/^[A-Z][a-z]+:.*(?:click here|replace this|your name here|fill in|example).*$/gim, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

export async function parseStudentProfile(resumeText: string): Promise<StudentProfile> {
  // Initialize a default profile based on the schema
  const profile: StudentProfile = {
    name: "",
    education: {
      degree: "",
      year: "",
      graduation_year: 0,
      institution: ""
    },
    experience_level: "student_fresher", // RULE 1: LOCKED for anyone still pursuing degree
    verified_skills: {
      languages: [],
      frameworks: [],
      tools: [],
      ai_ml: [],
      domains: []
    },
    projects: [],
    certifications: [],
    availability: {
      type: "full-time", // Infer full-time as default for internships
      remote_only: false,
      location: ""
    },
    total_effective_experience_months: 0
  };

  // Regex to extract various fields. These are examples and need to be refined
  // Name extraction (simple, assumes first line or prominent name)
  const nameMatch = resumeText.match(/^[A-Z][a-z]+(?: [A-Z][a-z]+){1,2}/);
  if (nameMatch) profile.name = nameMatch[0];

  // Education extraction (highly dependent on resume format)
  const educationMatch = resumeText.match(/(?:(?:B\.E\.|B\.Tech|M\.Tech|B\.S\.)(?:[^\n\r]+?)\((\d{4})\)|(?:\d{1}st|\d{1}nd|\d{1}rd|\d{1}th) year(?:[^\n\r]+?)(?:\d{4})\b)/i);
  if (educationMatch) {
    // This is a very basic example; more robust parsing is needed.
    profile.education.degree = educationMatch[0].split(',')[0].trim();
    const yearMatch = educationMatch[0].match(/(\d{1}st|\d{1}nd|\d{1}rd|\d{1}th) year/i);
    if (yearMatch) profile.education.year = yearMatch[1];
    const gradYearMatch = educationMatch[0].match(/\((\d{4})\)/);
    if (gradYearMatch) profile.education.graduation_year = parseInt(gradYearMatch[1]);
    const institutionMatch = educationMatch[0].match(/at ([A-Za-z0-9\s,.-]+)/i);
    if (institutionMatch) profile.education.institution = institutionMatch[1].trim();
  }

  // Skills extraction (requires careful regex for explicit listings)
  // Example: Languages
  const languageKeywords = ['Python', 'JavaScript', 'Java', 'C++', 'C#', 'TypeScript', 'Go', 'Rust', 'Ruby', 'PHP'];
  languageKeywords.forEach(lang => {
    if (new RegExp(`\\b${lang}\\b`, 'i').test(resumeText)) {
      profile.verified_skills.languages.push(lang);
    }
  });

  // Example: Frameworks
  const frameworkKeywords = ['React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'ASP.NET'];
  frameworkKeywords.forEach(fw => {
    if (new RegExp(`\\b${fw}\\b`, 'i').test(resumeText)) {
      profile.verified_skills.frameworks.push(fw);
    }
  });

  // Example: AI/ML
  const aiMlKeywords = ['TensorFlow', 'Keras', 'PyTorch', 'Scikit-learn', 'OpenCV', 'Natural Language Processing', 'NLP', 'Machine Learning', 'Deep Learning', 'Computer Vision', 'LangChain'];
  aiMlKeywords.forEach(aiMl => {
    if (new RegExp(`\\b${aiMl}\\b`, 'i').test(resumeText)) {
      profile.verified_skills.ai_ml.push(aiMl);
    }
  });

  // Projects extraction (very complex, usually requires more advanced NLP)
  // This is a placeholder. Real implementation would involve identifying project titles, tech used, and descriptions.
  const projectMatches = resumeText.match(/Project: ([^\n\r]+)\nTech Used: ([^\n\r]+)\nDescription: ([^\n\r]+)/g);
  if (projectMatches) {
    projectMatches.forEach(match => {
      const nameMatch = match.match(/Project: ([^\n\r]+)/);
      const techUsedMatch = match.match(/Tech Used: ([^\n\r]+)/);
      // Placeholder for complexity and experience months (RULE 2)
      profile.projects.push({
        name: nameMatch ? nameMatch[1].trim() : "",
        tech_used: techUsedMatch ? techUsedMatch[1].split(',').map(s => s.trim()) : [],
        complexity: "medium", // Inferred or from keywords
        counts_as_experience_months: 3 // RULE 2: 0-3 months max
      });
    });
  }

  // Certifications (RULE 4)
  const certificationMatches = resumeText.match(/Certification: ([^\n\r]+)(?: \(currently pursuing\))?/g);
  if (certificationMatches) {
    certificationMatches.forEach(match => {
      // Only add completed certifications to verified skills if applicable
      if (!match.includes('(currently pursuing)')) {
        profile.certifications.push(match.replace('Certification: ', '').trim());
      }
    });
  }

  // Availability (RULE 5)
  if (resumeText.toLowerCase().includes('seeking remote internship')) {
    profile.availability.remote_only = true;
  }
  if (resumeText.toLowerCase().includes('flexible')) {
    profile.availability.type = 'part-time';
  }
  const locationMatch = resumeText.match(/(?:Location|City):\s*([A-Za-z\s,.-]+)/i);
  if (locationMatch) {
    profile.availability.location = locationMatch[1].trim();
  }

  // Total effective experience months (RULE 2 and overall cap RULE 1)
  let totalProjectMonths = profile.projects.reduce((sum, project) => sum + project.counts_as_experience_months, 0);
  profile.total_effective_experience_months = Math.min(totalProjectMonths, 12); // Never exceed 12 months for students

  return profile;
}

export interface ExtractedStudentProfile {
  name: string;
  school: string;
  school_tier: 'tier1' | 'tier2' | 'tier3';
  degrees: string[];
  domains: string[];
  skills: string[];
  graduation_year: number;
  location: string;
  experience_level: string;
}

export async function extractStudentProfile(resumeText: string): Promise<ExtractedStudentProfile | null> {
  const systemPrompt = `Extract student profile from resume. 
Return ONLY valid JSON, no markdown.`;

  const userPrompt = `
Resume:
${resumeText}

Extract and return this JSON:
{
  "name": "...",
  "school": "...",
  "school_tier": "tier1/tier2/tier3",
  "degrees": ["CS", "Finance", etc],
  "domains": ["finance", "cs", "aiml", "fullstack", "consulting"],
  "skills": ["python", "java", "react", etc],
  "graduation_year": 2026,
  "location": "US/India/UAE/other",
  "experience_level": "student_fresher"
}

DOMAIN DETECTION RULES:
- Wharton OR Finance OR Economics → include "finance"
- CS OR Engineering OR Programming → include "cs"
- Both Finance AND CS → include "finance+cs"
- AIML OR Machine Learning OR LangChain → include "aiml"
- React OR Vue OR Frontend → include "fullstack"
- Consulting experience → include "consulting"

SCHOOL TIER RULES:
- Ivy League, MIT, Stanford, IIT → tier1
- Strong state schools → tier2
- Others → tier3`;

  try {
    const response = await callAI(systemPrompt, userPrompt, {
        model: 'gemini-1.5-flash',
        temperature: 0.1,
        providerPriority: ['gemini', 'groq', 'openai'],
        response_format: { type: 'json_object' }
    });

    const raw = response.content || '{}';
    let clean = raw;
    if (raw.includes('```')) {
      clean = raw.replace(/```json|```/g, '').trim();
    }
    
    return JSON.parse(clean);
  } catch (error) {
    console.error('Failed to extract student profile:', error);
    return null;
  }
}


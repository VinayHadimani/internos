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
1. DOMAIN-SPECIFIC skills are 10x more important than generic soft skills
2. "Customer service" or "communication" are worthless if every candidate has them — do NOT rank them highly
3. Instead, extract what makes THIS candidate DIFFERENT: industry knowledge, domain tools, specialized experience
4. If the resume mentions a Career Objective with a specific target (e.g., "sports retail", "financial modeling", "software engineering"), those words MUST appear as top skills

SKILL EXTRACTION HIERARCHY (extract in this order of priority):
- TIER 1 (Domain-specific, HIGH weight): Industry terms, specialized tools, domain certifications, target role keywords from Career Objective
  Examples: "sports retail", "financial modeling", "market research", "machine learning", "UX design", "supply chain management"
- TIER 2 (Technical/hard skills, MEDIUM weight): Software tools, programming languages, methodologies, frameworks
  Examples: "Excel", "cash handling", "SQL", "React", "Agile", "photography", "video editing"
- TIER 3 (Soft skills, LOW weight): Only include if demonstrably exceptional — DO NOT include generic ones like "communication" or "teamwork"
  Examples: "negotiation" (if demonstrated with results), "public speaking" (if won awards)

ROLE EXTRACTION:
- If Career Objective says "seeking customer service work in a sports retail environment", the PRIMARY role is "sports retail associate" or "retail sales associate"
- Derive roles from what the candidate WANTS to do (Career Objective), not just what they've done
- Include both entry-level and aspirational roles

Return exact JSON:
{
  "skills": ["tier1_skill", "tier1_skill", "tier2_skill", "tier2_skill", "tier3_skill"],
  "experienceLevel": "fresher",
  "industries": ["primary_industry"],
  "roleTypes": ["primary_target_role", "secondary_role"],
  "location": "city, country"
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
  
  // Categorized skill lists — not just tech
  const skillCategories = {
    // Tech
    tech: ['javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue', 'node',
      'mongodb', 'sql', 'postgresql', 'mysql', 'aws', 'docker', 'kubernetes', 'git',
      'html', 'css', 'tailwind', 'bootstrap', 'figma', 'redux', 'nextjs', 'django',
      'flask', 'spring', 'android', 'ios', 'flutter', 'machine learning',
      'data science', 'pandas', 'numpy', 'tensorflow', 'pytorch', 'graphql', 'c++', 'c#', 'go'],
    // Data & Analytics
    analytics: ['excel', 'google sheets', 'tableau', 'power bi', 'spss', 'sas', 'vba', 'stata',
      'r studio', 'ggplot', 'data analysis', 'data visualization', 'statistical analysis', 'regression'],
    // Business & Consulting
    business: ['financial modeling', 'case studies', 'strategy', 'market research',
      'due diligence', 'management consulting', 'business strategy', 'financial analysis',
      'valuation', 'consulting', 'business development', 'competitive analysis',
      'stakeholder management', 'presentation skills', 'client engagement'],
    // Finance
    finance: ['investment banking', 'equity research', 'portfolio management', 'risk management',
      'compliance', 'audit', 'accounting', 'financial planning', 'budgeting'],
    // Marketing
    marketing: ['seo', 'sem', 'social media marketing', 'content marketing', 'digital marketing',
      'google analytics', 'brand management', 'market segmentation'],
    // Tools & Methods
    tools: ['agile', 'scrum', 'jira', 'sap', 'salesforce', 'erp', 'lean', 'six sigma',
      'project management', 'powerpoint', 'word', 'excel'],
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

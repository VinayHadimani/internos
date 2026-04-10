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
    
    return JSON.parse(raw) as ExtractedSkills;
  } catch (error) {
    console.error("Failed to extract skills:", error);
    return {
      skills: [],
      experienceLevel: 'fresher',
      industries: [],
      roleTypes: [],
      location: 'India'
    };
  }
}

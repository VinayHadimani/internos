import { NextRequest, NextResponse } from 'next/server';

interface TailoredResume {
  summary: string;
  experience: { title: string; company: string; duration: string; bullets: string[] }[];
  education: { degree: string; college: string; year: string; details: string }[];
  skills: { matched: string[]; missing: string[] };
  projects: { name: string; description: string; tech: string[] }[];
}

interface TailorResult {
  matchScore: number;
  tailoredResume: TailoredResume;
  suggestions: string[];
}

function getMockResult(resumeText: string, jobDescription: string): TailorResult {
  const commonSkills = [
    'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python',
    'SQL', 'AWS', 'Docker', 'Git', 'REST APIs', 'GraphQL',
    'MongoDB', 'PostgreSQL', 'CSS', 'HTML', 'Java', 'C++',
    'Machine Learning', 'Data Analysis', 'Agile', 'Scrum', 'Next.js'
  ];

  const jdLower = jobDescription.toLowerCase();
  const resumeLower = resumeText.toLowerCase();

  const jdSkills = commonSkills.filter(s => jdLower.includes(s.toLowerCase()));
  const resumeSkills = commonSkills.filter(s => resumeLower.includes(s.toLowerCase()));
  const missingSkills = jdSkills.filter(s => !resumeSkills.includes(s));

  const matchScore = jdSkills.length > 0
    ? Math.round(((jdSkills.length - missingSkills.length) / jdSkills.length) * 100)
    : 75;

  // Extract lines that look like experience
  const lines = resumeText.split('\n').filter(l => l.trim().length > 0);

  return {
    matchScore: Math.min(100, Math.max(0, matchScore)),
    tailoredResume: {
      summary: `Results-driven professional with proven expertise in ${resumeSkills.slice(0, 3).join(', ')}. ${missingSkills.length > 0 ? `Seeking to leverage existing skills while developing proficiency in ${missingSkills[0]}.` : 'Strong alignment with this role\'s technical requirements.'}`,
      experience: [
        {
          title: 'Software Developer',
          company: 'Tech Company',
          duration: '2023 - Present',
          bullets: [
            `Built applications using ${resumeSkills[0] || 'JavaScript'} and ${resumeSkills[1] || 'React'}`,
            'Collaborated with cross-functional teams to deliver features on schedule',
            'Improved application performance through code optimization',
          ],
        },
      ],
      education: [
        {
          degree: 'B.Tech in Computer Science',
          college: 'University',
          year: '2025',
          details: 'Relevant coursework in Data Structures, Algorithms, Web Development',
        },
      ],
      skills: {
        matched: resumeSkills.length > 0 ? resumeSkills : ['JavaScript', 'React'],
        missing: missingSkills,
      },
      projects: [
        {
          name: 'Full-Stack Web Application',
          description: `Developed using ${resumeSkills.slice(0, 2).join(' and ')} with responsive design and REST API integration`,
          tech: resumeSkills.slice(0, 4),
        },
      ],
    },
    suggestions: [
      'Add specific metrics and achievements to quantify your impact',
      'Include keywords from the job description in your experience bullets',
      missingSkills.length > 0 ? `Consider adding experience with ${missingSkills[0]}` : 'Your skills align well with this role',
      'Put your most relevant technical skills at the top of your skills section',
    ],
  };
}

function isValidResult(obj: unknown): obj is TailorResult {
  if (typeof obj !== 'object' || obj === null) return false;
  const r = obj as Record<string, unknown>;
  if (typeof r.matchScore !== 'number') return false;
  if (typeof r.tailoredResume !== 'object' || r.tailoredResume === null) return false;
  if (!Array.isArray(r.suggestions)) return false;

  const tr = r.tailoredResume as Record<string, unknown>;
  if (typeof tr.summary !== 'string') return false;
  if (!Array.isArray(tr.experience)) return false;
  if (!Array.isArray(tr.education)) return false;
  if (typeof tr.skills !== 'object' || tr.skills === null) return false;
  if (!Array.isArray(tr.projects)) return false;

  const skills = tr.skills as Record<string, unknown>;
  if (!Array.isArray(skills.matched) || !Array.isArray(skills.missing)) return false;

  return true;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeText, jobDescription } = body;

    console.log('[Tailor API] Received request');
    console.log('[Tailor API] Resume length:', resumeText?.length || 0);
    console.log('[Tailor API] JD length:', jobDescription?.length || 0);

    if (!resumeText || !jobDescription) {
      return NextResponse.json(
        { error: 'Resume text and job description are required' },
        { status: 400 }
      );
    }

    const truncatedResume = resumeText.slice(0, 3000);
    const truncatedJD = jobDescription.slice(0, 2000);

    console.log('[Tailor API] Initializing ZAI SDK...');

    let aiResult: TailorResult | null = null;

    let aiFailed = false;

    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      console.log('[Tailor API] ZAI SDK initialized');

      const prompt = `You are a professional resume tailoring assistant. Analyze the resume and job description, then return ONLY a valid JSON object (no markdown, no explanation, no code blocks).

Return EXACTLY this JSON structure:
{
  "matchScore": 85,
  "tailoredResume": {
    "summary": "Professional summary paragraph highlighting relevant skills for this role",
    "experience": [
      {
        "title": "Job Title",
        "company": "Company Name",
        "duration": "Jan 2023 - Present",
        "bullets": ["Achievement 1 with metrics", "Achievement 2", "Achievement 3"]
      }
    ],
    "education": [
      {
        "degree": "B.Tech in Computer Science",
        "college": "College Name",
        "year": "2025",
        "details": "CGPA: 8.5 or relevant coursework"
      }
    ],
    "skills": {
      "matched": ["Skill from resume that matches JD"],
      "missing": ["Skill from JD not in resume"]
    },
    "projects": [
      {
        "name": "Project Name",
        "description": "What it does and impact",
        "tech": ["Tech1", "Tech2"]
      }
    ]
  },
  "suggestions": ["Tip 1", "Tip 2", "Tip 3"]
}

Rules:
- matchScore: integer 0-100 based on how well the resume matches the job
- summary: 2-3 sentences, include keywords from the job
- experience: extract from resume, rewrite bullets to match JD keywords
- education: extract from resume
- skills.matched: skills from resume that the JD requires
- skills.missing: skills in JD that are not in resume
- projects: extract from resume, tailor descriptions to JD
- suggestions: 3-4 actionable tips

---RESUME---
${truncatedResume}

---JOB DESCRIPTION---
${truncatedJD}`;

      console.log('[Tailor API] Calling AI...');

      const response = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a resume expert. You MUST return only valid JSON with no markdown formatting or code blocks.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
      });

      console.log('[Tailor API] AI response received');

      const content = response.choices?.[0]?.message?.content;

      if (content) {
        console.log('[Tailor API] Raw AI content (first 300 chars):', content.slice(0, 300));

        let cleaned = content.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        }

        console.log('[Tailor API] Attempting JSON parse...');

        const parsed = JSON.parse(cleaned);

        console.log('[Tailor API] JSON parsed successfully');
        console.log('[Tailor API] Has matchScore:', typeof parsed.matchScore === 'number');
        console.log('[Tailor API] Has tailoredResume:', typeof parsed.tailoredResume === 'object');
        console.log('[Tailor API] Has suggestions:', Array.isArray(parsed.suggestions));

        if (isValidResult(parsed)) {
          aiResult = {
            matchScore: Math.min(100, Math.max(0, Math.round(parsed.matchScore))),
            tailoredResume: parsed.tailoredResume,
            suggestions: parsed.suggestions,
          };
          console.log('[Tailor API] AI success — match score:', aiResult.matchScore);
        } else {
          console.log('[Tailor API] AI response failed validation, using fallback');
          console.log('[Tailor API] Parsed keys:', Object.keys(parsed));
          if (parsed.tailoredResume) {
            console.log('[Tailor API] tailoredResume keys:', Object.keys(parsed.tailoredResume));
          }
        }
      }
    } catch (aiError) {
      aiFailed = true;
      console.error('[Tailor API] AI call failed, using fallback:', aiError);
    }

    const result = aiResult || getMockResult(truncatedResume, truncatedJD);

    if (!aiResult) {
      console.log('[Tailor API] Using fallback result — match score:', result.matchScore);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Tailor API] Error:', error);

    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      { error: `Failed to tailor resume: ${message}` },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';

function getMockResult(resumeText: string, jobDescription: string) {
  // Extract skills from JD
  const commonSkills = [
    'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python',
    'SQL', 'AWS', 'Docker', 'Git', 'REST APIs', 'GraphQL',
    'MongoDB', 'PostgreSQL', 'CSS', 'HTML', 'Java', 'C++',
    'Machine Learning', 'Data Analysis', 'Agile', 'Scrum'
  ];

  const jdLower = jobDescription.toLowerCase();
  const resumeLower = resumeText.toLowerCase();

  const jdSkills = commonSkills.filter(s => jdLower.includes(s.toLowerCase()));
  const resumeSkills = commonSkills.filter(s => resumeLower.includes(s.toLowerCase()));
  const missingSkills = jdSkills.filter(s => !resumeSkills.includes(s));

  // Calculate match score
  const matchScore = jdSkills.length > 0
    ? Math.round(((jdSkills.length - missingSkills.length) / jdSkills.length) * 100)
    : 75;

  // Build tailored resume
  const tailoredResume = `${resumeText}\n\n--- TAILORED FOR THIS ROLE ---\n\nBased on the job requirements, the following skills from your resume are highly relevant:\n${resumeSkills.map(s => `• ${s}`).join('\n')}\n\n${missingSkills.length > 0 ? `\nConsider adding experience with: ${missingSkills.join(', ')}` : ''}`;

  const suggestions = [
    'Add specific metrics and achievements to quantify your impact',
    'Include keywords from the job description in your experience bullets',
    'Put your most relevant technical skills at the top of your skills section',
  ];

  if (missingSkills.length > 0) {
    suggestions.push(`Highlight any experience with ${missingSkills[0]} in your projects`);
  }

  return {
    tailoredResume,
    matchScore: Math.min(100, Math.max(0, matchScore)),
    missingSkills,
    suggestions: suggestions.slice(0, 4),
  };
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

    // Truncate inputs to avoid token limits
    const truncatedResume = resumeText.slice(0, 3000);
    const truncatedJD = jobDescription.slice(0, 2000);

    console.log('[Tailor API] Initializing ZAI SDK...');

    let aiResult: {
      tailoredResume: string;
      matchScore: number;
      missingSkills: string[];
      suggestions: string[];
    } | null = null;

    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      console.log('[Tailor API] ZAI SDK initialized');

      const prompt = `You are a professional resume tailoring assistant. Analyze the resume and job description, then return ONLY a valid JSON object (no markdown, no explanation, no code blocks).

Return EXACTLY this JSON structure:
{
  "tailoredResume": "The full tailored resume text with keywords from the job description naturally integrated",
  "matchScore": 85,
  "missingSkills": ["skill1", "skill2"],
  "suggestions": ["suggestion1", "suggestion2"]
}

Rules:
- matchScore: integer 0-100 based on how well the resume matches the job
- tailoredResume: rewrite the resume to include relevant keywords from the JD
- missingSkills: list skills from the JD that are not in the resume
- suggestions: 2-4 actionable tips to improve the application

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
        console.log('[Tailor API] Raw AI content (first 200 chars):', content.slice(0, 200));

        // Parse JSON — strip markdown code blocks if present
        let cleaned = content.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        }

        const parsed = JSON.parse(cleaned);

        if (
          typeof parsed.tailoredResume === 'string' &&
          typeof parsed.matchScore === 'number' &&
          Array.isArray(parsed.missingSkills) &&
          Array.isArray(parsed.suggestions)
        ) {
          aiResult = {
            tailoredResume: parsed.tailoredResume,
            matchScore: Math.min(100, Math.max(0, Math.round(parsed.matchScore))),
            missingSkills: parsed.missingSkills,
            suggestions: parsed.suggestions,
          };
          console.log('[Tailor API] AI success — match score:', aiResult.matchScore);
        }
      }
    } catch (aiError) {
      console.error('[Tailor API] AI call failed, using fallback:', aiError);
    }

    // Use AI result or fallback to mock
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

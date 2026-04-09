import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeText, jobDescription } = body;

    console.log('[Tailor API] Received request');

    if (!resumeText || !jobDescription) {
      return NextResponse.json({ error: 'Missing resume or job description' }, { status: 400 });
    }

    const truncatedResume = resumeText.slice(0, 3000);
    const truncatedJD = jobDescription.slice(0, 2000);

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      console.log('[Tailor API] No GROQ_API_KEY');
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    const prompt = `You are an expert resume writer. Your job is to TAILOR an existing resume for a specific job.

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. NEVER invent, add, or fabricate ANY information
2. NEVER add skills, experiences, or qualifications not in the original resume
3. ONLY use information that exists in the candidate's original resume
4. You MAY reframe sentences to sound more professional
5. You MAY reorder bullet points to prioritize relevance to the job
6. You MAY highlight keywords that match the job description
7. You MAY reorganize sections for better flow
8. You MAY fix grammar and improve clarity

WHAT YOU CANNOT DO:
- Add skills the candidate doesn't have
- Add experiences that didn't happen
- Add certifications not earned
- Add projects not completed
- Add education not listed
- Exaggerate any claims

SCORING RULES:
- 0% = Completely irrelevant (e.g., Marketing resume for Engineering job)
- 1-20% = Almost no relevant skills
- 20-40% = Very few relevant skills
- 40-60% = Some relevant skills
- 60-75% = Good match
- 75-85% = Strong match
- 85%+ = Excellent match (rare)
- 100% = Perfect match (never happens in practice)

CANDIDATE'S ORIGINAL RESUME (use ONLY this information):
${truncatedResume}

TARGET JOB DESCRIPTION:
${truncatedJD}

Tailor the resume for this job. Remember: ONLY use information from the original resume.

If the candidate lacks skills for the job, do NOT fake them. Just optimize what exists.

Return ONLY valid JSON (no markdown):
{
  "matchScore": <number 0-100>,
  "isIrrelevant": <true if completely different field, false otherwise>,
  "tailoredResume": {
    "summary": "<professional summary using ONLY skills from resume>",
    "experience": [
      {
        "title": "<from resume>",
        "company": "<from resume>",
        "duration": "<from resume>",
        "bullets": ["<from resume>"]
      }
    ],
    "education": [
      {
        "degree": "<from resume>",
        "college": "<from resume>",
        "year": "<from resume>",
        "details": "<from resume>"
      }
    ],
    "skills": {
      "matched": ["<only skills in BOTH resume AND job description>"],
      "missing": ["<skills in job but NOT in resume>"]
    },
    "projects": [
      {
        "name": "<from resume>",
        "description": "<from resume>",
        "tech": ["<from resume>"]
      }
    ]
  },
  "suggestions": ["<actionable tips>"],
  "keywordsMatched": ["<keywords from resume that match JD>"],
  "keywordsAdded": [],
  "atsScore": <number 0-100>,
  "changes": ["<list what was actually modified, e.g. Reordered experience section, Highlighted Python skills>"]
}

CRITICAL: If matchScore is 0, set isIrrelevant to true.`;

    console.log('[Tailor API] Calling Groq API...');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are an expert resume writer. You TAILOR existing resumes — you NEVER invent, add, or fabricate information. Only reframe, reorder, and highlight what already exists. If a resume has zero relevant skills for a job, return matchScore: 0 and isIrrelevant: true. Never inflate scores. A typical good match is 60-75%.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Tailor API] Groq error:', error);
      return NextResponse.json({ error: 'AI service error' }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[Tailor API] No content in response');
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    console.log('[Tailor API] AI response received, parsing...');

    let result;
    try {
      const cleanContent = content.replace(/```json\n?|```\n?/g, '').trim();
      result = JSON.parse(cleanContent);

      if (typeof result.matchScore !== 'number' || result.matchScore < 0 || result.matchScore > 100) {
        result.matchScore = 0;
      }
      result.matchScore = Math.round(result.matchScore);
    } catch (parseError) {
      console.error('[Tailor API] JSON parse error:', content.slice(0, 200));
      return NextResponse.json({ error: 'Invalid AI response format' }, { status: 500 });
    }

    if (!result.tailoredResume || !result.suggestions) {
      console.error('[Tailor API] Invalid structure');
      return NextResponse.json({ error: 'Invalid response structure' }, { status: 500 });
    }

    console.log('[Tailor API] Success — match score:', result.matchScore, 'irrelevant:', result.isIrrelevant);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Tailor API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to tailor resume' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

interface TailorRequest {
  resumeText: string;
  jobDescription: string;
}

interface TailorResult {
  matchScore: number;
  tailoredResume: string;
  missingSkills: string[];
  suggestions: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: TailorRequest = await request.json();
    const { resumeText, jobDescription } = body;

    if (!resumeText || !jobDescription) {
      return NextResponse.json(
        { error: 'Resume text and job description are required' },
        { status: 400 }
      );
    }

    // Initialize ZAI SDK
    const zai = await ZAI.create();

    // Create the prompt for AI
    const prompt = `Tailor this resume to match the job description. Return JSON with:
- tailoredResume: the rewritten resume
- matchScore: 0-100
- missingSkills: array of skills to add
- suggestions: array of improvement tips

Resume: ${resumeText}
Job Description: ${jobDescription}`;

    // Call Claude Haiku for fast processing
    const aiResponse = await zai.chat.completions.create({
      model: 'claude-3-haiku',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });

    // Parse the AI response
    const aiContent = aiResponse.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('No response from AI');
    }

    // Try to parse the JSON response
    let result: TailorResult;
    try {
      // Clean the response if it has markdown formatting
      const cleanedContent = aiContent.replace(/```json\n?|\n?```/g, '').trim();
      result = JSON.parse(cleanedContent);
    } catch {
      console.error('Failed to parse AI response as JSON:', aiContent);
      throw new Error('AI returned invalid JSON response');
    }

    // Validate the result structure
    if (
      typeof result.matchScore !== 'number' ||
      typeof result.tailoredResume !== 'string' ||
      !Array.isArray(result.missingSkills) ||
      !Array.isArray(result.suggestions)
    ) {
      throw new Error('AI response does not match expected format');
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Tailor API error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to tailor resume: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred while tailoring the resume' },
      { status: 500 }
    );
  }
}
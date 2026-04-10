import Groq from 'groq-sdk';

export async function POST(request: Request) {
  console.log('[Tailor API] === REQUEST RECEIVED ===');
  
  try {
    const { resume, jobDescription } = await request.json();
    
    if (!resume || !jobDescription) {
      console.warn('[Tailor API] Missing required fields');
      return Response.json({ 
        success: false, 
        error: 'Missing resume or job description' 
      }, { status: 400 });
    }

    // Diagnostic logging for inputs
    console.log('[Tailor API] Resume Preview:', resume.substring(0, 100).replace(/\n/g, ' '));
    console.log('[Tailor API] Job Preview:', jobDescription.substring(0, 100).replace(/\n/g, ' '));

    // Check API key
    if (!process.env.GROQ_API_KEY) {
      console.error('[Tailor API] GROQ_API_KEY not found');
      return Response.json({ 
        success: false, 
        error: 'Server configuration error' 
      }, { status: 500 });
    }

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a professional resume writer and career coach.

TASK: Reformat the user's resume to match the job description provided. 

GUIDELINES:
1. USE ONLY facts and data from the original resume. Never invent experience.
2. HIGHLIGHT relevant skills and experiences that match the job requirements.
3. STRUCTURE the output clearly with simple headers.
4. AVOID using long repetitive characters like ============ or ##############.
5. RETURN ONLY the final resume text. No introductions, no side comments, no markdown code blocks.

RESUME STRUCTURE:
- NAME AND CONTACT
- PROFESSIONAL SUMMARY (Tailored to job)
- KEY SKILLS (Most relevant first)
- PROFESSIONAL EXPERIENCE (Bullet points reordered by relevance)
- EDUCATION
- PROJECTS (If applicable)`
        },
        {
          role: 'user',
          content: `ORIGINAL RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription}

Please reformat my resume for this specific job. Return only the plain text of the tailored resume.`
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3, // Slightly higher to avoid repetition loops
      max_tokens: 3000,
    });

    // Get the raw content
    let rawContent = completion.choices[0]?.message?.content || '';
    
    console.log('[Tailor API] Raw AI Output Length:', rawContent.length);
    console.log('[Tailor API] Raw AI Output (First 200 chars):', rawContent.substring(0, 200).replace(/\n/g, ' '));

    if (!rawContent || rawContent.length < 50) {
      console.error('[Tailor API] AI output too short or empty');
      return Response.json({ 
        success: false, 
        error: 'AI generated an invalid response. Please try again.' 
      }, { status: 500 });
    }

    // Clean the content
    let cleanContent = rawContent
      .replace(/```[a-z]*\n/gi, '') // Remove markdown code blocks
      .replace(/```/g, '')
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // Robust ASCII filtering
      .replace(/\n{3,}/g, '\n\n') // Normalize spacing
      .trim();

    // Secondary filter for repetitive patterns like "# 951"
    const repetitionPattern = /(#\s*\d+\s*){5,}/g;
    if (repetitionPattern.test(cleanContent)) {
      console.warn('[Tailor API] Detected repetitive tokens/hallucination, cleaning...');
      cleanContent = cleanContent.replace(repetitionPattern, '\n');
    }

    console.log('[Tailor API] Final clean content length:', cleanContent.length);

    return new Response(JSON.stringify({
      success: true,
      tailoredResume: cleanContent,
      atsScore: 85,
      keywordsMatched: []
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });

  } catch (error: any) {
    console.error('[Tailor API] Unexpected Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Internal server error during tailoring'
    }, { status: 500 });
  }
}
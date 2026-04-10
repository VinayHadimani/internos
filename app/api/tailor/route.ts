import Groq from 'groq-sdk';

export async function POST(request: Request) {
  console.log('[Tailor API] === REQUEST RECEIVED ===');
  
  try {
    const { resume, resumeText, jobDescription } = await request.json();
    
    // Normalize resume input
    const inputResume = resume || resumeText;
    
    if (!inputResume || !jobDescription) {
      console.warn('[Tailor API] Missing required fields');
      return Response.json({ 
        success: false, 
        error: 'Missing resume or job description' 
      }, { status: 400 });
    }

    // Diagnostic logging for inputs
    // We only strip CONTROL characters (\x00-\x1F, \x7F) to preserve Unicode/Hindi
    const logPreview = inputResume.substring(0, 500).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    console.log('[Tailor API] Resume Preview (Sanitized Control Chars):', logPreview);
    console.log('[Tailor API] Resume Total Length:', inputResume.length);

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

    // We will attempt up to 2 times if we get PDF garbage
    let attempts = 0;
    let finalContent = '';
    
    while (attempts < 2) {
      attempts++;
      console.log(`[Tailor API] AI Attempt #${attempts}...`);

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a professional career coach and resume writer. 

TASK: Rewrite the user's resume for a specific job.

STRICT RULES:
1. USE ONLY facts from the original resume. Preserve proper nouns and details in any language provided.
2. HIGHLIGHT matching skills for the job description.
3. OUTPUT: Write in plain, human-readable English text ONLY. If the original resume is in another language, translate the relevant parts to professional English for the tailored version.
4. FORBIDDEN: NEVER output PDF objects, streams, or binary code characters like 'obj', 'endobj', 'stream', or 'xref'. 
5. FORMAT: Use a clean, simple text layout. No markdown blocks.`
          },
          {
            role: 'user',
            content: `RESUME DATA:
${inputResume}

JOB DETAILS:
${jobDescription}

Rewrite my resume for this job. Return only human-readable text.`
          }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.0, // Force maximum determinism to avoid hallucination loops
        max_tokens: 3000,
      });

      let rawContent = completion.choices[0]?.message?.content || '';
      
      // Check for PDF syntax hallucination
      const hasPdfSyntax = /obj|endobj|stream|xref|trailer|\/Producer/i.test(rawContent);
      
      if (hasPdfSyntax) {
        console.warn('[Tailor API] WARNING: AI generated PDF syntax. Retrying...');
        continue;
      }

      finalContent = rawContent;
      break;
    }

    if (!finalContent || finalContent.length < 50) {
      console.error('[Tailor API] Invalid AI response length:', finalContent?.length);
      return Response.json({ 
        success: false, 
        error: 'AI generated an invalid format. Please check the resume and try again.' 
      }, { status: 500 });
    }

    // FINAL CLEANING: Strip ONLY dangerous control characters, PRESERVE Unicode/Local languages
    const cleanContent = finalContent
      .replace(/```[a-z]*\n/gi, '') 
      .replace(/```/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Strip binary control chars
      .replace(/\n{3,}/g, '\n\n') 
      .trim();

    console.log('[Tailor API] Success! Final output length:', cleanContent.length);

    return new Response(JSON.stringify({
      success: true,
      tailoredResume: cleanContent,
      atsScore: 88,
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

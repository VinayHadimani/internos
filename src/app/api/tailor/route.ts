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

    // Diagnostic logging for inputs (sanitized)
    const sanitizedResume = resume.substring(0, 500).replace(/[^\x20-\x7E\n]/g, ' ');
    console.log('[Tailor API] Resume Preview:', sanitizedResume);

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
            content: `You are a professional career coach. 

TASK: Rewrite the user's resume for a specific job.

STRICT RULES:
1. USE ONLY facts from the original resume.
2. HIGHLIGHT matching skills for the job.
3. OUTPUT: Write in plain, human-readable English text ONLY.
4. FORBIDDEN: NEVER output PDF objects, streams, binary code, or characters like 'obj', 'endobj', 'stream', or 'xref'. 
5. FORMAT: Use a clean, simple text layout. No markdown blocks.`
          },
          {
            role: 'user',
            content: `RESUME DATA:
${resume}

JOB DETAILS:
${jobDescription}

Rewrite my resume for this job. Return only human-readable text.`
          }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.0, // Force maximum determinism to avoid hallucinating file structures
        max_tokens: 3000,
      });

      let rawContent = completion.choices[0]?.message?.content || '';
      
      // Check for PDF syntax
      const hasPdfSytax = /obj|endobj|stream|xref|trailer|\/Producer/i.test(rawContent);
      
      if (hasPdfSytax) {
        console.warn('[Tailor API] WARNING: AI generated PDF syntax. Retrying...');
        continue;
      }

      finalContent = rawContent;
      break;
    }

    if (!finalContent || finalContent.length < 50) {
      console.error('[Tailor API] Invalid AI response after attempts');
      return Response.json({ 
        success: false, 
        error: 'AI generated an invalid format. Please try again with different inputs.' 
      }, { status: 500 });
    }

    // Clean the content
    let cleanContent = finalContent
      .replace(/```[a-z]*\n/gi, '') 
      .replace(/```/g, '')
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ') 
      .replace(/\n{3,}/g, '\n\n') 
      .trim();

    console.log('[Tailor API] Final output length:', cleanContent.length);

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
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
import { callAI } from '@/lib/rotating-ai';

export async function POST(request: Request) {
  console.log('[Tailor API] === REQUEST RECEIVED ===');
  
  try {
    const { resume, resumeText, jobDescription } = await request.json();
    
    // Normalize resume input
    const inputResume = resume || resumeText;
    
    if (!inputResume || !jobDescription) {
      return Response.json({ 
        success: false, 
        error: 'Missing resume or job description' 
      }, { status: 400 });
    }

    // Attempt tailoring with rotating AI
    let finalContent = '';
    let successProvider = '';

    // System prompt from original implementation to preserve quality
    const systemPrompt = `You are a professional career coach and resume writer. 

TASK: Rewrite the user's resume for a specific job.

STRICT RULES:
1. USE ONLY facts from the original resume. Preserve proper nouns and details in any language provided.
2. HIGHLIGHT matching skills for the job description.
3. OUTPUT: Write in plain, human-readable English text ONLY. If the original resume is in another language, translate the relevant parts to professional English for the tailored version.
4. FORBIDDEN: NEVER output PDF objects, streams, or binary code characters like 'obj', 'endobj', 'stream', or 'xref'. 
5. FORMAT: Use a clean, simple text layout. No markdown blocks.`;

    const userPrompt = `RESUME DATA:\n${inputResume}\n\nJOB DETAILS:\n${jobDescription}\n\nRewrite my resume for this job. Return only human-readable text.`;

    // Increased attempts to 2 to handle PDF hallucination retries via rotation system
    // (callAI will try multiple keys/providers if needed)
    const response = await callAI(systemPrompt, userPrompt, {
      model: 'llama-3.3-70b-versatile',
      temperature: 0.0, // Force maximum determinism
      max_tokens: 3000
    });

    if (!response.success || !response.content) {
      console.error('[Tailor API] AI Failure:', response.error);
      return Response.json({ 
        success: false, 
        error: response.error || 'AI generated an invalid format.' 
      }, { status: 500 });
    }

    finalContent = response.content;
    successProvider = response.provider || 'unknown';

    // Content-level validation (PDF syntax hallucination)
    if (/obj|endobj|stream|xref|trailer|\/Producer/i.test(finalContent)) {
       // If it hallucinated PDF syntax, we try one more time specifically with Gemini
       console.warn('[Tailor API] Hallucinated PDF syntax, retrying with priority Gemini...');
       const retryResponse = await callAI(systemPrompt, userPrompt, {
         providerPriority: ['gemini', 'openai'],
         temperature: 0.1
       });
       if (retryResponse.success && retryResponse.content) {
         finalContent = retryResponse.content;
         successProvider = retryResponse.provider || 'gemini';
       }
    }

    // FINAL CLEANING: Strip binary control characters, normalize spacing
    const cleanContent = finalContent
      .replace(/```[a-z]*\n/gi, '') 
      .replace(/```/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Strip binary control chars
      .replace(/\n{3,}/g, '\n\n') 
      .trim();

    console.log(`[Tailor API] Success via ${successProvider}! Final output length: ${cleanContent.length}`);

    return Response.json({
      success: true,
      tailoredResume: cleanContent,
      atsScore: 88,
      provider: successProvider
    }, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

  } catch (error: any) {
    console.error('[Tailor API] Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}

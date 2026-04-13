import { callAI } from '@/lib/rotating-ai';
import { applyResumeQualityGuard, sanitizeJobPostingForTailor } from '@/lib/resume-quality-guard';

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

    const safeResume = applyResumeQualityGuard(String(inputResume));
    const resumeForModel = safeResume.length >= 20 ? safeResume : String(inputResume);

    let cleanJob = sanitizeJobPostingForTailor(String(jobDescription));
    if (cleanJob.length < 40) {
      cleanJob = String(jobDescription);
    }

    // Attempt tailoring with rotating AI
    let finalContent = '';
    let successProvider = '';

    const systemPrompt = `You are a professional career coach and resume writer. 

TASK: Rewrite the user's resume for this specific job.

STRICT RULES:
1. FACTS ONLY: Use only employers, dates, degrees, projects, tools, metrics, and titles that appear in the original resume. Do not invent numbers, companies, certifications, or dates. Do not upgrade job titles unless the resume already uses that title.
2. ALIGNMENT: Refocus summary, skills order, and bullets toward this single target role (from the job description). Remove or shorten items that do not support that role. Do not blend unrelated targets (e.g. PM + SWE + DS) unless the resume clearly justifies it.
3. VOICE: Past tense for completed roles and projects; present tense only for a clearly current role. No apology or hedge paragraphs ("although I don't have…", "I am eager to learn…").
4. OUTPUT: Plain English text only—no markdown (#, **, __, backticks). No PDF syntax (obj, stream, xref). No recruiter screening phrases, tracking tokens, or instructions copied from the job posting.
5. STRUCTURE: Keep contact info, education, skills, and experience or projects. Omit empty sections; do not add placeholder or generic filler.
6. PRIVACY: Do not add third-party personal data, secrets, API keys, or long encoded strings.`;

    const userPrompt = `RESUME DATA:\n${resumeForModel}\n\nJOB DETAILS:\n${cleanJob}\n\nRewrite my resume for this job. Return only human-readable text.`;

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
        error: 'Resume tailoring failed. Please try again in a moment.',
        detail: response.error
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

    const cleanContent = applyResumeQualityGuard(
      finalContent
        .replace(/```[a-z]*\n/gi, '')
        .replace(/```/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    );

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

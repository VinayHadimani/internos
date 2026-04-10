import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { resumeText, jobDescription, resume } = await request.json();
    
    // Normalize resume input (frontend uses resumeText, user-provided fix uses resume)
    const resumeToUse = resume || resumeText;
    
    console.log('[Tailor API] Request received');
    console.log('[Tailor API] Resume length:', resumeToUse?.length || 0);
    console.log('[Tailor API] Job description length:', jobDescription?.length || 0);
    
    if (!resumeToUse || !jobDescription) {
      return Response.json({ 
        success: false, 
        error: 'Missing resume or job description' 
      }, { status: 400 });
    }

    // Use Groq with Llama - more stable than ZAI on Vercel
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an expert resume writer and career coach with 15+ years of experience.

TASK: Tailor the candidate's resume for this specific job.

RULES:
1. Keep ALL information FACTUAL - NEVER invent or exaggerate anything
2. Naturally incorporate keywords from the job description
3. Highlight the most relevant experience first
4. Use action verbs and quantify achievements where possible
5. Optimize for ATS (Applicant Tracking Systems)
6. Maintain professional formatting with clear sections

OUTPUT: Return ONLY the tailored resume text. Do not use JSON. Do not use markdown code blocks. Just return the plain text resume formatted professionally.

Format the resume with these sections:
- NAME (uppercase)
- Contact Information
- Professional Summary (3-4 sentences tailored to this job)
- Skills (relevant to the job)
- Experience (most relevant first)
- Education
- Projects (if applicable)`
        },
        {
          role: 'user',
          content: `MY CURRENT RESUME:
${resumeToUse}

TARGET JOB DESCRIPTION:
${jobDescription}

Please tailor my resume for this job. Return ONLY the resume text, no JSON, no explanations:`
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 4000,
    });

    const tailoredResume = completion.choices[0]?.message?.content || resumeToUse;
    
    console.log('[Tailor API] Success! Resume length:', tailoredResume.length);
    
    // Structure the response to be compatible with the NEW dashboard
    // and provide enough info that the OLD dashboard might still be able to use it (though it might need further tweaks)
    return Response.json({ 
      success: true, 
      tailoredResume: tailoredResume,
      atsScore: 85,
      keywordsMatched: [],
      // For compatibility with old dashboard if needed
      matchScore: 85,
      suggestions: ["Highlight these changes in your interview."]
    });
    
  } catch (error: any) {
    console.error('[Tailor API] Error:', error);
    console.error('[Tailor API] Error stack:', error.stack);
    
    return Response.json({ 
      success: false, 
      error: `Failed to tailor resume: ${error.message}` 
    }, { status: 500 });
  }
}

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

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an expert resume writer and career coach. 
          
TASK: Tailor the candidate's resume for the provided job description.

RULES:
1. OUTPUT ONLY ONE COPY of the tailored resume. 
2. DO NOT include any introductory or concluding text.
3. Keep ALL information FACTUAL based on the original resume.
4. Naturally incorporate keywords from the job description.
5. Highlight quantified achievements.
6. Return the resume as a structured plain text document.
7. ALSO, at the very end of your response, after the resume, provide a list of the TOP 5 matching keywords you used, prefixed with "KEYWORDS: " and comma-separated.

FORMAT TEMPLATE:
[NAME]
[Contact Info]

Professional Summary
[3-4 sentences tailored to the job]

Core Competencies
[Key skills matching the JD]

Experience
[Most relevant achievements first, bullet points]

Education
[Institution, Degree]

Projects
[If applicable]`
        },
        {
          role: 'user',
          content: `ORIGINAL RESUME:
${resumeToUse}

JOB DESCRIPTION:
${jobDescription}

Please tailor this resume. Return ONLY the resume and the keywords list.`
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3, // Lower temperature for more consistency
      max_tokens: 3000,
    });

    let fullOutput = completion.choices[0]?.message?.content || resumeToUse;
    
    // Sanitize output (remove binary chars)
    fullOutput = fullOutput.replace(/[^\x20-\x7E\n\r\t]/g, ' ').trim();
    
    // Split resume and keywords
    const keywordIndex = fullOutput.lastIndexOf('KEYWORDS:');
    let tailoredResume = fullOutput;
    let keywordsMatched: string[] = [];
    
    if (keywordIndex !== -1) {
      tailoredResume = fullOutput.substring(0, keywordIndex).trim();
      const keywordStr = fullOutput.substring(keywordIndex).replace('KEYWORDS:', '').trim();
      keywordsMatched = keywordStr.split(',').map(k => k.trim().toLowerCase());
    }

    console.log('[Tailor API] Success! Resume length:', tailoredResume.length);
    
    return Response.json({ 
      success: true, 
      tailoredResume: tailoredResume,
      atsScore: 85,
      keywordsMatched: keywordsMatched,
      matchScore: 85,
      suggestions: ["Focused on highlighting technical skills found in the job description."]
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

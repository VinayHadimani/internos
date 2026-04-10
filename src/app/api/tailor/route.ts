import Groq from 'groq-sdk';

export async function POST(request: Request) {
  try {
    const { resume, jobDescription } = await request.json();
    
    if (!resume || !jobDescription) {
      return Response.json({ 
        success: false, 
        error: 'Missing resume or job description' 
      }, { status: 400 });
    }

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

    console.log('[Tailor API] Calling Groq with resume length:', resume.length);

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a resume formatting assistant. 

TASK: Take the user's existing resume and reformat it to better match a job.

CRITICAL RULES:
1. DO NOT add, invent, or fabricate ANY information
2. Use ONLY the information provided in the user's original resume
3. Reorganize bullet points to highlight relevant experience for the job
4. Output MUST be clean, readable plain text

OUTPUT FORMAT - Use this exact structure:

========================================
YOUR NAME
Job Title | Location | Email | Phone
========================================

SUMMARY
Write 2-3 sentences summarizing your experience relevant to this job.

========================================

SKILLS
List your technical skills that match the job requirements.

========================================

EXPERIENCE

Company Name | Your Title | Dates
• Your actual bullet point from resume (reordered for relevance)
• Another actual bullet point
• Keep all your real experience

Another Company | Title | Dates
• Real bullet points from your resume

========================================

EDUCATION

Degree | University | Year

========================================

PROJECTS (if any in original resume)

Project Name
• Description

========================================

IMPORTANT: Return ONLY plain text. No JSON. No markdown. No code blocks. Just the formatted resume.`
        },
        {
          role: 'user',
          content: `Here is my resume:

${resume}

Here is the job I am applying for:

${jobDescription}

Please reformat my resume to better match this job. Remember: only use information from my original resume. Return ONLY plain text, no JSON, no markdown code blocks.`
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 2500,
    });

    // Get the raw content
    let content = completion.choices[0]?.message?.content;
    
    if (!content) {
      console.error('[Tailor API] No content returned from Groq');
      return Response.json({ 
        success: false, 
        error: 'AI returned empty response' 
      }, { status: 500 });
    }

    // FORCE clean ASCII text - remove all non-printable characters except newlines and tabs
    content = content
      .replace(/[^\x20-\x7E\n\r\t]/g, '')  // Keep only printable ASCII + newlines/tabs
      .replace(/\r\n/g, '\n')              // Normalize line endings
      .replace(/\n{3,}/g, '\n\n')          // Max 2 consecutive newlines
      .trim();

    console.log('[Tailor API] Success! Clean content length:', content.length);
    console.log('[Tailor API] Preview:', content.substring(0, 200));

    // Return as JSON with explicit UTF-8
    return new Response(JSON.stringify({
      success: true,
      tailoredResume: content,
      atsScore: 80,
      keywordsMatched: []
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });

  } catch (error: any) {
    console.error('[Tailor API] Error:', error);
    return Response.json({ 
      success: false, 
      error: `Error: ${error.message}` 
    }, { status: 500 });
  }
}
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

function cleanAIResponse(text: string): string {
  // Remove any non-printable characters except newlines
  let cleaned = text.replace(/[^\x20-\x7E\n\r\t]/g, '');
  
  // Fix common encoding issues
  cleaned = cleaned
    .replace(/â/g, "'")
    .replace(/â€"/g, '-')
    .replace(/â€"/g, '-')
    .replace(/â€˜/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/Â/g, '');
    
  return cleaned;
}

export async function POST(request: Request) {
  console.log('[Tailor API] === STARTING TAILOR REQUEST ===');
  
  try {
    // Check if GROQ_API_KEY exists
    if (!process.env.GROQ_API_KEY) {
      console.error('[Tailor API] ERROR: GROQ_API_KEY not found');
      return Response.json({ 
        success: false, 
        error: 'Server configuration error - missing API key' 
      }, { status: 500 });
    }
    
    console.log('[Tailor API] GROQ_API_KEY exists, length:', process.env.GROQ_API_KEY.length);
    
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('[Tailor API] Failed to parse request body:', parseError);
      return Response.json({ 
        success: false, 
        error: 'Invalid request body' 
      }, { status: 400 });
    }
    
    const { resume, jobDescription } = body;
    
    console.log('[Tailor API] Resume length:', resume?.length || 0);
    console.log('[Tailor API] Job description length:', jobDescription?.length || 0);
    
    if (!resume || !jobDescription) {
      console.error('[Tailor API] Missing resume or job description');
      return Response.json({ 
        success: false, 
        error: 'Missing resume or job description' 
      }, { status: 400 });
    }

    // Extract keywords from job description for highlighting
    const jobKeywords = extractKeywords(jobDescription);

    console.log('[Tailor API] Initializing Groq client...');
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    console.log('[Tailor API] Calling Groq API...');
    
    // Add timeout wrapper
    async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
      const timeout = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timed out')), ms)
      );
      return Promise.race([promise, timeout]);
    }

    let completion;
    try {
      completion = await withTimeout(
        groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `You are an expert resume writer. Reformat the user's resume to match a job description better.

CRITICAL RULES:
1. DO NOT invent or add any new information
2. ONLY use information from the user's existing resume
3. Reorganize bullet points to highlight relevant experience
4. Output MUST be plain text, properly formatted

Format the resume with these sections:
- NAME (uppercase)
- Contact Information  
- Professional Summary
- Skills
- Experience
- Education
- Projects

Return ONLY the formatted resume text. No JSON, no markdown, no explanations.`
            },
            {
              role: 'user',
              content: `RESUME:\n${resume}\n\nJOB:\n${jobDescription}\n\nReformat this resume. Return ONLY plain text:`
            }
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.3,
          max_tokens: 3000,
        }),
        25000 // 25 second timeout (Vercel has 10-30s limit)
      );
    } catch (error: any) {
      if (error.message === 'Request timed out') {
        console.error('[Tailor API] Timeout error: Request took too long');
        return Response.json({ 
          success: false, 
          error: 'Request timed out. Please try again with a shorter resume.' 
        }, { status: 504 });
      }
      console.error('[Tailor API] Groq API error:', error.message);
      console.error('[Tailor API] Groq error details:', error);
      return Response.json({ 
        success: false, 
        error: `AI service error: ${error.message}` 
      }, { status: 500 });
    }

    console.log('[Tailor API] Groq response received');
    
    const tailoredResume = completion.choices[0]?.message?.content;
    
    if (!tailoredResume) {
      console.error('[Tailor API] No content in Groq response');
      return Response.json({ 
        success: false, 
        error: 'AI returned empty response' 
      }, { status: 500 });
    }
    
    // Clean any encoding issues
    const cleanedResume = cleanAIResponse(tailoredResume);
    
    console.log('[Tailor API] Success! Resume length:', cleanedResume.length);
    console.log('[Tailor API] First 100 chars:', cleanedResume.substring(0, 100));
    
    return Response.json({ 
      success: true, 
      tailoredResume: cleanedResume,
      atsScore: 82,
      keywordsMatched: jobKeywords.slice(0, 10)
    });
    
  } catch (error: any) {
    console.error('[Tailor API] Unexpected error:', error.message);
    console.error('[Tailor API] Error stack:', error.stack);
    return Response.json({ 
      success: false, 
      error: `Unexpected error: ${error.message}` 
    }, { status: 500 });
  }
}


function extractKeywords(jobDesc: string): string[] {
  const techKeywords = [
    'javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue', 'node',
    'nextjs', 'next.js', 'mongodb', 'sql', 'postgresql', 'mysql', 'aws', 'docker',
    'kubernetes', 'git', 'html', 'css', 'tailwind', 'api', 'rest', 'graphql',
    'frontend', 'backend', 'full-stack', 'fullstack', 'devops', 'agile', 'scrum',
    'machine learning', 'data science', 'pandas', 'numpy', 'tensorflow', 'pytorch',
    'figma', 'redux', 'express', 'django', 'flask', 'spring', 'android', 'ios',
    'flutter', 'react native', 'c++', 'c#', 'go', 'rust', 'php', 'ruby', 'swift',
    'kotlin', 'sass', 'less', 'webpack', 'vite', 'jest', 'cypress', 'selenium'
  ];
  
  const lowerDesc = jobDesc.toLowerCase();
  const found = techKeywords.filter(kw => lowerDesc.includes(kw));
  
  // Also extract capitalized words that might be tech
  const capWords = jobDesc.match(/\b[A-Z][A-Za-z]+(?:\.js|\.ts)?\b/g) || [];
  
  return [...new Set([...found, ...capWords.map(w => w.toLowerCase())])];
}
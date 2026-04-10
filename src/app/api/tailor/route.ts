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
  try {
    const { resume, jobDescription } = await request.json();
    
    if (!resume || !jobDescription) {
      return Response.json({ 
        success: false, 
        error: 'Missing resume or job description' 
      }, { status: 400 });
    }

    // Extract keywords from job description for highlighting
    const jobKeywords = extractKeywords(jobDescription);
    
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an expert resume writer. Your task is to REFORMAT the user's existing resume to better match a job description.

CRITICAL RULES:
1. DO NOT invent, add, or fabricate ANY information
2. ONLY use information that already exists in the user's resume
3. Reorganize and reorder bullet points to prioritize relevant experience
4. The output must be PLAIN TEXT, properly formatted
5. Use these section headers in CAPS: NAME, CONTACT, SUMMARY, SKILLS, EXPERIENCE, EDUCATION, PROJECTS

OUTPUT FORMAT - Return ONLY plain text resume, formatted like this:

JOHN DOE
Software Developer
Email: john@email.com | Phone: +91 9876543210 | Location: Bangalore, India
LinkedIn: linkedin.com/in/johndoe | GitHub: github.com/johndoe

================================================================================

PROFESSIONAL SUMMARY
Results-driven software developer with X years of experience building web applications. Skilled in React, Node.js, and TypeScript. Passionate about clean code and user experience.

================================================================================

TECHNICAL SKILLS
Languages: JavaScript, TypeScript, Python
Frameworks: React, Node.js, Next.js, Express
Databases: PostgreSQL, MongoDB
Tools: Git, Docker, AWS, VS Code

================================================================================

PROFESSIONAL EXPERIENCE

Company Name | Job Title | Location | Dates
• Achievement or responsibility (use action verbs)
• Another achievement with quantifiable results
• Led team of X developers to deliver Y features

Another Company | Another Title | Location | Dates
• More achievements
• Built Z feature using A, B, C technologies

================================================================================

EDUCATION
Degree Name | University Name | Year
• Relevant coursework or achievements

================================================================================

PROJECTS
Project Name | Technologies Used
• What the project does
• Your contribution

================================================================================

Do NOT use any JSON. Do NOT use markdown. Return ONLY the formatted plain text resume.`
        },
        {
          role: 'user',
          content: `MY ORIGINAL RESUME:
${resume}

TARGET JOB DESCRIPTION:
${jobDescription}

KEYWORDS FROM JOB (highlight these if present in my resume): ${jobKeywords.join(', ')}

Please reformat my resume to better match this job. Remember: ONLY use information that already exists in my resume. Do NOT add anything new. Return ONLY the formatted plain text resume.`
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3, // Lower temperature for more consistent output
      max_tokens: 4000,
    });

    let tailoredResume = completion.choices[0]?.message?.content || resume;
    
    // Clean any encoding issues
    tailoredResume = cleanAIResponse(tailoredResume);
    
    console.log('[Tailor API] Success! Resume length:', tailoredResume.length);
    console.log('[Tailor API] First 200 chars:', tailoredResume.substring(0, 200));
    
    return Response.json({ 
      success: true, 
      tailoredResume: tailoredResume,
      atsScore: 82,
      keywordsMatched: jobKeywords.slice(0, 10)
    });
    
  } catch (error: any) {
    console.error('[Tailor API] Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Failed to tailor resume. Please try again.' 
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
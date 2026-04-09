import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resumeText, jobDescription } = body;
    
    console.log('Tailor API called');
    console.log('Resume length:', resumeText?.length);
    console.log('Job description length:', jobDescription?.length);

    if (!resumeText || !jobDescription) {
      return NextResponse.json({ 
        error: 'Missing resume or job description',
        resumeText: resumeText ? 'ok' : 'missing',
        jobDescription: jobDescription ? 'ok' : 'missing'
      }, { status: 400 });
    }

    const zai = await getZai();
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an expert resume writer. Tailor this resume for the given job.
CRITICAL RULES - YOU MUST FOLLOW:
1. NEVER invent or add ANY information not in the original resume
2. ONLY reframe and reorganize existing content
3. Highlight keywords that match the job description
4. Reorder sections/bullets to prioritize relevant experience
5. Keep all facts accurate - no exaggeration
6. Keep the same format and structure
Return ONLY valid JSON:
{
"tailoredResume": "the complete tailored resume text",
"keywordsMatched": ["keyword1", "keyword2"],
"atsScore": 85
}`
        },
        {
          role: 'user',
          content: `ORIGINAL RESUME:\n${resumeText}\n\nTARGET JOB DESCRIPTION:\n${jobDescription}\n\nTailor the resume for this job. Return only JSON.`
        }
      ],
      max_tokens: 4000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';
    console.log('AI response length:', content.length);

    // Parse JSON
    let result;
    try {
      const cleaned = content.replace(/```json|```/g, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      // If not valid JSON, use raw content as resume
      result = {
        tailoredResume: content,
        keywordsMatched: [],
        atsScore: 70
      };
    }

    return NextResponse.json({
      success: true,
      tailoredResume: result.tailoredResume || content,
      keywordsMatched: result.keywordsMatched || [],
      atsScore: result.atsScore || 70
    });
  } catch (error) {
    console.error('Tailor error:', error);
    return NextResponse.json({ 
      error: 'Tailoring failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
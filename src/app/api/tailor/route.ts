import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
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

    const zai = await getZai();
    
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an expert resume writer. Tailor the resume for this job.

IMPORTANT: You MUST return ONLY valid JSON. No markdown, no code blocks, no extra text.

Return ONLY this JSON format (no backticks, no markdown):
{"tailoredResume": "the full resume text here", "atsScore": 85, "keywordsMatched": ["keyword1", "keyword2"]}

Do NOT wrap in code blocks. Do NOT add any text before or after. Return raw JSON only.`
        },
        {
          role: 'user',
          content: `RESUME:\n${resume}\n\nJOB DESCRIPTION:\n${jobDescription}\n\nReturn ONLY JSON, no markdown formatting:`
        }
      ],
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000
    });

    let content = response.choices[0]?.message?.content || '{}';
    
    console.log('[Tailor API] Raw response type:', typeof content);
    console.log('[Tailor API] Response length:', content.length);
    console.log('[Tailor API] First 200 chars:', content.substring(0, 200));
    
    // Clean the response - remove markdown code blocks if present
    content = content.trim();
    if (content.startsWith('```json')) {
      content = content.slice(7);
    }
    if (content.startsWith('```')) {
      content = content.slice(3);
    }
    if (content.endsWith('```')) {
      content = content.slice(0, -3);
    }
    content = content.trim();
    
    // Try to parse JSON
    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('[Tailor API] JSON parse failed. Content:', content.substring(0, 500));
      
      // Fallback: return the raw content as the resume
      return Response.json({
        success: true,
        tailoredResume: content,
        atsScore: 75,
        keywordsMatched: [],
        note: 'Resume tailored (raw format)'
      });
    }
    
    return Response.json({ 
      success: true, 
      tailoredResume: result.tailoredResume || resume,
      atsScore: result.atsScore || 75,
      keywordsMatched: result.keywordsMatched || []
    });
    
  } catch (error: any) {
    console.error('[Tailor API] Error:', error.message);
    return Response.json({ 
      success: false, 
      error: 'Failed to tailor resume. Please try again.' 
    }, { status: 500 });
  }
}
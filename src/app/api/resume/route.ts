import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawText, fileName } = body;
    
    console.log('Resume upload received:', { fileName, textLength: rawText?.length });
    
    if (!rawText) {
      return NextResponse.json({ error: 'No resume text provided' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Resume uploaded successfully',
      textLength: rawText.length 
    });
  } catch (error) {
    console.error('Resume upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { rawText, fileName, userId } = await req.json();
    
    if (!rawText) {
      return NextResponse.json({ error: 'No resume text provided' }, { status: 400 });
    }

    // For now, just return success - the resume is stored in client state
    // In production, you'd save to database with userId
    
    return NextResponse.json({ success: true, message: 'Resume uploaded' });
  } catch (error) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
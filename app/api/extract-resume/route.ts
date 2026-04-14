import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // File size limit: 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 });
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let text = '';
    
    if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
      const pdfParseModule = await import('pdf-parse');
      const pdfParse = (pdfParseModule as any).default || pdfParseModule;
      const result = await pdfParse(buffer);
      text = result.text || '';
    } else if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || '';
    } else if (file.name.endsWith('.doc')) {
      // Legacy .doc format — try mammoth, fall back to raw text
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        text = result.value || '';
      } catch {
        text = buffer.toString('utf-8');
      }
    } else {
      // .txt and other text formats
      text = buffer.toString('utf-8');
    }
    
    if (!text || text.trim().length < 50) {
      return NextResponse.json({ error: 'Could not extract enough text from file.' }, { status: 400 });
    }
    
    console.log(`[ExtractResume] Extracted ${text.length} chars from ${file.name}`);
    return NextResponse.json({ text });
    
  } catch (error: any) {
    console.error('[ExtractResume] Failed:', error.message);
    return NextResponse.json({ error: 'Extraction failed: ' + (error.message || 'Unknown error') }, { status: 500 });
  }
}

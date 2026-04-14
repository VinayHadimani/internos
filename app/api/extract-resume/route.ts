import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    if (file.name.endsWith('.pdf')) {
      // Dynamic import pdf-parse (server-side only)
      const pdfParseModule = await import('pdf-parse');
      const pdfParse = (pdfParseModule as any).default || pdfParseModule;
      const result = await pdfParse(buffer);
      return NextResponse.json({ text: result.text });
    }
    
    // For other formats, return raw text
    const text = buffer.toString('utf-8');
    return NextResponse.json({ text });
  } catch (error: any) {
    console.error('Resume extraction failed:', error);
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}

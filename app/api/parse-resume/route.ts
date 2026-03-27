import { NextRequest, NextResponse } from 'next/server';
import { extractText } from 'unpdf';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    console.log('[Parse Resume] Received request');

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      console.log('[Parse Resume] No file provided');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('[Parse Resume] File:', file.name, 'Type:', file.type, 'Size:', file.size);

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    console.log('[Parse Resume] Converting to Uint8Array...');
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    console.log('[Parse Resume] Parsing PDF with unpdf...');
    const { totalPages, text } = await extractText(uint8Array, { mergePages: true });

    console.log('[Parse Resume] Pages:', totalPages);

    const trimmedText = text?.trim();

    if (!trimmedText) {
      console.log('[Parse Resume] No text extracted');
      return NextResponse.json(
        { error: 'Could not extract text from this PDF. It may be an image-based PDF.' },
        { status: 422 }
      );
    }

    console.log('[Parse Resume] Success — text length:', trimmedText.length);

    return NextResponse.json({
      text: trimmedText,
      pages: totalPages,
    });
  } catch (error) {
    console.error('[Parse Resume] Error:', error);

    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      { error: `Failed to parse PDF: ${message}` },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { translateJobToEnglish } from '@/lib/ai';

export async function POST(request: Request) {
  try {
    const { text, sourceLanguage } = await request.json();
    
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const translated = await translateJobToEnglish(text, sourceLanguage);
    
    return NextResponse.json({ translated });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Failed to translate' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rating, feedback } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating required (1-5)' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await (supabase as any).from('feedback').insert({
      user_id: user?.id || null,
      rating,
      feedback: feedback || '',
      created_at: new Date().toISOString(),
    });

    console.log(`[Feedback API] Rating: ${rating}, Feedback: ${feedback?.slice(0, 100)}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Feedback API] Error:', error);
    return NextResponse.json({ success: true }); // silent fail
  }
}

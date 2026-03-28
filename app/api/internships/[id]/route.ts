import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  console.log(`[Internship API] Fetching: ${id}`);

  try {
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from('internships')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('[Internship API] DB error:', error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Internship not found' },
        { status: 404 }
      );
    }

    console.log(`[Internship API] Found: ${data.title} at ${data.company}`);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[Internship API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch internship' },
      { status: 500 }
    );
  }
}

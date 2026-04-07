import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch matched internships for the user
    const { data, error } = await supabase
      .from('user_internships')
      .select(`
        match_score,
        internships (*)
      `)
      .eq('user_id', user.id)
      .order('match_score', { ascending: false });

    if (error) {
      console.error('[My Internships] Fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch matched internships' }, { status: 500 });
    }

    // Transform the data to a flatter structure
    const matchedInternships = data?.map(item => {
      const internship = (item as any).internships;
      return {
        ...internship,
        matchScore: item.match_score
      };
    }) || [];

    return NextResponse.json(matchedInternships);
  } catch (error) {
    console.error('[My Internships] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BETA_CONFIG } from '@/constants/beta';

export async function GET() {
  try {
    const supabase = await createClient();

    const { count, error } = await (supabase as any)
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    const spotsLeft = Math.max(0, BETA_CONFIG.BETA_USER_LIMIT - (count || 0));

    return NextResponse.json({
      spotsLeft,
      totalUsers: count || 0,
      limit: BETA_CONFIG.BETA_USER_LIMIT,
    });
  } catch (error) {
    return NextResponse.json({
      spotsLeft: BETA_CONFIG.BETA_USER_LIMIT,
      error: 'Could not fetch user count',
    });
  }
}

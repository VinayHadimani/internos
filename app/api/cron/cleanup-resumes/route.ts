import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    console.log('[Cron Cleanup] Starting resume cleanup job...');

    const supabase = await createClient();

    // Calculate the timestamp for 2 minutes ago
    const twoMinutesAgo = new Date();
    twoMinutesAgo.setMinutes(twoMinutesAgo.getMinutes() - 2);

    const { data, error } = await supabase
      .from('resumes')
      .delete()
      .lt('updated_at', twoMinutesAgo.toISOString())
      .select();

    if (error) {
      console.error('[Cron Cleanup] Error deleting old resumes:', error);
      return NextResponse.json({ error: 'Failed to cleanup resumes' }, { status: 500 });
    }

    console.log(`[Cron Cleanup] Successfully deleted ${data?.length || 0} expired resumes.`);

    return NextResponse.json({
      success: true,
      deletedCount: data?.length || 0
    });
  } catch (error) {
    console.error('[Cron Cleanup] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

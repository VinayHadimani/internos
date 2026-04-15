import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * DELETE /api/resume/cleanup
 * Purges the latest resume for the authenticated user to maintain a stateless session.
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[Cleanup API] Purging resumes for user: ${user.id}`);

    // Delete all resumes for this user to ensure complete cleanup
    const { error } = await supabase
      .from('resumes')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('[Cleanup API] Delete error:', error);
      return NextResponse.json({ error: 'Failed to purge resume' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Resume data purged from database'
    });
  } catch (error) {
    console.error('[Cleanup API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

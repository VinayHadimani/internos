import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { searchJobsForResume, rankJobsForResume } from '@/lib/scraper/resume-job-search';

export async function POST(req: NextRequest) {
  try {
    const { rawText, fileName } = await req.json();

    if (!rawText) {
      return NextResponse.json({ error: 'No resume text provided' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error: insertError } = await (supabase as any)
      .from('resumes')
      .insert({
        user_id: user.id,
        original_text: rawText,
        file_name: fileName || 'resume.pdf',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Resume API] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save resume' }, { status: 500 });
    }

    // Trigger background scraping and ranking
    // We don't await this to avoid blocking the response
    (async () => {
      try {
        console.log('[Resume API] Triggering background scraping for user:', user.id);
        const { jobs, searchTerms } = await searchJobsForResume(rawText);
        await rankJobsForResume(
          rawText,
          jobs,
          searchTerms.skills,
          searchTerms.experience,
          user.id
        );
        console.log('[Resume API] Background scraping and ranking completed for user:', user.id);
      } catch (err) {
        console.error('[Resume API] Background scraping failed:', err);
      }
    })();

    return NextResponse.json({
      success: true,
      resumeId: data.id,
      message: 'Resume uploaded and matching started'
    });
  } catch (error) {
    console.error('[Resume API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


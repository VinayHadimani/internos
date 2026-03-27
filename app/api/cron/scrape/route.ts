import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const secret = request.headers.get('x-cron-secret');
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    console.error('[Cron Scrape] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
  }

  if (secret !== expected) {
    console.error('[Cron Scrape] Invalid secret');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron Scrape] Starting scheduled scrape...');

  const results = {
    scraped: 0,
    added: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
    sources: {} as Record<string, number>,
    duration: 0,
  };

  const allInternships: Array<{
    title: string;
    company: string;
    location: string;
    stipend: string;
    duration: string;
    description: string;
    skills: string[];
    apply_url: string;
    deadline: string;
    source: string;
  }> = [];

  // Run Internshala scraper
  try {
    console.log('[Cron Scrape] Running Internshala...');
    const { scrapeInternshala } = await import('@/lib/scrapers/internshala');
    const data = await scrapeInternshala(undefined, 3);

    for (const item of data) {
      allInternships.push({
        title: item.title,
        company: item.company,
        location: item.location,
        stipend: item.stipend,
        duration: item.duration,
        description: item.description,
        skills: item.skills,
        apply_url: item.applyUrl,
        deadline: item.deadline,
        source: 'internshala',
      });
    }

    results.sources.internshala = data.length;
    console.log(`[Cron Scrape] Internshala: ${data.length} internships`);
  } catch (error) {
    const msg = `Internshala: ${error instanceof Error ? error.message : 'Failed'}`;
    results.errors.push(msg);
    console.error('[Cron Scrape]', msg);
  }

  // Run LinkedIn scraper
  try {
    console.log('[Cron Scrape] Running LinkedIn...');
    const { scrapeLinkedIn } = await import('@/lib/scrapers/linkedin');
    const data = await scrapeLinkedIn('internship');

    for (const item of data) {
      allInternships.push({
        title: item.title,
        company: item.company,
        location: item.location,
        stipend: item.stipend,
        duration: item.duration,
        description: item.description,
        skills: item.skills,
        apply_url: item.applyUrl,
        deadline: item.deadline,
        source: 'linkedin',
      });
    }

    results.sources.linkedin = data.length;
    console.log(`[Cron Scrape] LinkedIn: ${data.length} internships`);
  } catch (error) {
    const msg = `LinkedIn: ${error instanceof Error ? error.message : 'Failed'}`;
    results.errors.push(msg);
    console.error('[Cron Scrape]', msg);
  }

  results.scraped = allInternships.length;

  // Save to database
  if (allInternships.length > 0) {
    console.log('[Cron Scrape] Saving to database...');

    try {
      const supabase = await createClient();

      for (const internship of allInternships) {
        try {
          // Check for existing
          const { data: existing } = await (supabase as any)
            .from('internships')
            .select('id, deadline')
            .eq('title', internship.title)
            .eq('company', internship.company)
            .eq('apply_url', internship.apply_url);

          if (existing && existing.length > 0) {
            // Update if changed
            const current = existing[0];
            if (current.deadline !== internship.deadline) {
              await (supabase as any)
                .from('internships')
                .update({
                  deadline: internship.deadline,
                  location: internship.location,
                  stipend: internship.stipend,
                  description: internship.description,
                  skills: internship.skills,
                  is_active: true,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', current.id);

              results.updated++;
            } else {
              results.skipped++;
            }
          } else {
            // Insert new
            await (supabase as any)
              .from('internships')
              .insert({
                title: internship.title,
                company: internship.company,
                location: internship.location,
                stipend: internship.stipend,
                duration: internship.duration,
                description: internship.description,
                skills: internship.skills,
                apply_url: internship.apply_url,
                deadline: internship.deadline,
                source: internship.source,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });

            results.added++;
          }
        } catch (err) {
          results.errors.push(`Save failed: ${internship.title}`);
        }
      }

      // Deactivate old internships (older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      await (supabase as any)
        .from('internships')
        .update({ is_active: false })
        .lt('created_at', thirtyDaysAgo)
        .eq('is_active', true);

      console.log('[Cron Scrape] Deactivated old internships');
    } catch (error) {
      results.errors.push(`Database: ${error instanceof Error ? error.message : 'Failed'}`);
      console.error('[Cron Scrape] DB error:', error);
    }
  }

  results.duration = Date.now() - startTime;

  console.log('[Cron Scrape] Complete:', JSON.stringify(results));

  return NextResponse.json({
    success: true,
    message: 'Scrape completed',
    ...results,
    timestamp: new Date().toISOString(),
  });
}

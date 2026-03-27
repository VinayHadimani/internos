import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  console.log('[Scrape API] Starting scrape job...');

  // Auth check - only authenticated users can trigger scrape
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Optional: check for admin role
  // const isAdmin = user.user_metadata?.role === 'admin';
  // if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const query = body.query as string | undefined;
  const sources = (body.sources as string[]) || ['internshala', 'linkedin'];

  const results = {
    scraped: 0,
    added: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
    sources: {} as Record<string, { scraped: number; added: number }>,
  };

  // Run scrapers
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

  // Internshala
  if (sources.includes('internshala')) {
    try {
      console.log('[Scrape API] Running Internshala scraper...');
      const { scrapeInternshala } = await import('@/lib/scrapers/internshala');
      const data = await scrapeInternshala(query, 2);

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

      results.sources.internshala = { scraped: data.length, added: 0 };
      console.log(`[Scrape API] Internshala: ${data.length} internships found`);
    } catch (error) {
      const msg = `Internshala: ${error instanceof Error ? error.message : 'Unknown error'}`;
      results.errors.push(msg);
      console.error('[Scrape API]', msg);
    }
  }

  // LinkedIn
  if (sources.includes('linkedin')) {
    try {
      console.log('[Scrape API] Running LinkedIn scraper...');
      const { scrapeLinkedIn } = await import('@/lib/scrapers/linkedin');
      const data = await scrapeLinkedIn(query);

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

      results.sources.linkedin = { scraped: data.length, added: 0 };
      console.log(`[Scrape API] LinkedIn: ${data.length} internships found`);
    } catch (error) {
      const msg = `LinkedIn: ${error instanceof Error ? error.message : 'Unknown error'}`;
      results.errors.push(msg);
      console.error('[Scrape API]', msg);
    }
  }

  results.scraped = allInternships.length;
  console.log(`[Scrape API] Total scraped: ${allInternships.length}`);

  // Save to Supabase
  if (allInternships.length > 0) {
    console.log('[Scrape API] Saving to database...');

    for (const internship of allInternships) {
      try {
        // Check for existing record
        const { data: existingData } = await supabase
          .from('internships')
          .select('id, deadline')
          .eq('title', internship.title)
          .eq('company', internship.company)
          .eq('apply_url', internship.apply_url);

        const existing = existingData?.[0] as { id: string; deadline: string } | undefined;

        if (existing) {
          // Update if deadline changed
          if (existing.deadline !== internship.deadline) {
            await (supabase as any)
              .from('internships')
              .update({
                deadline: internship.deadline,
                location: internship.location,
                stipend: internship.stipend,
                description: internship.description,
                skills: internship.skills,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);

            results.updated++;
            console.log(`[Scrape API] Updated: ${internship.title} at ${internship.company}`);
          } else {
            results.skipped++;
          }
        } else {
          // Insert new
          const { error: insertError } = await (supabase as any)
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
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error(`[Scrape API] Insert error for ${internship.title}:`, insertError.message);
            results.errors.push(`Insert failed: ${internship.title} - ${insertError.message}`);
          } else {
            results.added++;
            if (results.sources[internship.source]) {
              results.sources[internship.source].added++;
            }
            console.log(`[Scrape API] Added: ${internship.title} at ${internship.company}`);
          }
        }
      } catch (err) {
        const msg = `Save failed for ${internship.title}: ${err instanceof Error ? err.message : 'Unknown'}`;
        results.errors.push(msg);
        console.error('[Scrape API]', msg);
      }
    }
  }

  console.log('[Scrape API] Complete:', JSON.stringify(results));

  return NextResponse.json({
    success: true,
    ...results,
  });
}

// GET - Check scrape status / last run
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get counts by source
    const { data: counts } = await (supabase as any)
      .from('internships')
      .select('source, id');

    const bySource: Record<string, number> = {};
    if (counts) {
      for (const row of counts as { source: string }[]) {
        const src = row.source || 'unknown';
        bySource[src] = (bySource[src] || 0) + 1;
      }
    }

    // Get last scraped
    const { data: lastScraped } = await (supabase as any)
      .from('internships')
      .select('created_at, title, company, source')
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      success: true,
      total: counts?.length || 0,
      bySource,
      recent: lastScraped || [],
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}

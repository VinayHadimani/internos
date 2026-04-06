import { NextRequest, NextResponse } from 'next/server';
import { scrapeAllInternships, scrapeSingleUrl } from '@/lib/scraper/internship-scraper';
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const singleUrl = body?.url;

    let internships;
    
    if (singleUrl) {
      internships = await scrapeSingleUrl(singleUrl, apiKey);
    } else {
      const result = await scrapeAllInternships(apiKey);
      internships = result.internships;
    }

    if (!internships || internships.length === 0) {
      return NextResponse.json({
        success: true,
        scraped: 0,
        added: 0,
        skipped: 0,
        message: 'No internships found',
      });
    }

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => [],
          setAll: () => {},
        },
      }
    );
    
    let added = 0;
    let skipped = 0;

    for (const internship of internships) {
      try {
        const { data: existing } = await supabase
          .from('internships')
          .select('id')
          .eq('title', internship.title)
          .eq('company', internship.company)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        const { error } = await (supabase
          .from('internships') as any)
          .insert({
            title: internship.title,
            company: internship.company,
            location: internship.location,
            stipend: internship.stipend,
            duration: internship.duration,
            description: internship.description,
            skills_required: internship.skills,
            source: internship.source,
            external_url: internship.link,
            posted_date: new Date().toISOString().split('T')[0],
            deadline: internship.deadline,
            is_active: true,
          });

        if (!error) {
          added++;
        }
      } catch (e) {
        // Skip errors
      }
    }

    return NextResponse.json({
      success: true,
      scraped: internships.length,
      added,
      skipped,
    });

  } catch (error: any) {
    console.error('Scraper error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ready' });
}

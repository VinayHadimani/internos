import { NextRequest, NextResponse } from 'next/server';
import { scrapeSingleUrl } from '@/lib/scraper/internship-scraper';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
  }

  try {
    // Test with just ONE URL for now to avoid Vercel timeouts
    const testUrl = 'https://internshala.com/internships/python';
    
    console.log('Scraping single URL:', testUrl);
    const internships = await scrapeSingleUrl(testUrl, apiKey);
    console.log('Found internships:', internships.length);

    if (!internships || internships.length === 0) {
      return NextResponse.json({
        success: true,
        scraped: 0,
        added: 0,
        skipped: 0,
        message: 'No internships found',
      });
    }

    const supabase = createAdminClient();
    
    let added = 0;
    let skipped = 0;

    // Process first 10 results to stay within timeout limits
    for (const internship of internships.slice(0, 10)) {
      try {
        const { data: existing } = await supabase
          .from('internships')
          .select('id')
          .eq('external_url', internship.link)
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
        } else {
          console.error('Database insert error:', error);
        }
      } catch (e) {
        console.error('Error processing internship:', e);
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

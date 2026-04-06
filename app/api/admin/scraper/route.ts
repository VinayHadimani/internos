import { NextResponse } from 'next/server';
import { scrapeAndSeedInternships } from '@/lib/scraper/internship-scraper';

export async function POST(req: Request) {
  // Verify auth
  const auth = req.headers.get('authorization');
  const secret = process.env.SCRAPER_SECRET;

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await scrapeAndSeedInternships();

    return NextResponse.json({
      success: true,
      ...results,
      message: `${results.inserted} new internships added`,
    });
  } catch (error: any) {
    console.error('Scraper error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ready',
    usage: 'POST with Authorization: Bearer <SCRAPER_SECRET>',
  });
}

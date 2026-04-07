import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resumeText } = body;
    
    console.log('Search API called with resume length:', resumeText?.length);
    
    if (!resumeText) {
      return NextResponse.json({ error: 'Resume text is required' }, { status: 400 });
    }

    // For now, return mock data to test
    return NextResponse.json({
      success: true,
      jobs: [
        {
          title: 'Frontend Developer Intern',
          company: 'Tech Startup',
          location: 'Remote',
          skills: ['React', 'TypeScript', 'CSS'],
          matchScore: 85,
          matchLabel: 'Excellent Match',
          description: 'Build modern web applications'
        },
        {
          title: 'Full Stack Intern',
          company: 'Innovation Labs',
          location: 'Bangalore',
          skills: ['JavaScript', 'Node.js', 'MongoDB'],
          matchScore: 72,
          matchLabel: 'Good Match',
          description: 'Full stack development role'
        }
      ]
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const mockInternships: Record<string, {
  id: string;
  title: string;
  company: string;
  location: string;
  stipend: string;
  duration: string;
  description: string;
  skills: string[];
  external_url: string;
  deadline: string;
  source: string;
}> = {
  '1': { id: '1', title: 'Software Engineering Intern', company: 'Flipkart', location: 'Bangalore, Karnataka', stipend: '₹25,000 - ₹35,000/month', duration: '6 months', description: 'Join our engineering team to work on scalable e-commerce solutions. You\'ll be involved in full-stack development, API design, and performance optimization for millions of users.\n\nResponsibilities:\n• Design and implement scalable web applications\n• Collaborate with cross-functional teams\n• Write clean, maintainable code\n• Participate in code reviews\n\nRequirements:\n• Bachelor\'s degree in CS or related field\n• Strong foundation in data structures and algorithms\n• Experience with JavaScript, React, Node.js', skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'AWS'], external_url: 'https://careers.flipkart.com/internships/software-engineering', deadline: '2024-04-15', source: 'mock' },
  '2': { id: '2', title: 'Frontend Developer Intern', company: 'Razorpay', location: 'Mumbai, Maharashtra', stipend: '₹30,000 - ₹40,000/month', duration: '6 months', description: 'Build beautiful and responsive payment interfaces. Work with modern frontend technologies and contribute to India\'s leading fintech platform.', skills: ['React', 'TypeScript', 'CSS', 'Redux', 'Jest'], external_url: 'https://razorpay.com/careers/internships/frontend', deadline: '2024-04-20', source: 'mock' },
  '3': { id: '3', title: 'Data Analyst Intern', company: 'Meesho', location: 'Bangalore, Karnataka', stipend: '₹20,000 - ₹30,000/month', duration: '4 months', description: 'Analyze user behavior data and create insights for product decisions. Work with large datasets and build dashboards for business intelligence.', skills: ['Python', 'SQL', 'Tableau', 'Excel', 'Statistics'], external_url: 'https://meesho.com/careers/internships/data-analyst', deadline: '2024-04-10', source: 'mock' },
  '4': { id: '4', title: 'Backend Developer Intern', company: 'CRED', location: 'Bangalore, Karnataka', stipend: '₹35,000 - ₹45,000/month', duration: '6 months', description: 'Develop robust backend services for India\'s premium credit card management platform. Work with microservices architecture and cloud technologies.', skills: ['Java', 'Spring Boot', 'PostgreSQL', 'Docker', 'Kubernetes'], external_url: 'https://cred.club/careers/internships/backend', deadline: '2024-04-25', source: 'mock' },
  '5': { id: '5', title: 'Product Management Intern', company: 'Swiggy', location: 'Bangalore, Karnataka', stipend: '₹25,000 - ₹35,000/month', duration: '5 months', description: 'Work closely with product managers to understand user needs and define product requirements.', skills: ['Product Strategy', 'User Research', 'Analytics', 'SQL', 'Figma'], external_url: 'https://swiggy.com/careers/internships/product', deadline: '2024-04-18', source: 'mock' },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  console.log(`[Internship Detail API] Fetching internship: ${id}`);

  try {
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from('internships')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[Internship Detail API] DB error:', error.message);
      throw error;
    }

    if (data) {
      console.log(`[Internship Detail API] Found: ${data.title}`);
      return NextResponse.json({
        success: true,
        data,
      });
    }
  } catch (error) {
    console.log('[Internship Detail API] DB unavailable, checking mock data');
  }

  // Fallback to mock
  const mockData = mockInternships[id];

  if (mockData) {
    return NextResponse.json({
      success: true,
      data: mockData,
      source: 'mock',
    });
  }

  return NextResponse.json(
    { success: false, error: 'Internship not found' },
    { status: 404 }
  );
}

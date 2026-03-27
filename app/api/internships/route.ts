import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Internship {
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
  source?: string;
  created_at?: string;
}

const mockInternships: Internship[] = [
  { id: '1', title: 'Software Engineering Intern', company: 'Flipkart', location: 'Bangalore, Karnataka', stipend: '₹25,000 - ₹35,000/month', duration: '6 months', description: 'Join our engineering team to work on scalable e-commerce solutions. You\'ll be involved in full-stack development, API design, and performance optimization for millions of users.', skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'AWS'], external_url: 'https://careers.flipkart.com/internships/software-engineering', deadline: '2024-04-15', source: 'mock' },
  { id: '2', title: 'Frontend Developer Intern', company: 'Razorpay', location: 'Mumbai, Maharashtra', stipend: '₹30,000 - ₹40,000/month', duration: '6 months', description: 'Build beautiful and responsive payment interfaces. Work with modern frontend technologies and contribute to India\'s leading fintech platform.', skills: ['React', 'TypeScript', 'CSS', 'Redux', 'Jest'], external_url: 'https://razorpay.com/careers/internships/frontend', deadline: '2024-04-20', source: 'mock' },
  { id: '3', title: 'Data Analyst Intern', company: 'Meesho', location: 'Bangalore, Karnataka', stipend: '₹20,000 - ₹30,000/month', duration: '4 months', description: 'Analyze user behavior data and create insights for product decisions. Work with large datasets and build dashboards for business intelligence.', skills: ['Python', 'SQL', 'Tableau', 'Excel', 'Statistics'], external_url: 'https://meesho.com/careers/internships/data-analyst', deadline: '2024-04-10', source: 'mock' },
  { id: '4', title: 'Backend Developer Intern', company: 'CRED', location: 'Bangalore, Karnataka', stipend: '₹35,000 - ₹45,000/month', duration: '6 months', description: 'Develop robust backend services for India\'s premium credit card management platform. Work with microservices architecture and cloud technologies.', skills: ['Java', 'Spring Boot', 'PostgreSQL', 'Docker', 'Kubernetes'], external_url: 'https://cred.club/careers/internships/backend', deadline: '2024-04-25', source: 'mock' },
  { id: '5', title: 'Product Management Intern', company: 'Swiggy', location: 'Bangalore, Karnataka', stipend: '₹25,000 - ₹35,000/month', duration: '5 months', description: 'Work closely with product managers to understand user needs and define product requirements. Participate in sprint planning and user research.', skills: ['Product Strategy', 'User Research', 'Analytics', 'SQL', 'Figma'], external_url: 'https://swiggy.com/careers/internships/product', deadline: '2024-04-18', source: 'mock' },
  { id: '6', title: 'Full Stack Developer Intern', company: 'Groww', location: 'Bangalore, Karnataka', stipend: '₹28,000 - ₹38,000/month', duration: '6 months', description: 'Build features for India\'s fastest-growing investment platform. Work on both frontend and backend technologies to create seamless user experiences.', skills: ['React', 'Node.js', 'MongoDB', 'Express', 'TypeScript'], external_url: 'https://groww.in/careers/internships/fullstack', deadline: '2024-04-22', source: 'mock' },
  { id: '7', title: 'Mobile App Developer Intern', company: 'Zepto', location: 'Mumbai, Maharashtra', stipend: '₹30,000 - ₹40,000/month', duration: '6 months', description: 'Develop mobile applications for India\'s instant delivery platform. Work with React Native and contribute to features that serve millions of users.', skills: ['React Native', 'JavaScript', 'Firebase', 'REST APIs', 'Git'], external_url: 'https://zepto.com/careers/internships/mobile', deadline: '2024-04-12', source: 'mock' },
  { id: '8', title: 'DevOps Engineer Intern', company: 'PhonePe', location: 'Bangalore, Karnataka', stipend: '₹32,000 - ₹42,000/month', duration: '6 months', description: 'Learn and implement DevOps practices in a high-scale fintech environment. Work with CI/CD pipelines, monitoring, and infrastructure automation.', skills: ['AWS', 'Docker', 'Kubernetes', 'Jenkins', 'Linux'], external_url: 'https://phonepe.com/careers/internships/devops', deadline: '2024-04-28', source: 'mock' },
  { id: '9', title: 'Marketing Technology Intern', company: 'Zomato', location: 'Gurgaon, Haryana', stipend: '₹22,000 - ₹32,000/month', duration: '4 months', description: 'Work on digital marketing campaigns and analyze marketing data. Learn about growth hacking and user acquisition strategies in the food-tech industry.', skills: ['Google Analytics', 'SQL', 'Excel', 'Marketing Tools', 'Data Visualization'], external_url: 'https://zomato.com/careers/internships/marketing', deadline: '2024-04-14', source: 'mock' },
  { id: '10', title: 'Machine Learning Intern', company: 'Ola', location: 'Bangalore, Karnataka', stipend: '₹35,000 - ₹45,000/month', duration: '6 months', description: 'Apply machine learning techniques to solve real-world problems in transportation and mobility. Work with large datasets and build predictive models.', skills: ['Python', 'TensorFlow', 'Pandas', 'Scikit-learn', 'SQL'], external_url: 'https://ola.com/careers/internships/ml', deadline: '2024-04-30', source: 'mock' },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || searchParams.get('q') || '';
  const location = searchParams.get('location') || '';
  const category = searchParams.get('category') || '';
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  try {
    const supabase = await createClient();

    let query = (supabase as any)
      .from('internships')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Search filter (title or company)
    if (search) {
      query = query.or(`title.ilike.%${search}%,company.ilike.%${search}%`);
    }

    // Location filter
    if (location) {
      query = query.ilike('location', `%${location}%`);
    }

    // Category filter
    if (category) {
      query = query.ilike('title', `%${category}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Internships API] DB error:', error.message);
      throw error;
    }

    if (data && data.length > 0) {
      console.log(`[Internships API] Returning ${data.length} from database`);
      return NextResponse.json({
        success: true,
        data,
        count: data.length,
        source: 'database',
      });
    }
  } catch (error) {
    console.log('[Internships API] DB unavailable, using mock data');
  }

  // Fallback to mock data
  let data = mockInternships;

  if (search) {
    const q = search.toLowerCase();
    data = data.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.company.toLowerCase().includes(q) ||
      i.skills.some(s => s.toLowerCase().includes(q))
    );
  }

  if (location) {
    const loc = location.toLowerCase();
    data = data.filter(i => i.location.toLowerCase().includes(loc));
  }

  if (category) {
    const cat = category.toLowerCase();
    data = data.filter(i => i.title.toLowerCase().includes(cat));
  }

  data = data.slice(0, limit);

  return NextResponse.json({
    success: true,
    data,
    count: data.length,
    source: 'mock',
  });
}

import { NextRequest, NextResponse } from 'next/server';

interface Internship {
  id: string;
  title: string;
  company: string;
  location: string;
  stipend: string;
  duration: string;
  description: string;
  skills: string[];
  matchScore: number;
  externalUrl: string;
  deadline: string;
}

// Mock data for internships - realistic for Indian students
const internships: Internship[] = [
  {
    id: '1',
    title: 'Software Engineering Intern',
    company: 'Flipkart',
    location: 'Bangalore, Karnataka',
    stipend: '₹25,000 - ₹35,000/month',
    duration: '6 months',
    description: 'Join our engineering team to work on scalable e-commerce solutions. You\'ll be involved in full-stack development, API design, and performance optimization for millions of users.',
    skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'AWS'],
    matchScore: 92,
    externalUrl: 'https://careers.flipkart.com/internships/software-engineering',
    deadline: '2024-04-15'
  },
  {
    id: '2',
    title: 'Frontend Developer Intern',
    company: 'Razorpay',
    location: 'Mumbai, Maharashtra',
    stipend: '₹30,000 - ₹40,000/month',
    duration: '6 months',
    description: 'Build beautiful and responsive payment interfaces. Work with modern frontend technologies and contribute to India\'s leading fintech platform.',
    skills: ['React', 'TypeScript', 'CSS', 'Redux', 'Jest'],
    matchScore: 88,
    externalUrl: 'https://razorpay.com/careers/internships/frontend',
    deadline: '2024-04-20'
  },
  {
    id: '3',
    title: 'Data Analyst Intern',
    company: 'Meesho',
    location: 'Bangalore, Karnataka',
    stipend: '₹20,000 - ₹30,000/month',
    duration: '4 months',
    description: 'Analyze user behavior data and create insights for product decisions. Work with large datasets and build dashboards for business intelligence.',
    skills: ['Python', 'SQL', 'Tableau', 'Excel', 'Statistics'],
    matchScore: 85,
    externalUrl: 'https://meesho.com/careers/internships/data-analyst',
    deadline: '2024-04-10'
  },
  {
    id: '4',
    title: 'Backend Developer Intern',
    company: 'CRED',
    location: 'Bangalore, Karnataka',
    stipend: '₹35,000 - ₹45,000/month',
    duration: '6 months',
    description: 'Develop robust backend services for India\'s premium credit card management platform. Work with microservices architecture and cloud technologies.',
    skills: ['Java', 'Spring Boot', 'PostgreSQL', 'Docker', 'Kubernetes'],
    matchScore: 90,
    externalUrl: 'https://cred.club/careers/internships/backend',
    deadline: '2024-04-25'
  },
  {
    id: '5',
    title: 'Product Management Intern',
    company: 'Swiggy',
    location: 'Bangalore, Karnataka',
    stipend: '₹25,000 - ₹35,000/month',
    duration: '5 months',
    description: 'Work closely with product managers to understand user needs and define product requirements. Participate in sprint planning and user research.',
    skills: ['Product Strategy', 'User Research', 'Analytics', 'SQL', 'Figma'],
    matchScore: 82,
    externalUrl: 'https://swiggy.com/careers/internships/product',
    deadline: '2024-04-18'
  },
  {
    id: '6',
    title: 'Full Stack Developer Intern',
    company: 'Groww',
    location: 'Bangalore, Karnataka',
    stipend: '₹28,000 - ₹38,000/month',
    duration: '6 months',
    description: 'Build features for India\'s fastest-growing investment platform. Work on both frontend and backend technologies to create seamless user experiences.',
    skills: ['React', 'Node.js', 'MongoDB', 'Express', 'TypeScript'],
    matchScore: 87,
    externalUrl: 'https://groww.in/careers/internships/fullstack',
    deadline: '2024-04-22'
  },
  {
    id: '7',
    title: 'Mobile App Developer Intern',
    company: 'Zepto',
    location: 'Mumbai, Maharashtra',
    stipend: '₹30,000 - ₹40,000/month',
    duration: '6 months',
    description: 'Develop mobile applications for India\'s instant delivery platform. Work with React Native and contribute to features that serve millions of users.',
    skills: ['React Native', 'JavaScript', 'Firebase', 'REST APIs', 'Git'],
    matchScore: 89,
    externalUrl: 'https://zepto.com/careers/internships/mobile',
    deadline: '2024-04-12'
  },
  {
    id: '8',
    title: 'DevOps Engineer Intern',
    company: 'PhonePe',
    location: 'Bangalore, Karnataka',
    stipend: '₹32,000 - ₹42,000/month',
    duration: '6 months',
    description: 'Learn and implement DevOps practices in a high-scale fintech environment. Work with CI/CD pipelines, monitoring, and infrastructure automation.',
    skills: ['AWS', 'Docker', 'Kubernetes', 'Jenkins', 'Linux'],
    matchScore: 84,
    externalUrl: 'https://phonepe.com/careers/internships/devops',
    deadline: '2024-04-28'
  },
  {
    id: '9',
    title: 'Marketing Technology Intern',
    company: 'Zomato',
    location: 'Gurgaon, Haryana',
    stipend: '₹22,000 - ₹32,000/month',
    duration: '4 months',
    description: 'Work on digital marketing campaigns and analyze marketing data. Learn about growth hacking and user acquisition strategies in the food-tech industry.',
    skills: ['Google Analytics', 'SQL', 'Excel', 'Marketing Tools', 'Data Visualization'],
    matchScore: 78,
    externalUrl: 'https://zomato.com/careers/internships/marketing',
    deadline: '2024-04-14'
  },
  {
    id: '10',
    title: 'Machine Learning Intern',
    company: 'Ola',
    location: 'Bangalore, Karnataka',
    stipend: '₹35,000 - ₹45,000/month',
    duration: '6 months',
    description: 'Apply machine learning techniques to solve real-world problems in transportation and mobility. Work with large datasets and build predictive models.',
    skills: ['Python', 'TensorFlow', 'Pandas', 'Scikit-learn', 'SQL'],
    matchScore: 91,
    externalUrl: 'https://ola.com/careers/internships/ml',
    deadline: '2024-04-30'
  }
];

export async function GET(request: NextRequest) {
  try {
    // In a real application, you might want to add query parameters for filtering
    // For now, we'll return all internships

    return NextResponse.json({
      success: true,
      data: internships,
      count: internships.length
    });
  } catch (error) {
    console.error('Error fetching internships:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch internships'
      },
      { status: 500 }
    );
  }
}
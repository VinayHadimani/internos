import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const sampleInternships = [
  {
    title: 'Software Engineering Intern',
    company: 'Flipkart',
    location: 'Bangalore, Karnataka',
    stipend: '₹25,000 - ₹35,000/month',
    duration: '6 months',
    description: 'Join Flipkart\'s engineering team to build scalable e-commerce solutions. Work on full-stack development, API design, and performance optimization for millions of users. You\'ll collaborate with product managers and designers to ship features that impact millions of Indian shoppers.',
    skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'AWS', 'Git'],
    apply_url: 'https://careers.flipkart.com/internships/software-engineering',
    deadline: '2025-04-30',
    source: 'seed',
  },
  {
    title: 'Frontend Developer Intern',
    company: 'Razorpay',
    location: 'Bangalore, Karnataka',
    stipend: '₹30,000 - ₹40,000/month',
    duration: '6 months',
    description: 'Build beautiful and responsive payment interfaces at India\'s leading fintech platform. Work with React, TypeScript, and modern CSS to create seamless checkout experiences for merchants across India.',
    skills: ['React', 'TypeScript', 'CSS', 'Redux', 'Jest', 'HTML'],
    apply_url: 'https://razorpay.com/careers/internships/frontend',
    deadline: '2025-05-15',
    source: 'seed',
  },
  {
    title: 'Data Analyst Intern',
    company: 'Meesho',
    location: 'Bangalore, Karnataka',
    stipend: '₹20,000 - ₹28,000/month',
    duration: '4 months',
    description: 'Analyze user behavior data and create insights for product decisions at India\'s fastest-growing social commerce platform. Work with large datasets, build dashboards, and present findings to leadership.',
    skills: ['Python', 'SQL', 'Tableau', 'Excel', 'Statistics', 'Data Analysis'],
    apply_url: 'https://meesho.com/careers/internships/data-analyst',
    deadline: '2025-04-20',
    source: 'seed',
  },
  {
    title: 'Backend Developer Intern',
    company: 'CRED',
    location: 'Bangalore, Karnataka',
    stipend: '₹35,000 - ₹45,000/month',
    duration: '6 months',
    description: 'Develop robust backend services for India\'s premium credit card management platform. Work with microservices architecture, cloud technologies, and high-throughput payment systems.',
    skills: ['Java', 'Spring Boot', 'PostgreSQL', 'Docker', 'Kubernetes', 'Redis'],
    apply_url: 'https://cred.club/careers/internships/backend',
    deadline: '2025-05-25',
    source: 'seed',
  },
  {
    title: 'Product Management Intern',
    company: 'Swiggy',
    location: 'Bangalore, Karnataka',
    stipend: '₹25,000 - ₹30,000/month',
    duration: '5 months',
    description: 'Work closely with product managers to understand user needs and define product requirements. Participate in sprint planning, user research, and data analysis for India\'s leading food delivery platform.',
    skills: ['Product Strategy', 'User Research', 'Analytics', 'SQL', 'Figma', 'Agile'],
    apply_url: 'https://swiggy.com/careers/internships/product',
    deadline: '2025-05-10',
    source: 'seed',
  },
  {
    title: 'Full Stack Developer Intern',
    company: 'Groww',
    location: 'Bangalore, Karnataka',
    stipend: '₹28,000 - ₹38,000/month',
    duration: '6 months',
    description: 'Build features for India\'s fastest-growing investment platform. Work on both frontend and backend technologies to create seamless user experiences for stock trading and mutual fund investments.',
    skills: ['React', 'Node.js', 'MongoDB', 'Express', 'TypeScript', 'REST APIs'],
    apply_url: 'https://groww.in/careers/internships/fullstack',
    deadline: '2025-04-22',
    source: 'seed',
  },
  {
    title: 'Mobile App Developer Intern',
    company: 'PhonePe',
    location: 'Bangalore, Karnataka',
    stipend: '₹30,000 - ₹40,000/month',
    duration: '6 months',
    description: 'Develop mobile applications for India\'s leading digital payments platform. Work with React Native or Flutter to build features that serve 300+ million users.',
    skills: ['React Native', 'JavaScript', 'Firebase', 'REST APIs', 'Git', 'TypeScript'],
    apply_url: 'https://phonepe.com/careers/internships/mobile',
    deadline: '2025-05-12',
    source: 'seed',
  },
  {
    title: 'DevOps Engineer Intern',
    company: 'Zomato',
    location: 'Gurgaon, Haryana',
    stipend: '₹32,000 - ₹42,000/month',
    duration: '6 months',
    description: 'Learn and implement DevOps practices at scale. Work with CI/CD pipelines, monitoring, infrastructure automation, and container orchestration for a platform serving millions of orders daily.',
    skills: ['AWS', 'Docker', 'Kubernetes', 'Jenkins', 'Linux', 'Python'],
    apply_url: 'https://zomato.com/careers/internships/devops',
    deadline: '2025-05-28',
    source: 'seed',
  },
  {
    title: 'Marketing Intern',
    company: 'Ola',
    location: 'Bangalore, Karnataka',
    stipend: '₹15,000 - ₹20,000/month',
    duration: '3 months',
    description: 'Work on digital marketing campaigns, social media strategy, and content creation. Analyze marketing metrics and help grow Ola\'s brand presence across digital channels.',
    skills: ['Google Analytics', 'Social Media', 'Content Writing', 'SEO', 'Excel', 'Marketing Tools'],
    apply_url: 'https://ola.com/careers/internships/marketing',
    deadline: '2025-04-15',
    source: 'seed',
  },
  {
    title: 'Machine Learning Intern',
    company: 'Paytm',
    location: 'Noida, Uttar Pradesh',
    stipend: '₹35,000 - ₹50,000/month',
    duration: '6 months',
    description: 'Apply machine learning techniques to solve real-world problems in fintech. Build recommendation systems, fraud detection models, and NLP-based customer support automation.',
    skills: ['Python', 'TensorFlow', 'Pandas', 'Scikit-learn', 'SQL', 'Deep Learning'],
    apply_url: 'https://paytm.com/careers/internships/ml',
    deadline: '2025-05-30',
    source: 'seed',
  },
  {
    title: 'UI/UX Design Intern',
    company: 'Swiggy',
    location: 'Bangalore, Karnataka',
    stipend: '₹18,000 - ₹25,000/month',
    duration: '4 months',
    description: 'Design intuitive user interfaces for Swiggy\'s consumer app and merchant dashboard. Work with the design team to create wireframes, prototypes, and high-fidelity mockups.',
    skills: ['Figma', 'UI Design', 'UX Research', 'Prototyping', 'Adobe XD', 'Wireframing'],
    apply_url: 'https://swiggy.com/careers/internships/design',
    deadline: '2025-04-25',
    source: 'seed',
  },
  {
    title: 'Business Analyst Intern',
    company: 'Flipkart',
    location: 'Bangalore, Karnataka',
    stipend: '₹22,000 - ₹30,000/month',
    duration: '4 months',
    description: 'Analyze business metrics, build dashboards, and provide data-driven insights to support strategic decisions. Work with cross-functional teams to optimize operations and growth.',
    skills: ['SQL', 'Excel', 'Python', 'Tableau', 'Data Analysis', 'Power BI'],
    apply_url: 'https://careers.flipkart.com/internships/business-analyst',
    deadline: '2025-05-05',
    source: 'seed',
  },
  {
    title: 'Content Writing Intern',
    company: 'Zomato',
    location: 'Gurgaon, Haryana',
    stipend: '₹12,000 - ₹18,000/month',
    duration: '3 months',
    description: 'Create engaging content for Zomato\'s blog, social media, and marketing campaigns. Write restaurant reviews, food trend articles, and brand copy that resonates with foodies.',
    skills: ['Content Writing', 'SEO', 'Social Media', 'Copywriting', 'WordPress', 'Google Docs'],
    apply_url: 'https://zomato.com/careers/internships/content',
    deadline: '2025-04-10',
    source: 'seed',
  },
  {
    title: 'Quality Assurance Intern',
    company: 'Razorpay',
    location: 'Bangalore, Karnataka',
    stipend: '₹20,000 - ₹28,000/month',
    duration: '5 months',
    description: 'Ensure quality of payment products through manual and automated testing. Write test cases, identify bugs, and work with developers to ensure reliable payment experiences.',
    skills: ['Selenium', 'JavaScript', 'Test Automation', 'JIRA', 'API Testing', 'Git'],
    apply_url: 'https://razorpay.com/careers/internships/qa',
    deadline: '2025-05-20',
    source: 'seed',
  },
  {
    title: 'Data Science Intern',
    company: 'Meesho',
    location: 'Bangalore, Karnataka',
    stipend: '₹25,000 - ₹35,000/month',
    duration: '6 months',
    description: 'Build ML models for product recommendations, demand forecasting, and price optimization. Work with large-scale e-commerce data to drive growth at India\'s social commerce leader.',
    skills: ['Python', 'Machine Learning', 'SQL', 'Pandas', 'TensorFlow', 'Statistics'],
    apply_url: 'https://meesho.com/careers/internships/data-science',
    deadline: '2025-05-15',
    source: 'seed',
  },
  {
    title: 'HR & Talent Acquisition Intern',
    company: 'CRED',
    location: 'Bangalore, Karnataka',
    stipend: '₹15,000 - ₹22,000/month',
    duration: '3 months',
    description: 'Support the talent acquisition team in sourcing, screening, and onboarding top talent. Learn modern HR practices at one of India\'s most premium tech companies.',
    skills: ['LinkedIn Recruiting', 'Communication', 'Excel', 'ATS Tools', 'Interviewing'],
    apply_url: 'https://cred.club/careers/internships/hr',
    deadline: '2025-04-18',
    source: 'seed',
  },
  {
    title: 'Growth & Strategy Intern',
    company: 'PhonePe',
    location: 'Mumbai, Maharashtra',
    stipend: '₹20,000 - ₹28,000/month',
    duration: '4 months',
    description: 'Drive growth initiatives for PhonePe\'s merchant and consumer segments. Analyze market trends, competitor strategies, and user behavior to identify growth opportunities.',
    skills: ['SQL', 'Excel', 'Data Analysis', 'PowerPoint', 'Market Research', 'Python'],
    apply_url: 'https://phonepe.com/careers/internships/growth',
    deadline: '2025-05-01',
    source: 'seed',
  },
  {
    title: 'Cloud Engineering Intern',
    company: 'Paytm',
    location: 'Noida, Uttar Pradesh',
    stipend: '₹28,000 - ₹38,000/month',
    duration: '6 months',
    description: 'Work on cloud infrastructure and deployment automation. Manage AWS/GCP resources, implement infrastructure as code, and ensure high availability of payment services.',
    skills: ['AWS', 'Terraform', 'Docker', 'Linux', 'Python', 'Kubernetes'],
    apply_url: 'https://paytm.com/careers/internships/cloud',
    deadline: '2025-05-25',
    source: 'seed',
  },
  {
    title: 'Android Developer Intern',
    company: 'Ola',
    location: 'Bangalore, Karnataka',
    stipend: '₹30,000 - ₹40,000/month',
    duration: '6 months',
    description: 'Build and maintain the Ola Android app used by millions of riders. Work with Kotlin, Jetpack Compose, and modern Android architecture patterns.',
    skills: ['Kotlin', 'Android', 'Jetpack Compose', 'Java', 'REST APIs', 'Git'],
    apply_url: 'https://ola.com/careers/internships/android',
    deadline: '2025-05-18',
    source: 'seed',
  },
  {
    title: 'Cybersecurity Intern',
    company: 'Groww',
    location: 'Bangalore, Karnataka',
    stipend: '₹25,000 - ₹35,000/month',
    duration: '5 months',
    description: 'Help secure India\'s leading investment platform. Conduct vulnerability assessments, implement security controls, and monitor for threats in a regulated fintech environment.',
    skills: ['Python', 'Network Security', 'Linux', 'OWASP', 'SIEM', 'Ethical Hacking'],
    apply_url: 'https://groww.in/careers/internships/security',
    deadline: '2025-05-10',
    source: 'seed',
  },
];

export async function POST() {
  console.log('[Seed API] Seeding internships...');

  try {
    const supabase = await createClient();

    // Check existing count
    const { count: existingCount } = await (supabase as any)
      .from('internships')
      .select('*', { count: 'exact', head: true });

    console.log(`[Seed API] Existing records: ${existingCount || 0}`);

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const internship of sampleInternships) {
      try {
        // Check for duplicate
        const { data: existing } = await (supabase as any)
          .from('internships')
          .select('id')
          .eq('title', internship.title)
          .eq('company', internship.company);

        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }

        const { error } = await (supabase as any)
          .from('internships')
          .insert({
            ...internship,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (error) {
          errors.push(`${internship.title}: ${error.message}`);
        } else {
          inserted++;
          console.log(`[Seed API] Inserted: ${internship.title} at ${internship.company}`);
        }
      } catch (err) {
        errors.push(`${internship.title}: ${err instanceof Error ? err.message : 'Failed'}`);
      }
    }

    console.log(`[Seed API] Complete: ${inserted} inserted, ${skipped} skipped`);

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      errors,
      total: sampleInternships.length,
    });
  } catch (error) {
    console.error('[Seed API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to seed internships' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    // Get the FormData from the request
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    // Check if file exists
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    // TODO: Implement actual PDF text extraction
    // For now, return mock data to demonstrate the API structure
    // In production, you would use a PDF parsing library like:
    // - pdf-parse (requires DOM polyfills in server environment)
    // - pdf2pic + OCR
    // - External service like Adobe PDF Services
    // - pdf-lib for basic text extraction
    // - Or use a cloud service like Google Cloud Vision or AWS Textract

    // Mock extracted text for demonstration
    const mockExtractedText = `
PROFESSIONAL SUMMARY
Dynamic and motivated software engineering student with strong foundation in full-stack development, seeking internship opportunities in software engineering. Proficient in React, Node.js, and modern web technologies with experience in building scalable applications.

EDUCATION
Bachelor of Science in Computer Science
University Name, Expected Graduation: May 2025
GPA: 3.8/4.0

TECHNICAL SKILLS
• Programming Languages: JavaScript, TypeScript, Python, Java
• Web Technologies: React, Next.js, Node.js, Express, HTML5, CSS3
• Databases: PostgreSQL, MongoDB, Supabase
• Tools & Platforms: Git, Docker, AWS, Vercel
• Other: REST APIs, GraphQL, Agile/Scrum

PROJECTS
Full-Stack E-Commerce Platform
• Built a complete e-commerce solution using React and Node.js
• Implemented user authentication, payment processing, and inventory management
• Deployed on AWS with 99.9% uptime

AI-Powered Resume Tailoring Tool
• Developed a web application that uses AI to optimize resumes for specific job postings
• Integrated with OpenAI API for natural language processing
• Improved user match rates by 40% on average

EXPERIENCE
Software Engineering Intern
Tech Company Name, Summer 2024
• Developed and maintained web applications using React and TypeScript
• Collaborated with cross-functional teams in an Agile environment
• Implemented automated testing and CI/CD pipelines

Research Assistant
University Lab, 2023-Present
• Conducted research in machine learning applications
• Published 2 papers in peer-reviewed conferences
• Presented findings at international conferences
    `.trim();

    return NextResponse.json({
      text: mockExtractedText,
      note: 'This is mock data. PDF parsing implementation needed for production.'
    });

  } catch (error) {
    console.error('Resume parsing error:', error);
    return NextResponse.json(
      { error: 'Failed to process the file. Please try again.' },
      { status: 500 }
    );
  }
}
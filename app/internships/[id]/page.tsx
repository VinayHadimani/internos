"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, DollarSign, Calendar, Target, ExternalLink, FileEdit } from 'lucide-react';

interface InternshipDetail {
  id: string;
  company: string;
  title: string;
  location: string;
  stipend: string;
  duration: string;
  matchScore: number;
  description: string;
  requiredSkills: string[];
  applyUrl: string;
}

// Mock data for the internship detail
const mockInternship: InternshipDetail = {
  id: '1',
  company: 'Flipkart',
  title: 'Software Engineering Intern',
  location: 'Bangalore, Karnataka',
  stipend: '₹25,000 - ₹35,000/month',
  duration: '6 months',
  matchScore: 92,
  description: `We are looking for a talented Software Engineering Intern to join our team and work on cutting-edge e-commerce solutions. You will be working closely with our engineering team to develop, test, and deploy features that serve millions of users.

Responsibilities:
• Design and implement scalable web applications using modern technologies
• Collaborate with cross-functional teams including product, design, and QA
• Write clean, maintainable, and well-documented code
• Participate in code reviews and contribute to team knowledge sharing
• Learn and adapt to new technologies and frameworks

Requirements:
• Currently pursuing a Bachelor's or Master's degree in Computer Science or related field
• Strong foundation in data structures and algorithms
• Experience with at least one programming language (JavaScript, Python, Java, etc.)
• Familiarity with web development concepts (HTML, CSS, REST APIs)
• Passion for technology and eagerness to learn

What We Offer:
• Competitive stipend and performance-based incentives
• Mentorship from experienced engineers
• Opportunity to work on real-world projects with significant impact
• Flexible work environment and learning opportunities
• Potential for full-time conversion based on performance`,
  requiredSkills: [
    'JavaScript',
    'React',
    'Node.js',
    'Python',
    'Data Structures',
    'Algorithms',
    'REST APIs',
    'Git',
    'SQL'
  ],
  applyUrl: 'https://careers.flipkart.com/internships/software-engineering'
};

export default function InternshipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState<string>('');

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  const [internship] = useState<InternshipDetail | null>(mockInternship);

  const handleExternalApply = () => {
    if (internship?.applyUrl) {
      window.open(internship.applyUrl, '_blank');
    }
  };

  if (!internship) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-white">Internship not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <header className="border-b border-[#1F1F1F] bg-black/50 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/internships" className="flex items-center gap-2 text-[#777] hover:text-white transition-colors">
              <ArrowLeft size={16} />
              Back to Internships
            </Link>
            <Link href="/" className="flex items-center font-mono">
              <span className="text-white font-bold text-lg">InternOS</span>
              <span className="text-white font-bold text-lg animate-blink">|</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/5 border border-[#1F1F1F] rounded-full px-3 py-1.5">
              <span className="text-xs text-[#999]">Free Plan</span>
            </div>
            <Link
              href="/auth/signout"
              className="text-sm text-[#777] hover:text-white transition-colors cursor-pointer"
            >
              Sign out
            </Link>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-[800px] mx-auto px-6 py-10">
        {/* Company header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl flex items-center justify-center">
            <span className="text-[#3B82F6] font-bold text-2xl">
              {internship.company.charAt(0)}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{internship.company}</h1>
            <h2 className="text-xl text-[#777]">{internship.title}</h2>
          </div>
        </div>

        {/* Key details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#777] text-sm mb-2">
              <MapPin size={16} />
              <span>Location</span>
            </div>
            <p className="text-white font-medium">{internship.location}</p>
          </div>

          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#777] text-sm mb-2">
              <DollarSign size={16} />
              <span>Stipend</span>
            </div>
            <p className="text-white font-medium">{internship.stipend}</p>
          </div>

          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#777] text-sm mb-2">
              <Calendar size={16} />
              <span>Duration</span>
            </div>
            <p className="text-white font-medium">{internship.duration}</p>
          </div>
        </div>

        {/* Match score */}
        <div className="bg-gradient-to-r from-[#3B82F6]/10 to-[#3B82F6]/5 border border-[#3B82F6]/20 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target size={24} className="text-[#3B82F6]" />
              <div>
                <p className="text-[#777] text-sm">Your Match Score</p>
                <p className="text-white text-sm">Based on your profile and skills</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-[#3B82F6]">{internship.matchScore}%</p>
              <p className="text-[#777] text-sm">Excellent match</p>
            </div>
          </div>
        </div>

        {/* Job description */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-white mb-4">Job Description</h3>
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-6">
            <div className="prose prose-invert max-w-none">
              {internship.description.split('\n\n').map((paragraph, index) => (
                <p key={index} className="text-[#777] leading-relaxed mb-4 last:mb-0">
                  {paragraph.split('\n').map((line, lineIndex) => (
                    <span key={lineIndex}>
                      {line}
                      {lineIndex < paragraph.split('\n').length - 1 && <br />}
                    </span>
                  ))}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Required skills */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-white mb-4">Required Skills</h3>
          <div className="flex flex-wrap gap-2">
            {internship.requiredSkills.map((skill, index) => (
              <span
                key={index}
                className="bg-[#0D0D0D] border border-[#1F1F1F] text-[#777] px-3 py-1 rounded-full text-sm"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* CTA buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href={`/tailor?jobId=${internship.id}&title=${encodeURIComponent(internship.title)}&company=${encodeURIComponent(internship.company)}&description=${encodeURIComponent(internship.description)}`}
            className="bg-[#3B82F6] text-white font-medium py-4 px-6 rounded-xl hover:bg-[#2563EB] transition-colors flex items-center justify-center gap-2"
          >
            <FileEdit size={20} />
            Tailor My Resume for This Job
          </Link>

          <button
            onClick={handleExternalApply}
            className="bg-[#0D0D0D] border border-[#1F1F1F] text-white font-medium py-4 px-6 rounded-xl hover:border-[#3B82F6] transition-colors flex items-center justify-center gap-2"
          >
            <ExternalLink size={20} />
            Apply Externally
          </button>
        </div>
      </main>
    </div>
  );
}
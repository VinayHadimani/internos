"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, MapPin, DollarSign, Calendar, Target, ExternalLink, FileEdit, Zap } from 'lucide-react';

interface InternshipDetail {
  id: string;
  company: string;
  title: string;
  location: string;
  stipend: string;
  duration: string;
  description: string;
  requiredSkills: string[];
  applyUrl: string;
  deadline: string;
}

export default function InternshipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { isAuthenticated, signOut } = useAuth();
  const [id, setId] = useState<string>('');
  const [internship, setInternship] = useState<InternshipDetail & { needsTranslation?: boolean; originalDescription?: string; originalTitle?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matchScore = Math.floor(Math.random() * 25) + 75;

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;

    try {
      setLoading(true);
      const savedJobStr = sessionStorage.getItem('selectedJob');
      if (savedJobStr) {
        const item = JSON.parse(savedJobStr);
        setInternship({
          id: id,
          company: item.company || '',
          title: item.title || '',
          location: item.location || '',
          stipend: item.stipend || 'Unpaid / Not reported',
          duration: item.duration || 'Not reported',
          description: item.description || '',
          requiredSkills: item.skills || item.requiredSkills || [],
          applyUrl: item.url || item.applyUrl || '',
          deadline: item.deadline || 'Apply ASAP',
          needsTranslation: item.needsTranslation || false,
          originalDescription: item.description,
          originalTitle: item.title,
        });

        if (item.needsTranslation) {
          setTranslating(true);
          Promise.all([
            fetch('/api/translate-job', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: item.title })
            }).then(r => r.json()),
            fetch('/api/translate-job', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: item.description })
            }).then(r => r.json())
          ]).then(([titleData, descData]) => {
            setInternship(prev => prev ? {
              ...prev,
              title: titleData.translated || prev.title,
              description: descData.translated || prev.description,
              needsTranslation: false
            } : prev);
          }).finally(() => {
            setTranslating(false);
          });
        }
      } else {
        setError('Job details not found. Please go back to search.');
      }
    } catch (err) {
      setError('Failed to load internship details');
      console.error('Error fetching internship:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleExternalApply = () => {
    if (internship?.applyUrl) {
      window.open(internship.applyUrl, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !internship) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-lg mb-2">{error || 'Internship not found'}</p>
          <Link href="/internships" className="text-[#3B82F6] text-sm hover:underline">
            Back to Internships
          </Link>
        </div>
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
            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-2 bg-white/5 border border-[#1F1F1F] rounded-full px-3 py-1.5">
                  <Zap size={14} className="text-blue-400 fill-blue-400" />
                  <span className="text-xs text-[#999]">Free Plan</span>
                </div>
                <button onClick={signOut} className="text-sm text-[#777] hover:text-white transition-colors cursor-pointer">
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/" className="bg-[#3B82F6] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#2563EB] transition-colors">
                Sign in
              </Link>
            )}
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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{internship.company}</h1>
              {translating && (
                <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-xs px-2 py-0.5 rounded-lg animate-pulse flex items-center gap-1">
                  Translating...
                </span>
              )}
            </div>
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
                <p className="text-[#777] text-sm">Match Score</p>
                <p className="text-white text-sm">Based on your profile and skills</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-[#3B82F6]">{matchScore}%</p>
              <p className="text-[#777] text-sm">{matchScore >= 80 ? 'Excellent match' : matchScore >= 60 ? 'Good match' : 'Fair match'}</p>
            </div>
          </div>
        </div>

        {/* Job description */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-white mb-4">Job Description</h3>
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-6">
            <div className="text-[#999] leading-relaxed whitespace-pre-line">
              {internship.description}
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
                className="bg-[#0D0D0D] border border-[#1F1F1F] text-[#999] px-3 py-1.5 rounded-full text-sm"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* CTA buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isAuthenticated ? (
            <Link
              href={`/tailor?jobId=${internship.id}&title=${encodeURIComponent(internship.title)}&company=${encodeURIComponent(internship.company)}&description=${encodeURIComponent(internship.description)}`}
              className="bg-[#3B82F6] text-white font-medium py-4 px-6 rounded-xl hover:bg-[#2563EB] transition-colors flex items-center justify-center gap-2"
            >
              <FileEdit size={20} />
              Tailor My Resume for This Job
            </Link>
          ) : (
            <Link
              href="/"
              className="bg-[#3B82F6] text-white font-medium py-4 px-6 rounded-xl hover:bg-[#2563EB] transition-colors flex items-center justify-center gap-2"
            >
              <FileEdit size={20} />
              Sign in to Tailor Resume
            </Link>
          )}

          <button
            onClick={handleExternalApply}
            className="bg-[#0D0D0D] border border-[#1F1F1F] text-white font-medium py-4 px-6 rounded-xl hover:border-[#3B82F6] transition-colors flex items-center justify-center gap-2"
          >
            <ExternalLink size={20} />
            Apply Externally
          </button>
        </div>

        {/* Sign in CTA for non-authenticated users */}
        {!isAuthenticated && (
          <div className="mt-8 bg-gradient-to-r from-blue-600/10 to-blue-500/5 border border-[#3B82F6]/20 rounded-2xl p-6 text-center">
            <p className="text-[#999] mb-3">Want AI-powered resume tailoring for this role?</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[#3B82F6] font-medium hover:text-blue-400 transition-colors"
            >
              Sign in to get started
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

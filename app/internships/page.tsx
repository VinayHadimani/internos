"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Search, MapPin, DollarSign, Target, Zap, Briefcase } from 'lucide-react';

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

// Map database fields to frontend format
function mapInternship(item: any): Internship {
  return {
    id: item.id as string,
    title: item.title as string || '',
    company: item.company as string || '',
    location: item.location as string || '',
    stipend: item.stipend as string || '',
    duration: item.duration as string || '',
    description: item.description as string || '',
    skills: (item.skills_required || item.skills || []) as string[],
    matchScore: item.matchScore || 0,
    externalUrl: (item.external_url || item.externalUrl || '') as string,
    deadline: item.deadline as string || '',
  };
}

export default function InternshipsPage() {
  const { isAuthenticated, signOut } = useAuth();

  const [internships, setInternships] = useState<Internship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchInternships = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/my-internships');
        const data = await response.json();

        if (data.success || Array.isArray(data)) {
          // Map database fields to frontend format
          const mapped = (data.data || data || []).map(mapInternship);

          // Filter for match score > 40
          const filtered = mapped.filter((internship: Internship) => internship.matchScore > 40);

          setInternships(filtered);
        } else {
          setError('Failed to fetch internships');
        }
      } catch (err) {
        setError('Failed to fetch internships');
        console.error('Error fetching internships:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInternships();
  }, []);

  const filteredInternships = internships.filter(internship => {
    const matchesSearch = internship.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         internship.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         internship.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         internship.skills.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white">
        {/* Header */}
        <header className="border-b border-[#1F1F1F] bg-black/50 backdrop-blur-xl sticky top-0 z-30">
          <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center font-mono">
              <span className="text-white font-bold text-lg">InternOS</span>
              <span className="text-white font-bold text-lg animate-blink">|</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-sm text-[#777] hover:text-white transition-colors">Sign in</Link>
              <Link href="/" className="bg-[#3B82F6] text-white text-sm font-medium px-4 py-2 rounded-lg">Get Started</Link>
            </div>
          </div>
        </header>

        <main className="max-w-[1200px] mx-auto px-6 py-10">
          <div className="mb-8">
            <div className="h-9 w-64 bg-[#1F1F1F] rounded-lg animate-pulse mb-2" />
            <div className="h-5 w-96 bg-[#1F1F1F] rounded-lg animate-pulse" />
          </div>
          <div className="h-12 w-full max-w-md bg-[#1F1F1F] rounded-lg animate-pulse mb-6" />
          <p className="text-[#777] text-sm mb-6">Loading internships...</p>

          {/* Skeleton grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl" />
                  <div>
                    <div className="h-5 w-24 bg-[#1F1F1F] rounded mb-2" />
                    <div className="h-4 w-32 bg-[#1F1F1F] rounded" />
                  </div>
                </div>
                <div className="h-6 w-48 bg-[#1F1F1F] rounded mb-4" />
                <div className="flex gap-4 mb-4">
                  <div className="h-4 w-28 bg-[#1F1F1F] rounded" />
                  <div className="h-4 w-16 bg-[#1F1F1F] rounded" />
                </div>
                <div className="flex gap-2 mb-4">
                  <div className="h-5 w-16 bg-[#1F1F1F] rounded-full" />
                  <div className="h-5 w-20 bg-[#1F1F1F] rounded-full" />
                  <div className="h-5 w-14 bg-[#1F1F1F] rounded-full" />
                </div>
                <div className="h-10 w-full bg-[#1F1F1F] rounded-lg mt-auto" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-red-400 text-center">
          <p className="text-lg mb-2">Error loading internships</p>
          <p className="text-sm text-[#777]">{error}</p>
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
            <Link href="/" className="flex items-center font-mono">
              <span className="text-white font-bold text-lg">InternOS</span>
              <span className="text-white font-bold text-lg animate-blink">|</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/internships" className="text-sm text-white font-medium">Internships</Link>
              {isAuthenticated && (
                <>
                  <Link href="/dashboard" className="text-sm text-[#777] hover:text-white transition-colors">Dashboard</Link>
                  <Link href="/tailor" className="text-sm text-[#777] hover:text-white transition-colors">Tailor</Link>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-2 bg-white/5 border border-[#1F1F1F] rounded-full px-3 py-1.5">
                  <Zap size={14} className="text-blue-400 fill-blue-400" />
                  <span className="text-xs text-[#999]">Free Plan</span>
                </div>
                <button
                  onClick={signOut}
                  className="text-sm text-[#777] hover:text-white transition-colors cursor-pointer"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/" className="text-sm text-[#777] hover:text-white transition-colors">
                  Sign in
                </Link>
                <Link
                  href="/"
                  className="bg-[#3B82F6] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#2563EB] transition-colors"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-[1200px] mx-auto px-6 py-10">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
            Find Internships
          </h1>
          <p className="text-[#777]">
            Discover opportunities that match your skills and interests.
            {isAuthenticated && (
              <span className="text-[#3B82F6] ml-1">
                <Link href="/tailor" className="underline hover:text-blue-400">Tailor your resume</Link> for any role.
              </span>
            )}
          </p>
        </div>

        {/* Search bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#777]" />
            <input
              type="text"
              placeholder="Search by title, company, or skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[#0D0D0D] border border-[#1F1F1F] rounded-lg text-white placeholder-[#777] focus:border-[#3B82F6] focus:outline-none"
            />
          </div>
        </div>

        {/* Results count */}
        <p className="text-[#777] text-sm mb-6">
          {filteredInternships.length} internship{filteredInternships.length !== 1 ? 's' : ''} found
        </p>

        {/* Internships grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInternships.map(internship => (
            <div
              key={internship.id}
              className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6 hover:border-[#3B82F6]/50 transition-all duration-300 flex flex-col"
            >
              {/* Company logo and name */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-[#3B82F6] font-bold text-lg">
                    {internship.company.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="text-white font-semibold">{internship.company}</h3>
                  <p className="text-[#777] text-sm">{internship.location}</p>
                </div>
              </div>

              {/* Job title */}
              <h4 className="text-white font-bold text-lg mb-2">{internship.title}</h4>

              {/* Details */}
              <div className="flex items-center gap-4 mb-4 text-[#777] text-sm">
                <span className="flex items-center gap-1">
                  <DollarSign size={14} />
                  {internship.stipend}
                </span>
                <span>{internship.duration}</span>
              </div>

              {/* Match score */}
              <div className="flex items-center gap-2 mb-4">
                <Target size={16} className="text-[#3B82F6]" />
                <span className="text-sm text-[#777]">Match</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  internship.matchScore >= 80 ? 'bg-green-500/10 text-green-400' :
                  internship.matchScore >= 60 ? 'bg-yellow-500/10 text-yellow-400' :
                  'bg-orange-500/10 text-orange-400'
                }`}>
                  {internship.matchScore}%
                </span>
              </div>

              {/* Skills */}
              <div className="flex flex-wrap gap-1.5 mb-4 flex-1">
                {internship.skills.slice(0, 4).map((skill, i) => (
                  <span key={i} className="bg-white/5 text-[#999] text-xs px-2 py-0.5 rounded-full">
                    {skill}
                  </span>
                ))}
                {internship.skills.length > 4 && (
                  <span className="text-[#555] text-xs">+{internship.skills.length - 4}</span>
                )}
              </div>

              {/* CTA */}
              <div className="flex gap-2 mt-auto">
                <Link
                  href={`/internships/${internship.id}`}
                  className="flex-1 bg-[#3B82F6] text-white text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-[#2563EB] transition-colors text-center"
                >
                  View Details
                </Link>
                {internship.externalUrl && (
                  <a
                    href={internship.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white/5 border border-white/10 text-white text-sm py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <Briefcase size={16} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {filteredInternships.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search size={24} className="text-[#777]" />
            </div>
            <p className="text-[#777] text-lg mb-2">No internships found</p>
            <p className="text-[#555] text-sm">Try adjusting your search or filters</p>
          </div>
        )}

        {/* CTA for non-authenticated users */}
        {!isAuthenticated && (
          <div className="mt-12 bg-gradient-to-r from-blue-600/10 to-blue-500/5 border border-[#3B82F6]/20 rounded-2xl p-8 text-center">
            <h3 className="text-xl font-bold text-white mb-2">Want to tailor your resume?</h3>
            <p className="text-[#777] mb-6">Sign in to use AI-powered resume tailoring for any internship.</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-[#3B82F6] text-white font-medium px-6 py-3 rounded-xl hover:bg-[#2563EB] transition-colors"
            >
              Sign in to Get Started
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

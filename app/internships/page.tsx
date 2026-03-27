"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Search, MapPin, DollarSign, Target } from 'lucide-react';

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

export default function InternshipsPage() {
  const { isAuthenticated, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [internships, setInternships] = useState<Internship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    const fetchInternships = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/internships');
        const data = await response.json();

        if (data.success) {
          setInternships(data.data);
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

    if (isAuthenticated) {
      fetchInternships();
    }
  }, [isAuthenticated]);

  const filteredInternships = internships.filter(internship => {
    const matchesSearch = internship.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         internship.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         internship.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         internship.skills.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
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
            <Link href="/dashboard" className="flex items-center gap-2 text-[#777] hover:text-white transition-colors">
              <ArrowLeft size={16} />
              Back to Dashboard
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
            <button
              onClick={signOut}
              className="text-sm text-[#777] hover:text-white transition-colors cursor-pointer"
            >
              Sign out
            </button>
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
          </p>
        </div>

        {/* Search bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#777]" />
            <input
              type="text"
              placeholder="Search internships..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[#0D0D0D] border border-[#1F1F1F] rounded-lg text-white placeholder-[#777] focus:border-[#3B82F6] focus:outline-none"
            />
          </div>
        </div>

        {/* Internships grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInternships.map(internship => (
            <div
              key={internship.id}
              className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6 hover:border-[#3B82F6]/50 transition-all duration-300"
            >
              {/* Company logo and name */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-[#3B82F6] font-bold text-lg">
                    {internship.company.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{internship.company}</h3>
                </div>
              </div>

              {/* Job title */}
              <h4 className="text-white font-semibold mb-3">{internship.title}</h4>

              {/* Location and stipend */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1 text-[#777] text-sm">
                  <MapPin size={14} />
                  <span>{internship.location}</span>
                </div>
                <div className="flex items-center gap-1 text-[#777] text-sm">
                  <DollarSign size={14} />
                  <span>{internship.stipend}</span>
                </div>
              </div>

              {/* Match score */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-[#3B82F6]" />
                  <span className="text-sm text-[#777]">Match</span>
                  <span className="bg-[#3B82F6]/10 text-[#3B82F6] px-2 py-1 rounded-full text-xs font-medium">
                    {internship.matchScore}%
                  </span>
                </div>
              </div>

              {/* View button */}
              <Link
                href={`/internships/${internship.id}`}
                className="w-full bg-[#3B82F6] text-white font-medium py-2 px-4 rounded-lg hover:bg-[#2563EB] transition-colors text-center block"
              >
                View
              </Link>
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
      </main>
    </div>
  );
}
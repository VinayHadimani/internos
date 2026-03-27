"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { FileEdit, Search, ArrowRight, Zap, Eye, User } from 'lucide-react';

export default function DashboardPage() {
  const { user, isAuthenticated, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

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
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/profile"
              className="flex items-center gap-2 text-[#777] hover:text-white transition-colors"
            >
              <User size={16} />
              Profile
            </Link>
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
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-[1200px] mx-auto px-6 py-10">
        {/* Welcome section */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Welcome back, <span className="text-[#3B82F6]">{displayName}</span>
          </h1>
          <p className="text-[#777] mt-2">Here&apos;s your internship search at a glance.</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            { label: 'Resumes', value: '0' },
            { label: 'Tailors Used', value: '0/2' },
            { label: 'Applications', value: '0' },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6"
            >
              <span className="text-sm text-[#777]">{stat.label}</span>
              <p className="text-3xl font-bold text-white font-mono mt-2">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <Link
            href="/tailor"
            className="group bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 hover:border-[#3B82F6]/50 transition-all duration-300"
          >
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 shadow-inner flex items-center justify-center mb-6">
              <FileEdit size={24} className="text-[#3B82F6]" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Tailor My Resume</h2>
            <p className="text-[#777] text-[15px] leading-relaxed mb-6">
              Paste a job description and let AI rewrite your resume with the perfect keywords for ATS.
            </p>
            <span className="inline-flex items-center gap-2 text-[#3B82F6] text-sm font-medium group-hover:gap-3 transition-all">
              Start tailoring <ArrowRight size={16} />
            </span>
          </Link>

          <Link
            href="/internships"
            className="group bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 hover:border-[#3B82F6]/50 transition-all duration-300"
          >
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 shadow-inner flex items-center justify-center mb-6">
              <Search size={24} className="text-[#3B82F6]" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Find Internships</h2>
            <p className="text-[#777] text-[15px] leading-relaxed mb-6">
              Browse 10,000+ internships matched to your skills and preferences, updated daily.
            </p>
            <span className="inline-flex items-center gap-2 text-[#3B82F6] text-sm font-medium group-hover:gap-3 transition-all">
              Browse listings <ArrowRight size={16} />
            </span>
          </Link>

          <Link
            href="/tracker"
            className="group bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 hover:border-[#3B82F6]/50 transition-all duration-300"
          >
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 shadow-inner flex items-center justify-center mb-6">
              <Eye size={24} className="text-[#3B82F6]" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Track Applications</h2>
            <p className="text-[#777] text-[15px] leading-relaxed mb-6">
              Monitor your internship applications, interviews, and offers all in one place.
            </p>
            <span className="inline-flex items-center gap-2 text-[#3B82F6] text-sm font-medium group-hover:gap-3 transition-all">
              View tracker <ArrowRight size={16} />
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}

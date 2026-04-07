"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { FileEdit, Search, ArrowRight, Zap, Eye, User, Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { user, isAuthenticated, loading, signOut } = useAuth();
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function handleSearchJobs() {
    if (!user?.id) {
      setSearchError('User not authenticated');
      return;
    }

    setSearching(true);
    setSearchError(null);
    try {
      const supabase = createClient();
      
      // 1. Fetch the latest resume text
      const { data: resumeData, error: resumeError } = await supabase
        .from('resumes')
        .select('original_text')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (resumeError || !resumeData || !(resumeData as any).original_text) {
        setSearchError('No resume found. Please upload a resume in your profile first.');
        setSearching(false);
        return;
      }

      // 2. Fetch user skills for better ranking
      const { data: profileData } = await supabase
        .from('profiles')
        .select('skills')
        .eq('id', user.id)
        .single();

      const res = await fetch('/api/internships/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          resumeText: (resumeData as any).original_text,
          userId: user.id,
          userSkills: (profileData as any)?.skills || []
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data || []);
      } else {
        setSearchError(data.error || 'Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Failed to connect to search service');
    } finally {
      setSearching(false);
    }
  }

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

         {/* Job Search Section - Moved for better prominence */}
         <div className="mb-10 p-6 bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
             <div>
               <h2 className="text-xl font-bold text-white">Smart Job Matching</h2>
               <p className="text-[#777] text-sm">Find internships that perfectly match your resume using AI.</p>
             </div>
             <button 
               onClick={handleSearchJobs} 
               disabled={searching}
               className="bg-[#3B82F6] hover:bg-blue-600 disabled:bg-blue-800 text-white px-6 py-2.5 rounded-lg font-medium transition-all flex items-center justify-center w-full md:w-auto"
             >
               {searching ? (
                 <>
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   Searching...
                 </>
               ) : (
                 <>
                   🔍 Find Jobs For My Resume
                 </>
               )}
             </button>
           </div>

           {searchError && (
             <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded mb-4 text-sm">
               {searchError}
             </div>
           )}

           {searchResults.length > 0 && (
             <div className="space-y-3 mt-6">
               <h3 className="font-semibold text-lg text-white">Jobs Matched For You ({searchResults.length})</h3>
               <div className="grid grid-cols-1 gap-3">
                 {searchResults.map((job, i) => (
                   <div key={i} className="border border-[#1F1F1F] bg-black/20 rounded-lg p-4 hover:shadow-md transition text-white">
                     <div className="flex justify-between items-start">
                       <div className="flex-1">
                         <h4 className="font-semibold">{job.title}</h4>
                         <p className="text-[#777] text-sm">{job.company}</p>
                         <p className="text-xs text-[#555]">{job.location}</p>
                         {job.skills?.length > 0 && (
                           <div className="flex gap-1 mt-2 flex-wrap">
                             {job.skills.slice(0, 5).map((skill: string, j: number) => (
                               <span key={j} className="text-xs bg-[#1F1F1F] text-[#999] px-2 py-1 rounded">
                                 {skill}
                               </span>
                             ))}
                           </div>
                         )}
                       </div>
                       <div className="text-right ml-4">
                         <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                           job.matchScore >= 80 ? 'bg-green-500/20 text-green-400' :
                           job.matchScore >= 60 ? 'bg-blue-500/20 text-blue-400' :
                           job.matchScore >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                           'bg-gray-500/20 text-gray-400'
                         }`}>
                           {job.matchScore}% {job.matchLabel}
                         </span>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           )}
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

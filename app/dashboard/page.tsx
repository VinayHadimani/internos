"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Upload, Briefcase, FileText, ArrowRight, Loader2, Zap, User } from 'lucide-react';
import { extractSkillsFromResume } from '@/lib/ai';

export default function DashboardPage() {
  const { user, isAuthenticated, loading, signOut } = useAuth();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [resumeText, setResumeText] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    const saved = localStorage.getItem('resumeText');
    if (saved) setResumeText(saved);
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      setResumeText(text);
      localStorage.setItem('resumeText', text);
      
      const extracted = await extractSkillsFromResume(text);
      if (extracted.location) {
        localStorage.setItem('userLocation', extracted.location);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  }

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
            <Link href="/dashboard" className="flex items-center font-mono">
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
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Welcome back, <span className="text-[#3B82F6]">{displayName}</span>
          </h1>
          <p className="text-[#777] mt-2">Your AI-powered internship discovery platform</p>
        </div>

        {/* Resume Section */}
        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-2 text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#3B82F6]" />
            Your Resume
          </h2>

          {resumeText ? (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-green-400">✓ Resume uploaded</span>
                <span className="text-[#555] text-sm">({resumeText.length} characters)</span>
              </div>

              <div className="flex gap-3">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-2 bg-[#0D0D0D] border border-[#1F1F1F] text-white font-medium py-2 px-4 rounded-lg hover:border-[#3B82F6] transition-colors text-sm">
                    <Upload className="h-4 w-4" />
                    Replace
                  </span>
                  <input
                    type="file"
                    accept=".txt,.pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleUpload}
                  />
                </label>

                <Link href="/internships">
                  <span className="inline-flex items-center gap-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm cursor-pointer">
                    Find Internships
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[#777] mb-4">
                Upload your resume to get personalized internship matches
              </p>

              <label className="inline-flex items-center gap-2 bg-[#3B82F6] hover:bg-[#2563EB] px-4 py-2 rounded-lg cursor-pointer transition text-sm font-medium text-white">
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload Resume
                  </>
                )}
                <input
                  type="file"
                  accept=".txt,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/internships" className="block">
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 hover:border-[#3B82F6]/50 transition-all duration-300 group">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 shadow-inner flex items-center justify-center mb-6">
                <Briefcase size={24} className="text-[#3B82F6]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Find Internships</h3>
              <p className="text-[#777] text-[15px] leading-relaxed mb-6">
                Discover internships matched to your skills
              </p>
              <span className="inline-flex items-center gap-2 text-[#3B82F6] text-sm font-medium group-hover:gap-3 transition-all">
                Browse listings <ArrowRight size={16} />
              </span>
            </div>
          </Link>

          <Link href="/tailor" className="block">
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 hover:border-[#3B82F6]/50 transition-all duration-300 group">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 shadow-inner flex items-center justify-center mb-6">
                <FileText size={24} className="text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Tailor Resume</h3>
              <p className="text-[#777] text-[15px] leading-relaxed mb-6">
                Customize your resume for specific jobs
              </p>
              <span className="inline-flex items-center gap-2 text-[#3B82F6] text-sm font-medium group-hover:gap-3 transition-all">
                Start tailoring <ArrowRight size={16} />
              </span>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
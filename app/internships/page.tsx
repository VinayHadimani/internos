"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Upload, ExternalLink, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { extractSkillsFromResume } from '@/lib/ai';

interface Job {
  title: string;
  company: string;
  location: string;
  description: string;
  skills: string[];
  url: string;
  source: string;
  matchScore: number;
  matchLabel: string;
  locationMatch?: boolean;
  apply_priority?: string;
  red_flags?: string[];
  why_apply?: string;
}

const PAGE_SIZE = 25;

export default function InternshipsPage() {
  const { isAuthenticated, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Derived pagination state
  const totalPages = Math.max(1, Math.ceil(allJobs.length / PAGE_SIZE));
  const pageJobs = allJobs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset page when jobs change
  useEffect(() => {
    setCurrentPage(1);
  }, [allJobs]);

  useEffect(() => {
    // Clean up when leaving the page
    return () => {
      setAllJobs([]);
    };
  }, []);

  useEffect(() => {
    const savedResume = localStorage.getItem('resumeText');
    if (savedResume) {
      setResumeText(savedResume);
      setAllJobs([]);
      searchJobs(savedResume);
    }
  }, [pathname]);

  function handleJobClick(job: Job) {
    sessionStorage.setItem('selectedJob', JSON.stringify(job));
    router.push(`/internships/${Date.now()}`);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      let text = '';

      if (file.name.endsWith('.pdf')) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/parse-resume', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error('PDF parsing failed');
        const data = await res.json();
        text = data.text || '';
      } else {
        text = await file.text();
      }

      if (!text || text.length < 50) {
        setError('Could not read enough text from the file.');
        return;
      }
      
      setResumeText(text);
      localStorage.setItem('resumeText', text);
      setAllJobs([]);

      const extracted = await extractSkillsFromResume(text);
      localStorage.setItem('userSkills', JSON.stringify(extracted.skills || []));
      localStorage.setItem('userExperience', extracted.experienceLevel || 'fresher');
      localStorage.setItem('userRoles', JSON.stringify(extracted.roleTypes || []));
      localStorage.setItem('userLocation', extracted.location || 'India');

      await searchJobs(text);
    } catch (err) {
      setError('Failed to read resume file: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }

  async function searchJobs(text: string) {
    setLoading(true);
    setError(null);

    try {
      const userLocation = localStorage.getItem('userLocation') || '';
      const userSkills = JSON.parse(localStorage.getItem('userSkills') || '[]');
      const userExperience = localStorage.getItem('userExperience') || 'fresher';
      const userRoles = JSON.parse(localStorage.getItem('userRoles') || '[]');

      const primarySkill =
        (Array.isArray(userSkills) && userSkills.length > 0 && String(userSkills[0])) ||
        'software developer';

      const res = await fetch(`/api/internships/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          resumeText: text,
          location: userLocation,
          skills: userSkills,
          experience: userExperience,
          preferredRoles: userRoles,
          query: primarySkill,
        })
      });

      const data = await res.json();

      if (data.success) {
        const filteredJobs = data.jobs || data.data || [];
        setAllJobs(filteredJobs);
        setSkills(data.detected_skills || userSkills || []);
      } else {
        setError(data.error || 'Failed to search jobs');
      }
    } catch (err) {
      setError('Failed to connect to search service');
    } finally {
      setLoading(false);
    }
  }

  function handleRefresh() {
    if (resumeText) {
      setAllJobs([]);
      setCurrentPage(1);
      searchJobs(resumeText);
    }
  }

  // Upload prompt (no resume)
  if (!resumeText && !loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white">
        {/* Header */}
        <header className="border-b border-[#1F1F1F] bg-black/50 backdrop-blur-xl sticky top-0 z-30">
          <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center font-mono">
              <span className="text-white font-bold text-lg">InternOS</span>
              <span className="text-white font-bold text-lg animate-blink">|</span>
            </Link>
            {isAuthenticated && (
              <button onClick={signOut} className="text-sm text-[#777] hover:text-white transition-colors cursor-pointer">Sign out</button>
            )}
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-6 pt-24 text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Find Your Perfect Internship</h1>
          <p className="text-[#777] mb-8">Upload your resume to discover internships that match your skills</p>

          <label className="inline-flex items-center gap-2 bg-[#3B82F6] hover:bg-[#2563EB] px-6 py-3 rounded-lg cursor-pointer transition text-lg font-medium text-white">
            <Upload className="h-5 w-5" />
            Upload Your Resume
            <input type="file" accept=".txt,.pdf,.doc,.docx" className="hidden" onChange={handleUpload} />
          </label>

          <p className="text-[#555] text-sm mt-4">Supports: .txt, .pdf, .doc, .docx</p>
        </main>
      </div>
    );
  }

  function getJobTypeBadge(title: string) {
    const lowerTitle = (title || '').toLowerCase();
    if (lowerTitle.includes('intern')) return { text: 'Internship', bgColor: 'bg-blue-500/10', textColor: 'text-blue-400', border: 'border-blue-500/20' };
    if (lowerTitle.includes('junior') || lowerTitle.includes('entry')) return { text: 'Entry Level', bgColor: 'bg-green-500/10', textColor: 'text-green-400', border: 'border-green-500/20' };
    if (lowerTitle.includes('senior') || lowerTitle.includes('lead')) return { text: 'Senior', bgColor: 'bg-purple-500/10', textColor: 'text-purple-400', border: 'border-purple-500/20' };
    return { text: 'Job', bgColor: 'bg-gray-500/10', textColor: 'text-gray-400', border: 'border-gray-500/20' };
  }

  function getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  // Main view (has resume)
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <header className="border-b border-[#1F1F1F] bg-black/50 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center font-mono">
            <span className="text-white font-bold text-lg">InternOS</span>
            <span className="text-white font-bold text-lg animate-blink">|</span>
          </Link>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <button onClick={signOut} className="text-sm text-[#777] hover:text-white transition-colors cursor-pointer">Sign out</button>
            ) : (
              <Link href="/" className="text-sm text-[#777] hover:text-white transition-colors">Sign in</Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-10">
        {/* Title bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Jobs & Internships for You</h1>
            {skills.length > 0 && (
              <p className="text-[#777]">
                Based on your skills: {skills.slice(0, 5).join(', ')}
                {skills.length > 5 && ` +${skills.length - 5} more`}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 bg-[#0D0D0D] border border-[#1F1F1F] text-white font-medium py-2 px-4 rounded-lg hover:border-[#3B82F6] transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Refresh Search
            </button>

            <label className="cursor-pointer">
              <span className="flex items-center gap-2 bg-[#0D0D0D] border border-[#1F1F1F] text-white font-medium py-2 px-4 rounded-lg hover:border-[#3B82F6] transition-colors">
                <Upload className="h-4 w-4" />
                Change Resume
              </span>
              <input type="file" accept=".txt,.pdf,.doc,.docx" className="hidden" onChange={handleUpload} />
            </label>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg mb-6">{error}</div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex items-center mb-4">
              <Loader2 className="h-8 w-8 animate-spin mr-3 text-[#3B82F6]" />
              <span className="text-xl text-[#777]">Searching for matching internships...</span>
            </div>
            <span className="text-[#555] text-sm text-center max-w-sm">Please don't refresh, just wait until your internships are found.</span>
          </div>
        )}

        {/* Results */}
        {!loading && allJobs.length > 0 && (
          <div>
            <p className="text-[#777] text-sm mb-6">
              Found {allJobs.length} jobs and internships for you
              {totalPages > 1 && ` — Page ${currentPage} of ${totalPages}`}
            </p>

            <div className="space-y-4">
              {pageJobs.map((job, i) => {
                const globalIndex = (currentPage - 1) * PAGE_SIZE + i + 1;
                return (
                  <div
                    key={`${job.title}-${job.company}-${globalIndex}`}
                    onClick={() => handleJobClick(job)}
                    className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6 hover:border-[#3B82F6]/50 transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        {/* Rank number + Title */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-[#555] font-mono w-6">#{globalIndex}</span>
                          <h3 className="text-xl font-semibold text-white">{job.title}</h3>
                          {(() => {
                             const badge = getJobTypeBadge(job.title);
                             return (
                               <span className={`text-xs font-medium px-2 py-0.5 rounded-lg border ${badge.bgColor} ${badge.textColor} ${badge.border}`}>
                                 {badge.text}
                               </span>
                             );
                           })()}
                        </div>
                        <p className="text-[#777]">{job.company}</p>
                        {job.location && <p className="text-[#555] text-sm">{job.location}</p>}

                        {job.description && (
                          <p className="text-[#777] text-sm mt-3 line-clamp-2">{job.description}</p>
                        )}

                        {job.skills?.length > 0 && (
                          <div className="flex gap-1.5 mt-3 flex-wrap">
                            {job.skills.slice(0, 6).map((skill, j) => (
                              <span key={j} className="bg-white/5 text-[#999] text-xs px-2 py-0.5 rounded-full">{skill}</span>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          {job.locationMatch && (
                            <span className="text-xs font-medium px-2 py-1 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">📍 Location Match</span>
                          )}
                          {((job.location || '').toLowerCase().includes('india') || 
                            (job.location || '').toLowerCase().includes('remote') || 
                            (job.location || '').toLowerCase().includes('bangalore') || 
                            (job.location || '').toLowerCase().includes('mumbai') || 
                            (job.location || '').toLowerCase().includes('delhi') || 
                            (job.location || '').toLowerCase().includes('pune') || 
                            (job.location || '').toLowerCase().includes('chennai') || 
                            (job.location || '').toLowerCase().includes('hyderabad')) ? (
                            <span className="text-xs font-medium px-2 py-1 bg-orange-500/10 text-orange-400 rounded-lg border border-orange-500/20">🇮🇳 India</span>
                          ) : (
                            <span className="text-xs font-medium px-2 py-1 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/20">🌍 International</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-3 mt-4 md:mt-0">
                        <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                          job.matchScore >= 70 ? 'bg-green-100 text-green-700' :
                          job.matchScore >= 50 ? 'bg-yellow-100 text-yellow-700' :
                          job.matchScore >= 30 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {job.matchScore}% match
                        </span>

                        {job.url && (
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 bg-[#3B82F6] text-white text-sm font-medium py-2 px-4 rounded-lg hover:bg-[#2563EB] transition-colors"
                          >
                            Apply <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 bg-[#0D0D0D] border border-[#1F1F1F] text-white py-2 px-3 rounded-lg hover:border-[#3B82F6] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} /> Prev
                </button>

                {getPageNumbers().map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      page === currentPage
                        ? 'bg-[#3B82F6] text-white'
                        : 'bg-[#0D0D0D] border border-[#1F1F1F] text-[#999] hover:border-[#3B82F6] hover:text-white'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 bg-[#0D0D0D] border border-[#1F1F1F] text-white py-2 px-3 rounded-lg hover:border-[#3B82F6] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* No results */}
        {!loading && allJobs.length === 0 && !error && resumeText && (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-[#777]" />
            </div>
            <p className="text-[#777] text-lg mb-2">No matching internships found.</p>
            <p className="text-[#555] text-sm">
              Try uploading a more detailed resume with your skills and experience, or check back soon for new listings.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
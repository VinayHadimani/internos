"use client";

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import {
  FileEdit, Upload, ArrowLeft, Zap, AlertCircle, Target,
  Lightbulb, Briefcase, GraduationCap, FolderGit2, Check, X,
  Download, Copy, Mail, Phone, MapPin, FileText
} from 'lucide-react';

interface TailoredResume {
  summary: string;
  experience: { title: string; company: string; duration: string; bullets: string[] }[];
  education: { degree: string; college: string; year: string; details: string }[];
  skills: { matched: string[]; missing: string[] };
  projects: { name: string; description: string; tech: string[] }[];
}

interface TailorResult {
  matchScore: number;
  tailoredResume: TailoredResume;
  suggestions: string[];
}

function ScoreCircle({ score }: { score: number }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  const label = score >= 80 ? 'Excellent match' : score >= 60 ? 'Good match' : 'Needs improvement';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#1F1F1F" strokeWidth="10" />
          <circle
            cx="80" cy="80" r={radius} fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold font-mono" style={{ color }}>{score}</span>
          <span className="text-[#777] text-sm mt-1">%</span>
        </div>
      </div>
      <p className="text-white font-medium mt-4">Your resume matches</p>
      <p className="text-[#999] text-sm">{label}</p>
    </div>
  );
}

function TailorContent() {
  const { isAuthenticated, loading, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<TailorResult | null>(null);
  const [error, setError] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobCompany, setJobCompany] = useState('');
  const [isLoadingJob, setIsLoadingJob] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const resumeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const desc = searchParams.get('description');
    const title = searchParams.get('title');
    const company = searchParams.get('company');
    const jobId = searchParams.get('jobId');

    if (desc) setJobDescription(decodeURIComponent(desc));
    if (title) setJobTitle(decodeURIComponent(title));
    if (company) setJobCompany(decodeURIComponent(company));

    if (jobId && !desc) {
      setIsLoadingJob(true);
      fetch(`/api/internships/${jobId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setJobDescription(data.data.description || '');
            if (!title) setJobTitle(data.data.title || '');
            if (!company) setJobCompany(data.data.company || '');
          }
        })
        .catch(err => console.error('Failed to fetch internship:', err))
        .finally(() => setIsLoadingJob(false));
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/');
  }, [isAuthenticated, loading, router]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
      setError('Please upload a PDF or DOCX file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }
    setResumeFile(file);
    setError('');
    setResumeText('');
    if (file.type === 'application/pdf') {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/parse-resume', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to parse PDF');
        setResumeText(result.text);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse PDF');
        setResumeFile(null);
      }
    } else {
      setResumeText('DOCX parsing not implemented yet.');
    }
  };

  const handleTailor = async () => {
    if (!resumeText || !jobDescription) return;
    setIsProcessing(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, jobDescription }),
      });
      if (!response.ok) throw new Error('Failed to tailor resume');
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const r = result.tailoredResume;
    const text = `${r.summary}\n\nEXPERIENCE\n${r.experience.map(e => `${e.title} at ${e.company} (${e.duration})\n${e.bullets.map(b => `• ${b}`).join('\n')}`).join('\n\n')}\n\nEDUCATION\n${r.education.map(e => `${e.degree} - ${e.college} (${e.year})`).join('\n')}\n\nSKILLS\nMatched: ${r.skills.matched.join(', ')}\nMissing: ${r.skills.missing.join(', ')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPDF = async () => {
    if (!resumeRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;

      const canvas = await html2canvas(resumeRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('tailored-resume.pdf');
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const isFormValid = resumeText && jobDescription;

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-white">Loading...</div>
    </div>
  );
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-[#1F1F1F] bg-black/50 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2 text-[#777] hover:text-white transition-colors">
              <ArrowLeft size={16} /> Back to Dashboard
            </Link>
            <Link href="/" className="flex items-center font-mono">
              <span className="text-white font-bold text-lg">InternOS</span>
              <span className="text-white font-bold text-lg animate-blink">|</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/5 border border-[#1F1F1F] rounded-full px-3 py-1.5">
              <Zap size={14} className="text-blue-400 fill-blue-400" />
              <span className="text-xs text-[#999]">Free Plan</span>
            </div>
            <button onClick={signOut} className="text-sm text-[#777] hover:text-white transition-colors cursor-pointer">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-10">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Tailor Your Resume</h1>
          {jobTitle && jobCompany ? (
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-[#3B82F6] px-4 py-2 rounded-lg text-sm font-medium">
                <Briefcase size={16} />
                Tailoring for: {jobTitle} at {jobCompany}
              </div>
            </div>
          ) : (
            <p className="text-[#777]">Upload your resume and paste a job description to get an ATS-optimized version.</p>
          )}
        </div>

        {isLoadingJob ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="ml-3 text-[#999]">Loading job details...</span>
          </div>
        ) : !result ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8">
                <h2 className="text-xl font-bold text-white mb-6">Upload Resume</h2>
                <div className="space-y-4">
                  <label className="block">
                    <div className="border-2 border-dashed border-[#1F1F1F] rounded-xl p-8 text-center cursor-pointer hover:border-[#3B82F6]/50 transition-colors">
                      <Upload size={48} className="mx-auto text-[#777] mb-4" />
                      <p className="text-white font-medium mb-2">{resumeFile ? resumeFile.name : 'Click to upload PDF or DOCX'}</p>
                      <p className="text-[#777] text-sm">Maximum file size: 5MB</p>
                    </div>
                    <input type="file" accept=".pdf,.docx" onChange={handleFileUpload} className="hidden" />
                  </label>
                  {resumeText && (
                    <div className="bg-[#050505] border border-[#1F1F1F] rounded-lg p-4">
                      <p className="text-[#777] text-sm mb-2">Resume Preview:</p>
                      <p className="text-white text-sm line-clamp-3">{resumeText}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8">
                <h2 className="text-xl font-bold text-white mb-6">Job Description</h2>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job description here..."
                  className="w-full h-64 bg-[#050505] border border-[#1F1F1F] rounded-lg p-4 text-white placeholder-[#777] resize-none focus:border-[#3B82F6] focus:outline-none"
                />
              </div>
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-400" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              </div>
            )}
            <div className="flex justify-center">
              <button
                onClick={handleTailor}
                disabled={!isFormValid || isProcessing}
                className="bg-[#3B82F6] text-white font-medium px-8 py-4 rounded-xl text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2563EB] transition-colors flex items-center gap-3"
              >
                {isProcessing ? (
                  <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
                ) : (
                  <><FileEdit size={20} /> Tailor My Resume</>
                )}
              </button>
            </div>
          </>
        ) : (
          /* ═══ RESULTS ═══ */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left sidebar */}
            <div className="space-y-6">
              {/* Match score */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 text-center">
                <ScoreCircle score={result.matchScore} />
              </div>

              {/* Skills */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                <h3 className="text-base font-bold text-white mb-4">Skills Analysis</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-green-400 font-medium mb-2 flex items-center gap-1.5">
                      <Check size={12} /> Matched ({result.tailoredResume.skills.matched.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.tailoredResume.skills.matched.map((s, i) => (
                        <span key={i} className="bg-green-500/10 text-green-400 text-[11px] px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-orange-400 font-medium mb-2 flex items-center gap-1.5">
                      <AlertCircle size={12} /> Missing ({result.tailoredResume.skills.missing.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.tailoredResume.skills.missing.map((s, i) => (
                        <span key={i} className="bg-orange-500/10 text-orange-400 text-[11px] px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Suggestions */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
                <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <Lightbulb size={16} className="text-yellow-400" /> Suggestions
                </h3>
                <ul className="space-y-3">
                  {result.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-[#999] text-sm">
                      <span className="w-5 h-5 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0 text-yellow-400 text-xs font-bold mt-0.5">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button onClick={handleCopy} className="w-full bg-[#0D0D0D] border border-[#1F1F1F] text-white py-3 rounded-xl text-sm font-medium hover:border-[#3B82F6] transition-colors flex items-center justify-center gap-2">
                  <Copy size={16} />
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={downloading}
                  className="w-full bg-[#3B82F6] text-white py-3 rounded-xl text-sm font-medium hover:bg-[#2563EB] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {downloading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating...</>
                  ) : (
                    <><Download size={16} /> Download as PDF</>
                  )}
                </button>
                <button className="w-full bg-white/5 border border-white/10 text-white py-3 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                  <FileText size={16} /> Download as DOCX
                </button>
                <button
                  onClick={() => { setResult(null); setResumeFile(null); setResumeText(''); setJobDescription(''); router.push('/tailor'); }}
                  className="w-full text-[#777] py-2 text-sm hover:text-white transition-colors"
                >
                  Tailor Another Resume
                </button>
              </div>
            </div>

            {/* Resume preview — white background */}
            <div className="lg:col-span-2">
              <div ref={resumeRef} className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* Resume header */}
                <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2d5a87] px-10 py-8 text-white">
                  <h2 className="text-2xl font-bold tracking-tight">Your Tailored Resume</h2>
                  <p className="text-blue-200 text-sm mt-1">Optimized for this role</p>
                </div>

                <div className="px-10 py-8 space-y-8 text-gray-800">
                  {/* Summary */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1e3a5f] mb-3 pb-2 border-b border-gray-200">
                      Professional Summary
                    </h3>
                    <p className="text-[15px] leading-relaxed text-gray-700">{result.tailoredResume.summary}</p>
                  </div>

                  {/* Experience */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1e3a5f] mb-4 pb-2 border-b border-gray-200">
                      Experience
                    </h3>
                    <div className="space-y-6">
                      {result.tailoredResume.experience.map((exp, i) => (
                        <div key={i}>
                          <div className="flex items-baseline justify-between mb-1">
                            <h4 className="font-bold text-gray-900">{exp.title}</h4>
                            <span className="text-gray-500 text-sm">{exp.duration}</span>
                          </div>
                          <p className="text-[#1e3a5f] text-sm font-medium mb-2">{exp.company}</p>
                          <ul className="space-y-1.5">
                            {exp.bullets.map((b, j) => (
                              <li key={j} className="text-gray-600 text-sm flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#1e3a5f] mt-1.5 shrink-0" />
                                {b}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Education */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1e3a5f] mb-4 pb-2 border-b border-gray-200">
                      Education
                    </h3>
                    <div className="space-y-3">
                      {result.tailoredResume.education.map((edu, i) => (
                        <div key={i} className="flex items-baseline justify-between">
                          <div>
                            <h4 className="font-bold text-gray-900">{edu.degree}</h4>
                            <p className="text-gray-600 text-sm">{edu.college}</p>
                            <p className="text-gray-500 text-xs mt-0.5">{edu.details}</p>
                          </div>
                          <span className="text-gray-500 text-sm font-medium">{edu.year}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Projects */}
                  {result.tailoredResume.projects.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1e3a5f] mb-4 pb-2 border-b border-gray-200">
                        Projects
                      </h3>
                      <div className="space-y-4">
                        {result.tailoredResume.projects.map((proj, i) => (
                          <div key={i}>
                            <h4 className="font-bold text-gray-900">{proj.name}</h4>
                            <p className="text-gray-600 text-sm mt-1">{proj.description}</p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {proj.tech.map((t, j) => (
                                <span key={j} className="bg-[#1e3a5f]/10 text-[#1e3a5f] text-xs px-2 py-0.5 rounded font-medium">{t}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Skills */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1e3a5f] mb-4 pb-2 border-b border-gray-200">
                      Skills
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {result.tailoredResume.skills.matched.map((s, i) => (
                        <span key={i} className="bg-[#1e3a5f] text-white text-xs px-3 py-1.5 rounded-full font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function TailorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <TailorContent />
    </Suspense>
  );
}

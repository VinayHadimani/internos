"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { FileEdit, Upload, ArrowLeft, Zap, AlertCircle, Target, Lightbulb } from 'lucide-react';

interface TailorResult {
  matchScore: number;
  tailoredResume: string;
  missingSkills: string[];
  suggestions: string[];
}

export default function TailorPage() {
  const { isAuthenticated, loading, signOut } = useAuth();
  const router = useRouter();

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<TailorResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
      setError('Please upload a PDF or DOCX file');
      return;
    }

    // Check file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setResumeFile(file);
    setError('');
    setResumeText(''); // Clear previous text while processing

    // If it's a PDF, parse it
    if (file.type === 'application/pdf') {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/parse-resume', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to parse PDF');
        }

        setResumeText(result.text);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse PDF');
        setResumeFile(null);
      }
    } else {
      // For DOCX files, show a placeholder for now
      // In a real implementation, you'd need a DOCX parser
      setResumeText('DOCX parsing not implemented yet. Resume content would be extracted here...');
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resumeText,
          jobDescription,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to tailor resume');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const isFormValid = resumeText && jobDescription;

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
        {/* Title */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
            Tailor Your Resume
          </h1>
          <p className="text-[#777]">
            Upload your resume and paste a job description to get an ATS-optimized version.
          </p>
        </div>

        {!result ? (
          <>
            {/* Input sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Resume upload */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8">
                <h2 className="text-xl font-bold text-white mb-6">Upload Resume</h2>

                <div className="space-y-4">
                  <label className="block">
                    <div className="border-2 border-dashed border-[#1F1F1F] rounded-xl p-8 text-center cursor-pointer hover:border-[#3B82F6]/50 transition-colors">
                      <Upload size={48} className="mx-auto text-[#777] mb-4" />
                      <p className="text-white font-medium mb-2">
                        {resumeFile ? resumeFile.name : 'Click to upload PDF or DOCX'}
                      </p>
                      <p className="text-[#777] text-sm">Maximum file size: 5MB</p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  {resumeText && (
                    <div className="bg-[#050505] border border-[#1F1F1F] rounded-lg p-4">
                      <p className="text-[#777] text-sm mb-2">Resume Preview:</p>
                      <p className="text-white text-sm line-clamp-3">{resumeText}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Job description */}
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

            {/* Error message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-400" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Tailor button */}
            <div className="flex justify-center">
              <button
                onClick={handleTailor}
                disabled={!isFormValid || isProcessing}
                className="bg-[#3B82F6] text-white font-medium px-8 py-4 rounded-xl text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2563EB] transition-colors flex items-center gap-3"
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <FileEdit size={20} />
                    Tailor My Resume
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          /* Results */
          <div className="space-y-8">
            {/* Match score */}
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Match Analysis</h2>
                <div className="flex items-center gap-2">
                  <Target size={20} className="text-[#3B82F6]" />
                  <span className="text-2xl font-bold text-[#3B82F6]">{result.matchScore}%</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Missing skills */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <AlertCircle size={18} className="text-orange-400" />
                    Missing Skills
                  </h3>
                  <ul className="space-y-2">
                    {result.missingSkills.map((skill, index) => (
                      <li key={index} className="flex items-center gap-2 text-[#777]">
                        <div className="w-2 h-2 bg-orange-400 rounded-full" />
                        {skill}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Suggestions */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Lightbulb size={18} className="text-green-400" />
                    Suggestions
                  </h3>
                  <ul className="space-y-2">
                    {result.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-center gap-2 text-[#777]">
                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Tailored resume */}
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Tailored Resume</h2>
                <button className="text-[#3B82F6] hover:text-white transition-colors text-sm">
                  Download PDF
                </button>
              </div>

              <div className="bg-[#050505] border border-[#1F1F1F] rounded-lg p-6">
                <pre className="text-white whitespace-pre-wrap font-mono text-sm leading-relaxed">
                  {result.tailoredResume}
                </pre>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setResult(null);
                  setResumeFile(null);
                  setResumeText('');
                  setJobDescription('');
                }}
                className="bg-[#0D0D0D] border border-[#1F1F1F] text-white px-6 py-3 rounded-lg hover:border-[#3B82F6] transition-colors"
              >
                Tailor Another Resume
              </button>
              <Link
                href="/internships"
                className="bg-[#3B82F6] text-white px-6 py-3 rounded-lg hover:bg-[#2563EB] transition-colors"
              >
                Find Matching Internships
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
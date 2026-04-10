'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Download, ArrowLeft, Sparkles, Target, FileText, Check } from 'lucide-react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Component to highlight keywords in the resume text
 */
function HighlightedResume({ text, keywords }: { text: string; keywords: string[] }) {
  if (!keywords || keywords.length === 0) return <pre className="whitespace-pre-wrap font-sans text-sm text-gray-300 leading-relaxed">{text}</pre>;

  // Create a regex to match any of the keywords
  // Escape keywords for regex
  const escapedKeywords = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedKeywords.join('|')})`, 'gi');
  
  const parts = text.split(regex);

  return (
    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-300 leading-relaxed">
      {parts.map((part, i) => 
        regex.test(part) ? (
          <span key={i} className="bg-blue-500/20 text-blue-300 px-0.5 rounded font-bold border-b border-blue-500/30">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </pre>
  );
}

function TailorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeRef = useRef<HTMLDivElement>(null);
  
  const [job, setJob] = useState<any>(null);
  const [resumeText, setResumeText] = useState('');
  const [tailoredResume, setTailoredResume] = useState('');
  const [keywordsMatched, setKeywordsMatched] = useState<string[]>([]);
  const [atsScore, setAtsScore] = useState(0);
  const [isTailoring, setIsTailoring] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const jobId = searchParams.get('jobId');
    const title = searchParams.get('title');
    const company = searchParams.get('company');
    const description = searchParams.get('description');

    if (jobId && title) {
      setJob({
        id: jobId,
        title: title,
        company: company || 'Unknown Company',
        description: description || ''
      });
    } else {
      const jobData = sessionStorage.getItem('selectedJob');
      if (jobData) {
        try {
          setJob(JSON.parse(jobData));
        } catch (e) {
          console.error('Failed to parse selectedJob:', e);
        }
      }
    }
    
    const resume = localStorage.getItem('resumeText');
    if (resume) {
      setResumeText(resume);
    }
  }, [searchParams]);

  async function handleTailorResume() {
    if (!resumeText) {
      setError('No resume found. Please upload your resume first.');
      return;
    }
    
    if (!job) {
      setError('No job selected. Please select a job first.');
      return;
    }
    
    setIsTailoring(true);
    setError('');
    
    try {
      const response = await fetch('/api/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume: resumeText,
          jobDescription: `${job.title}\n${job.company || ''}\n${job.description || ''}`
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.tailoredResume) {
        setTailoredResume(data.tailoredResume);
        setKeywordsMatched(data.keywordsMatched || []);
        setAtsScore(data.atsScore || 85);
      } else {
        setError(data.error || 'Failed to tailor resume');
      }
    } catch (err: any) {
      console.error('Tailor error:', err);
      setError(err.message || 'Failed to tailor resume');
    } finally {
      setIsTailoring(false);
    }
  }

  const handleDownloadPDF = async () => {
    if (!resumeRef.current) return;
    
    setIsExporting(true);
    try {
      const element = resumeRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Tailored_Resume_${job?.company || 'Job'}.pdf`);
    } catch (err) {
      console.error('PDF Generation failed:', err);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTXT = () => {
    if (!tailoredResume) return;
    const blob = new Blob([tailoredResume], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tailored-resume-${job?.company || 'job'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!job) {
    return (
      <div className="container py-8 bg-[#050505] min-h-screen text-white flex flex-col items-center">
        <Alert className="max-w-md bg-gray-900 border-gray-800">
          <AlertDescription className="text-gray-400">
            No job selected. <Link href="/internships" className="underline text-blue-400 font-bold">Browse jobs</Link> to find one to tailor for.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl mx-auto min-h-screen text-white">
      <Link href="/internships" className="flex items-center gap-2 text-gray-400 mb-6 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to jobs
      </Link>

      <Card className="mb-6 border-gray-800 bg-[#0D0D0D]">
        <CardHeader>
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-400" />
            Selected Target
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">{job.title}</h2>
              <p className="text-[#777] font-medium">{job.company}</p>
            </div>
            <Badge variant="outline" className="border-gray-800 text-gray-400">Target Role</Badge>
          </div>
          {job.description && (
            <div className="mt-4 p-4 bg-black/40 rounded-xl border border-gray-800/50 text-sm text-gray-400 leading-relaxed italic">
              "{job.description.substring(0, 300)}..."
            </div>
          )}
        </CardContent>
      </Card>

      {!resumeText && (
        <Alert className="mb-6 border-yellow-600/30 bg-yellow-900/10 text-yellow-500 rounded-xl">
          <AlertDescription className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            No resume profile found. Please upload your resume in the <Link href="/dashboard" className="underline font-bold">dashboard</Link>.
          </AlertDescription>
        </Alert>
      )}

      {!tailoredResume && (
        <div className="flex flex-col gap-4 items-center">
          <Button 
            onClick={handleTailorResume} 
            disabled={isTailoring || !resumeText}
            size="lg"
            className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-900/20 text-lg transition-all active:scale-[0.98]"
          >
            {isTailoring ? (
              <>
                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                Engineering Your Future...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-3" />
                Tailor My Resume with AI
              </>
            )}
          </Button>
          {isTailoring && (
            <p className="text-sm text-blue-400 animate-pulse flex items-center gap-2">
              Our AI is aligning your experience with {job.company}'s requirements...
            </p>
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mt-4 rounded-xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {tailoredResume && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Card className="border-blue-900/20 bg-[#0D0D0D] overflow-hidden">
            <CardHeader className="border-b border-gray-800/50 bg-black/20">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Check className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white text-lg">Optimized Success</CardTitle>
                    <p className="text-xs text-blue-400/70 font-mono uppercase tracking-widest">Job Readiness: {atsScore}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleDownloadTXT} variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                    TXT
                  </Button>
                  <Button 
                    onClick={handleDownloadPDF} 
                    disabled={isExporting}
                    className="bg-white text-black hover:bg-gray-200 font-bold px-6"
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-8 bg-black/40">
                {keywordsMatched.length > 0 && (
                  <div className="mb-6 flex flex-wrap gap-2">
                    <span className="text-xs text-[#777] uppercase tracking-tighter self-center mr-2">Optimized For:</span>
                    {keywordsMatched.map(k => (
                      <Badge key={k} className="bg-blue-500/10 text-blue-400 border-blue-500/20 capitalize font-medium">
                        {k}
                      </Badge>
                    ))}
                  </div>
                )}
                
                <div className="bg-[#050505] border border-gray-800/50 rounded-2xl p-8 shadow-2xl relative">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <FileText className="w-20 h-20 text-white" />
                  </div>
                  <HighlightedResume text={tailoredResume} keywords={keywordsMatched} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hidden element for PDF capture - styled as a real resume */}
          <div className="sr-only">
            <div 
              ref={resumeRef} 
              className="bg-white text-black p-[20mm] w-[210mm] min-h-[297mm] font-serif"
              style={{ position: 'fixed', left: '-9999px', top: 0 }}
            >
              <div className="whitespace-pre-wrap leading-relaxed text-[11pt]">
                {tailoredResume}
              </div>
            </div>
          </div>

          <div className="p-6 bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20 rounded-2xl">
            <h4 className="text-blue-400 font-bold mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Final Step
            </h4>
            <p className="text-sm text-gray-400 leading-relaxed font-medium capitalize">
              This resume has been engineered to trigger {job.company}'s applicant tracking system. Use the PDF version for best results during submission.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TailorPage() {
  return (
    <div className="bg-[#050505] min-h-screen">
      <Suspense fallback={
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      }>
        <TailorContent />
      </Suspense>
    </div>
  );
}

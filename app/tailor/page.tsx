'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Download, ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';

function TailorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [job, setJob] = useState<any>(null);
  const [resumeText, setResumeText] = useState('');
  const [tailoredResume, setTailoredResume] = useState('');
  const [atsScore, setAtsScore] = useState(0);
  const [isTailoring, setIsTailoring] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // 1. Try to load job from URL search params
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
      // 2. Fallback to Load job from sessionStorage
      const jobData = sessionStorage.getItem('selectedJob');
      if (jobData) {
        try {
          setJob(JSON.parse(jobData));
        } catch (e) {
          console.error('Failed to parse selectedJob:', e);
        }
      }
    }
    
    // 3. Load resume from localStorage
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
      
      console.log('=== TAILOR RESPONSE ===');
      console.log('Success:', data.success);
      console.log('Has tailoredResume:', !!data.tailoredResume);
      
      if (data.success && data.tailoredResume) {
        console.log('SET tailoredResume to:', data.tailoredResume.substring(0, 100));
        setTailoredResume(data.tailoredResume);
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

  function handleDownload() {
    if (!tailoredResume) return;
    const blob = new Blob([tailoredResume], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tailored-resume-${job?.company || 'job'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!job) {
    return (
      <div className="container py-8 bg-gray-900 min-h-screen text-white flex flex-col items-center">
        <Alert className="max-w-md">
          <AlertDescription>
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

      <Card className="mb-6 border-gray-800 bg-gray-900/50">
        <CardHeader>
          <CardTitle className="text-white">Selected Job</CardTitle>
        </CardHeader>
        <CardContent>
          <h2 className="text-xl font-bold text-white">{job.title}</h2>
          <p className="text-gray-400">{job.company}</p>
          <p className="text-sm mt-2 text-gray-500">{job.location || 'Remote'}</p>
          {job.description && (
            <div className="mt-4 p-3 bg-black/30 rounded border border-gray-800 text-xs text-gray-400 line-clamp-3">
              {job.description}
            </div>
          )}
        </CardContent>
      </Card>

      {!resumeText && (
        <Alert className="mb-6 border-yellow-600/50 bg-yellow-900/20 text-yellow-500">
          <AlertDescription>
            No resume found. Please <Link href="/dashboard" className="underline font-bold">upload your resume</Link> first.
          </AlertDescription>
        </Alert>
      )}

      {!tailoredResume && (
        <div className="flex flex-col gap-4">
          <Button 
            onClick={handleTailorResume} 
            disabled={isTailoring || !resumeText}
            size="lg"
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold"
          >
            {isTailoring ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Tailoring your resume...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Tailor My Resume
              </>
            )}
          </Button>
          {isTailoring && (
            <p className="text-sm text-blue-400 animate-pulse">
              Our AI is optimizing your resume for this specific role. This usually takes 10-15 seconds.
            </p>
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {tailoredResume && (
        <Card className="mt-6 border-blue-900/30 bg-gray-900">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                Your Tailored Resume
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-600">ATS Score: {atsScore}%</Badge>
                <Button onClick={handleDownload} variant="outline" size="sm" className="border-gray-700 hover:bg-gray-800 text-white">
                  <Download className="w-4 h-4 mr-2" />
                  Download (.txt)
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-black/50 border border-gray-800 rounded-lg p-5">
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-300 leading-relaxed">
                {tailoredResume}
              </pre>
            </div>
            
            <div className="mt-6 p-4 bg-blue-900/10 border border-blue-900/30 rounded-lg">
              <h4 className="text-blue-400 font-bold mb-2 flex items-center gap-2">
                <Target className="w-4 h-4" /> Optimization Tip
              </h4>
              <p className="text-sm text-gray-400 italic">
                This version highlights your relevant experience for {job.company} by mapping your skills directly to their requirements. Use this for your application!
              </p>
            </div>
          </CardContent>
        </Card>
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

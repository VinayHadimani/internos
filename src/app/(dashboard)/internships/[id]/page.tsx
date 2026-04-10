'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, ArrowLeft, Download, AlertCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tailoring, setTailoring] = useState(false);
  const [tailoredResume, setTailoredResume] = useState<string | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function formatJobDescription(description: string): React.ReactNode {
    if (!description) return null;
    
    // Clean the text first
    const cleaned = description
      .replace(/â/g, "'")
      .replace(/â€"/g, '-')
      .replace(/â€"/g, '-')
      .replace(/â€˜/g, "'")
      .replace(/â€œ/g, '"')
      .replace(/â€/g, '"')
      .replace(/Â/g, '')
      .replace(/â/g, '')
      .replace(/â€¢/g, '•')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Split into sections
    const sections = cleaned.split(/\n\n+/);
    
    return (
      <div className="space-y-4">
        {sections.map((section, index) => {
          // Check if it's a bullet list
          if (section.includes('•') || section.includes('- ')) {
            const lines = section.split('\n');
            return (
              <ul key={index} className="list-disc list-inside space-y-1 text-gray-400">
                {lines.map((line, i) => {
                  const cleanLine = line.replace(/^[•\-\s]+/, '').trim();
                  if (cleanLine) {
                    return <li key={i}>{cleanLine}</li>;
                  }
                  return null;
                })}
              </ul>
            );
          }
          
          // Check if it's a heading (short line, possibly all caps)
          if (section.length < 60 && section === section.toUpperCase()) {
            return <h3 key={index} className="text-lg font-bold text-white mt-4">{section}</h3>;
          }
          
          // Regular paragraph
          return <p key={index} className="text-gray-300 leading-relaxed">{section}</p>;
        })}
      </div>
    );
  }

  function downloadResumeAsPDF(resumeText: string, fileName: string) {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Set font
    doc.setFont('helvetica');
    
    // Split text into lines that fit the page width
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxWidth = pageWidth - (margin * 2);
    
    // Process the resume text
    const lines = resumeText.split('\n');
    let yPosition = 20;
    const lineHeight = 6;
    
    for (const line of lines) {
      // Check if it's a header (ALL CAPS with = under it, or just ALL CAPS)
      const isHeader = /^[A-Z\s]+$/.test(line.trim()) && line.trim().length > 0;
      const isSeparator = /^=+$/.test(line.trim());
      
      if (isSeparator) {
        yPosition += 3;
        continue;
      }
      
      if (isHeader) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        yPosition += 5;
      } else if (line.startsWith('•')) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
      } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
      }
      
      // Split long lines
      const splitLines = doc.splitTextToSize(line, maxWidth);
      
      for (const splitLine of splitLines) {
        // Check if we need a new page
        if (yPosition > 280) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.text(splitLine, margin, yPosition);
        yPosition += lineHeight;
      }
    }
    
    // Save the PDF
    doc.save(`${fileName}-tailored-resume.pdf`);
  }

  // Get resume from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('resumeText');
    console.log('Resume from localStorage:', saved ? `${saved.length} chars` : 'NULL');
    if (saved) {
      setResumeText(saved);
    }
  }, []);

  // Get job data from sessionStorage
  useEffect(() => {
    const jobData = sessionStorage.getItem('selectedJob');
    console.log('Job from sessionStorage:', jobData ? 'exists' : 'NULL');
    if (jobData) {
      setJob(JSON.parse(jobData));
    }
    setLoading(false);
  }, [jobId]);

  async function handleTailorResume() {
    console.log('=== TAILOR DEBUG ===');
    console.log('resumeText:', resumeText ? 'exists' : 'NULL');
    console.log('job:', job ? 'exists' : 'NULL');

    if (!resumeText || !job) {
      toast.error('Missing resume or job data');
      return;
    }

    setTailoring(true);
    setTailoredResume(null);
    setError(null);
    
    try {
      const res = await fetch('/api/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume: resumeText,
          jobDescription: `${job.title}\n${job.company}\n${job.location}\n\n${job.description}\n\nRequired Skills: ${job.skills?.join(', ')}`
        })
      });
      
      console.log('[Frontend] Response status:', res.status);
      const data = await res.json();
      console.log('[Frontend] Response data:', data);
      
      if (res.ok && data.success && data.tailoredResume) {
        setTailoredResume(data.tailoredResume);
        setMatchScore(data.atsScore || 85);
        toast.success('Resume tailored successfully!');
      } else {
        const errorMsg = data.error || 'Failed to tailor resume';
        console.error('[Frontend] Error:', errorMsg);
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err: any) {
      console.error('[Frontend] Tailoring failed:', err);
      setError('Network error. Please check your connection and try again.');
      toast.error('Network error occurred');
    } finally {
      setTailoring(false);
    }
  }

  function handleDownload() {
    if (!tailoredResume) return;
    const blob = new Blob([tailoredResume], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tailored_resume_${job?.company || 'job'}.txt`;
    a.click();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <Button onClick={() => router.back()} variant="outline" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div className="bg-yellow-900/30 border border-yellow-600 text-yellow-300 p-3 rounded mb-4">
          ⚠️ Job data not found. Please go back and select a job again.
        </div>
        <p>Job not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <Button onClick={() => router.back()} variant="outline" className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Internships
        </Button>

        {/* Job Header */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">{job.title}</h1>
              <p className="text-gray-300 text-lg mt-1">{job.company}</p>
              <p className="text-gray-500">{job.location}</p>
            </div>
            <div className="text-right">
              <div className={`text-lg font-bold px-4 py-2 rounded-full ${
                job.matchScore >= 80 ? 'bg-green-600/30 text-green-400' :
                job.matchScore >= 60 ? 'bg-blue-600/30 text-blue-400' :
                'bg-yellow-600/30 text-yellow-400'
              }`}>
                {job.matchScore}% {job.matchLabel}
              </div>
            </div>
          </div>

          {/* Skills */}
          {job.skills?.length > 0 && (
            <div className="flex gap-2 mt-4 flex-wrap">
              {job.skills.map((skill: string, i: number) => (
                <Badge key={i} variant="secondary">{skill}</Badge>
              ))}
            </div>
          )}

          {/* Apply Button */}
          <div className="mt-6">
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              <Button size="lg">
                Apply Now <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </a>
          </div>
        </div>

        {/* Job Description */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Job Description</h2>
          {formatJobDescription(job.description)}
        </div>

        {/* Resume Tailoring Section */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Tailor Your Resume for This Job</h2>
          
          {!resumeText && (
            <div className="bg-yellow-900/30 border border-yellow-600 text-yellow-300 p-3 rounded mb-4">
              ⚠️ No resume found. Please upload your resume on the dashboard first.
            </div>
          )}

          {!resumeText ? (
            <p className="text-gray-400">
              Please upload your resume first to tailor it for this job.
            </p>
          ) : (
            <>
              <Button 
                onClick={handleTailorResume} 
                disabled={tailoring}
                size="lg"
                className="mb-4"
              >
                {tailoring ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Tailoring Resume...
                  </>
                ) : (
                  'Tailor My Resume for This Job'
                )}
              </Button>

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <span className="font-bold">Error:</span> {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Tailored Result */}
              {tailoredResume && (
                <div className="mt-6">
                  {matchScore && (
                    <p className="text-green-400 mb-4">
                      ✓ Resume tailored! ATS Score: {matchScore}%
                    </p>
                  )}
                  <div className="bg-gray-900 border border-gray-600 rounded-lg p-4 mb-4 max-h-96 overflow-y-auto">
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                      {tailoredResume}
                    </pre>
                  </div>
                  <Button onClick={() => downloadResumeAsPDF(tailoredResume, job?.company || 'resume')}>
                    <Download className="h-4 w-4 mr-2" />
                    Download as PDF
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
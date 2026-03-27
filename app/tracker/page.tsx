"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Eye } from 'lucide-react';

type ApplicationStatus = 'Saved' | 'Applied' | 'Interview' | 'Offered' | 'Rejected';

interface Application {
  id: string;
  company: string;
  title: string;
  status: ApplicationStatus;
  appliedDate: string;
  internshipId: string;
}

// Mock data for applications
const mockApplications: Application[] = [
  {
    id: '1',
    company: 'Flipkart',
    title: 'Software Engineering Intern',
    status: 'Applied',
    appliedDate: '2024-03-15',
    internshipId: '1'
  },
  {
    id: '2',
    company: 'Razorpay',
    title: 'Frontend Developer Intern',
    status: 'Interview',
    appliedDate: '2024-03-10',
    internshipId: '2'
  },
  {
    id: '3',
    company: 'Meesho',
    title: 'Data Analyst Intern',
    status: 'Saved',
    appliedDate: '2024-03-12',
    internshipId: '3'
  },
  {
    id: '4',
    company: 'CRED',
    title: 'Backend Developer Intern',
    status: 'Rejected',
    appliedDate: '2024-03-08',
    internshipId: '4'
  }
];

const statusTabs: (ApplicationStatus | 'All')[] = ['All', 'Saved', 'Applied', 'Interview', 'Offered', 'Rejected'];

const getStatusColor = (status: ApplicationStatus) => {
  switch (status) {
    case 'Saved':
      return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    case 'Applied':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'Interview':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'Offered':
      return 'bg-green-500/10 text-green-400 border-green-500/20';
    case 'Rejected':
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    default:
      return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

export default function TrackerPage() {
  const { isAuthenticated, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [applications, setApplications] = useState<Application[]>(mockApplications);
  const [selectedStatus, setSelectedStatus] = useState<ApplicationStatus | 'All'>('All');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, authLoading, router]);

  const filteredApplications = applications.filter(app =>
    selectedStatus === 'All' || app.status === selectedStatus
  );

  if (authLoading) {
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
            My Applications
          </h1>
          <p className="text-[#777]">
            Track your internship applications and their progress.
          </p>
        </div>

        {/* Status filter tabs */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2">
            {statusTabs.map(status => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedStatus === status
                    ? 'bg-[#3B82F6] text-white'
                    : 'bg-[#0D0D0D] border border-[#1F1F1F] text-[#777] hover:border-[#3B82F6] hover:text-white'
                }`}
              >
                {status}
                {status !== 'All' && (
                  <span className="ml-2 text-xs opacity-75">
                    ({applications.filter(app => app.status === status).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Applications list */}
        {filteredApplications.length > 0 ? (
          <div className="space-y-4">
            {filteredApplications.map(application => (
              <div
                key={application.id}
                className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6 hover:border-[#3B82F6]/50 transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Company logo placeholder */}
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl flex items-center justify-center">
                      <span className="text-[#3B82F6] font-bold text-lg">
                        {application.company.charAt(0)}
                      </span>
                    </div>

                    {/* Application details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-white">{application.company}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(application.status)}`}>
                          {application.status}
                        </span>
                      </div>
                      <p className="text-[#777] mb-1">{application.title}</p>
                      <p className="text-[#555] text-sm">Applied on {formatDate(application.appliedDate)}</p>
                    </div>
                  </div>

                  {/* View button */}
                  <Link
                    href={`/internships/${application.internshipId}`}
                    className="flex items-center gap-2 bg-[#0D0D0D] border border-[#1F1F1F] text-white font-medium py-2 px-4 rounded-lg hover:border-[#3B82F6] transition-colors"
                  >
                    <Eye size={16} />
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty state */
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Eye size={24} className="text-[#777]" />
            </div>
            <p className="text-[#777] text-lg mb-2">No applications yet</p>
            <p className="text-[#555] text-sm mb-6">Start applying to internships to track your progress!</p>
            <Link
              href="/internships"
              className="bg-[#3B82F6] text-white font-medium py-3 px-6 rounded-lg hover:bg-[#2563EB] transition-colors inline-block"
            >
              Browse Internships
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
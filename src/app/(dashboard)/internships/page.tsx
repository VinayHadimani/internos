'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Briefcase, MapPin, ExternalLink } from 'lucide-react';

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  skills: string[];
  url: string;
  source: string;
  matchScore?: number;
  matchLabel?: string;
}

export default function InternshipsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    setLoading(true);
    
    // Get user data from localStorage
    const userSkills = JSON.parse(localStorage.getItem('userSkills') || '[]');
    const userExperience = localStorage.getItem('userExperience') || 'fresher';
    const userRoles = JSON.parse(localStorage.getItem('userRoles') || '[]');
    const userLocation = localStorage.getItem('userLocation') || 'India';
    
    console.log('=== FETCHING JOBS WITH ===');
    console.log('Skills:', userSkills);
    console.log('Experience:', userExperience);
    console.log('Roles:', userRoles);
    
    try {
      const response = await fetch('/api/internships/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery || 'internship',
          location: userLocation,
          skills: userSkills,
          experience: userExperience,
          preferredRoles: userRoles
        })
      });
      
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleJobClick(job: Job) {
    // Save job to sessionStorage for the detail page
    sessionStorage.setItem('selectedJob', JSON.stringify(job));
    // Navigate to detail page using a timestamp as a simple ID
    router.push(`/internships/${Date.now()}`);
  }

  const filteredJobs = jobs.filter(job => 
    job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Find Internships</h1>
            <p className="text-gray-400 mt-2">Discover and tailor your resume for the best opportunities</p>
          </div>

          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search jobs, companies, or skills..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job, i) => (
            <div 
              key={i}
              onClick={() => handleJobClick(job)}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="bg-blue-600/20 p-2 rounded-lg">
                  <Briefcase className="h-5 w-5 text-blue-400" />
                </div>
                {job.matchScore && (
                  <Badge className="bg-blue-600/30 text-blue-400 border-blue-500/50">
                    {job.matchScore}% Match
                  </Badge>
                )}
              </div>

              <h3 className="text-xl font-semibold mb-1 group-hover:text-blue-400 transition-colors">{job.title}</h3>
              <p className="text-gray-300 mb-3">{job.company}</p>

              <div className="flex items-center text-gray-500 text-sm mb-4">
                <MapPin className="h-3 w-3 mr-1" />
                {job.location}
              </div>

              <div className="flex gap-2 mb-6 flex-wrap">
                {job.skills.slice(0, 3).map((skill, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
                {job.skills.length > 3 && (
                  <span className="text-xs text-gray-500">+{job.skills.length - 3} more</span>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Source: {job.source}</span>
                <div className="flex items-center text-blue-400 text-sm font-medium">
                  View Details <ExternalLink className="h-3 w-3 ml-1" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredJobs.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-400">No internships found matching your search.</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setSearchQuery('')}
            >
              Clear search
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
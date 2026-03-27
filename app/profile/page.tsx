"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, User, Mail, GraduationCap, Phone, Plus, X, Zap, Crown, Save } from 'lucide-react';

interface UserProfile {
  fullName: string;
  collegeName: string;
  phoneNumber: string;
  skills: string[];
}

export default function ProfilePage() {
  const { user, isAuthenticated, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile>({
    fullName: '',
    collegeName: '',
    phoneNumber: '',
    skills: []
  });

  const [newSkill, setNewSkill] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!isAuthenticated) return;

      try {
        setFetchLoading(true);
        const response = await fetch('/api/profile');
        const data = await response.json();

        if (response.ok) {
          setProfile({
            fullName: data.fullName || '',
            collegeName: data.collegeName || '',
            phoneNumber: data.phone || '',
            skills: data.skills || []
          });
        } else {
          console.error('Failed to fetch profile:', data.error);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setFetchLoading(false);
      }
    };

    fetchProfile();
  }, [isAuthenticated]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: profile.fullName,
          collegeName: profile.collegeName,
          phone: profile.phoneNumber,
          skills: profile.skills
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update local state with the response
        setProfile({
          fullName: data.fullName || '',
          collegeName: data.collegeName || '',
          phoneNumber: data.phone || '',
          skills: data.skills || []
        });
        // You could show a success toast here
      } else {
        console.error('Failed to save profile:', data.error);
        // You could show an error toast here
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      // You could show an error toast here
    } finally {
      setLoading(false);
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !profile.skills.includes(newSkill.trim())) {
      setProfile(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setProfile(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  };

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

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const firstLetter = displayName.charAt(0).toUpperCase();

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
      <main className="max-w-[800px] mx-auto px-6 py-10">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
            Profile Settings
          </h1>
          <p className="text-[#777]">
            Manage your account information and preferences.
          </p>
        </div>

        {/* Profile Card */}
        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 mb-8">
          {/* Avatar and Basic Info */}
          <div className="flex items-center gap-6 mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-2xl flex items-center justify-center">
              <span className="text-[#3B82F6] font-bold text-3xl">
                {firstLetter}
              </span>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-1">{displayName}</h2>
              <div className="flex items-center gap-2 text-[#777]">
                <Mail size={16} />
                <span>{user?.email}</span>
              </div>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="space-y-6">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-[#777] mb-2">
                <User size={16} className="inline mr-2" />
                Full Name
              </label>
              <input
                type="text"
                value={profile.fullName}
                onChange={(e) => setProfile(prev => ({ ...prev, fullName: e.target.value }))}
                className="w-full bg-[#050505] border border-[#1F1F1F] rounded-lg px-4 py-3 text-white placeholder-[#777] focus:border-[#3B82F6] focus:outline-none"
                placeholder="Enter your full name"
              />
            </div>

            {/* College Name */}
            <div>
              <label className="block text-sm font-medium text-[#777] mb-2">
                <GraduationCap size={16} className="inline mr-2" />
                College Name
              </label>
              <input
                type="text"
                value={profile.collegeName}
                onChange={(e) => setProfile(prev => ({ ...prev, collegeName: e.target.value }))}
                className="w-full bg-[#050505] border border-[#1F1F1F] rounded-lg px-4 py-3 text-white placeholder-[#777] focus:border-[#3B82F6] focus:outline-none"
                placeholder="Enter your college name"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-medium text-[#777] mb-2">
                <Phone size={16} className="inline mr-2" />
                Phone Number
              </label>
              <input
                type="tel"
                value={profile.phoneNumber}
                onChange={(e) => setProfile(prev => ({ ...prev, phoneNumber: e.target.value }))}
                className="w-full bg-[#050505] border border-[#1F1F1F] rounded-lg px-4 py-3 text-white placeholder-[#777] focus:border-[#3B82F6] focus:outline-none"
                placeholder="Enter your phone number"
              />
            </div>

            {/* Skills Section */}
            <div>
              <label className="block text-sm font-medium text-[#777] mb-3">
                Skills
              </label>

              {/* Skills Pills */}
              <div className="flex flex-wrap gap-2 mb-4">
                {profile.skills.map((skill, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-2 bg-[#3B82F6]/10 border border-[#3B82F6]/20 text-[#3B82F6] px-3 py-1 rounded-full text-sm"
                  >
                    {skill}
                    <button
                      onClick={() => removeSkill(skill)}
                      className="hover:bg-[#3B82F6]/20 rounded-full p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>

              {/* Add Skill Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 bg-[#050505] border border-[#1F1F1F] rounded-lg px-4 py-2 text-white placeholder-[#777] focus:border-[#3B82F6] focus:outline-none text-sm"
                  placeholder="Add a skill..."
                />
                <button
                  onClick={addSkill}
                  disabled={!newSkill.trim()}
                  className="bg-[#3B82F6] text-white px-4 py-2 rounded-lg hover:bg-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Status */}
        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl flex items-center justify-center">
                <Zap size={20} className="text-blue-400 fill-blue-400" />
              </div>
              <div>
                <p className="text-white font-medium">Free Plan</p>
                <p className="text-[#777] text-sm">2/2 tailors remaining</p>
              </div>
            </div>
            <Link
              href="/pricing"
              className="bg-[#3B82F6] text-white font-medium py-2 px-4 rounded-lg hover:bg-[#2563EB] transition-colors flex items-center gap-2"
            >
              <Crown size={16} />
              Upgrade to Pro
            </Link>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-[#3B82F6] text-white font-medium py-3 px-6 rounded-lg hover:bg-[#2563EB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save size={16} />
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </main>
    </div>
  );
}
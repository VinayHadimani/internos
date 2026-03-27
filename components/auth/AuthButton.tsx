"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, AppWindow, User } from 'lucide-react';
import LoginModal from './LoginModal';

export default function AuthButton() {
  const { user, loading, signOut } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="h-10 w-24 bg-white/10 animate-pulse rounded-full border border-white/5" />
    );
  }

  if (!user) {
    return (
      <>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 text-sm font-medium text-white transition-colors bg-[#3B82F6] rounded-full hover:bg-blue-600 shadow-sm"
        >
          Sign in
        </button>
        <LoginModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
        />
      </>
    );
  }

  const userInitial = user.email ? user.email[0].toUpperCase() : 'U';
  const avatarUrl = user.user_metadata?.avatar_url;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 focus:outline-none rounded-full"
      >
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt="User avatar" 
            className="w-10 h-10 rounded-full border border-white/10 object-cover hover:border-blue-500/50 transition-colors"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#3B82F6] flex items-center justify-center text-white font-medium hover:bg-blue-600 transition-colors shadow-sm">
            {userInitial}
          </div>
        )}
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-3 w-56 bg-[#050505] border border-white/10 rounded-xl shadow-2xl py-2 z-50 overflow-hidden text-sm ring-1 ring-white/5">
          <div className="px-4 py-3 mb-1 border-b border-white/10">
            <p className="text-white truncate font-medium">{user.user_metadata?.full_name || 'User'}</p>
            <p className="text-gray-400 truncate text-xs mt-0.5">{user.email}</p>
          </div>
          
          <div className="p-1.5 space-y-0.5">
            <button
              onClick={() => setIsDropdownOpen(false)}
              className="flex items-center w-full gap-2.5 px-3 py-2 text-left text-gray-300 transition-colors rounded-lg hover:bg-white/10 hover:text-white"
            >
              <User size={16} className="text-gray-400" />
              Profile
            </button>
            <button
              onClick={() => setIsDropdownOpen(false)}
              className="flex items-center w-full gap-2.5 px-3 py-2 text-left text-gray-300 transition-colors rounded-lg hover:bg-white/10 hover:text-white"
            >
              <AppWindow size={16} className="text-gray-400" />
              My Applications
            </button>
            <div className="h-px bg-white/10 my-1"></div>
            <button 
              onClick={() => {
                setIsDropdownOpen(false);
                signOut();
              }}
              className="flex items-center w-full gap-2.5 px-3 py-2 text-left text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

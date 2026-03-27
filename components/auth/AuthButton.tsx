"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { User, Kanban, Zap, LogOut } from "lucide-react";
import LoginModal from "./LoginModal";

export default function AuthButton() {
  const { user, loading, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (loading) {
    return <div className="h-9 w-9 rounded-full bg-white/10 animate-pulse" />;
  }

  if (!user) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="px-5 py-2 text-sm font-medium text-white bg-[#3B82F6] rounded-lg hover:bg-blue-600 transition-colors"
        >
          Sign in
        </button>
        <LoginModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  const initial = user.user_metadata?.full_name?.[0]?.toUpperCase()
    || user.email?.[0]?.toUpperCase()
    || "U";
  const avatarUrl = user.user_metadata?.avatar_url;
  const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
  const isFree = true; // TODO: replace with actual plan check from subscriptions table

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar button */}
      <button
        onClick={() => setDropdownOpen((v) => !v)}
        className="flex items-center focus:outline-none rounded-full cursor-pointer"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="w-9 h-9 rounded-full border border-white/10 object-cover hover:border-blue-500/50 transition-colors"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-semibold hover:shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-shadow">
            {initial}
          </div>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {dropdownOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-56 bg-[#0A0A0A] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            {/* User info */}
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <p className="text-white text-sm font-medium truncate">{name}</p>
              <p className="text-[#555] text-xs truncate mt-0.5">{user.email}</p>
            </div>

            {/* Links */}
            <div className="p-1.5">
              <Link
                href="/profile"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#999] hover:text-white hover:bg-white/5 transition-colors"
              >
                <User size={15} className="text-[#555]" />
                Profile
              </Link>

              <Link
                href="/tracker"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#999] hover:text-white hover:bg-white/5 transition-colors"
              >
                <Kanban size={15} className="text-[#555]" />
                My Applications
              </Link>

              {isFree && (
                <Link
                  href="/pricing"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
                >
                  <Zap size={15} className="text-blue-500" />
                  Upgrade to Pro
                </Link>
              )}
            </div>

            {/* Sign out */}
            <div className="border-t border-white/[0.06] p-1.5">
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  signOut();
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors w-full text-left"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  FileEdit,
  Search,
  User,
  LogOut,
  Zap,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tailor", label: "Tailor Resume", icon: FileEdit },
  { href: "/internships", label: "Internships", icon: Search },
  { href: "/profile", label: "Profile", icon: User },
];

export default function DashboardNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const userInitial = user?.email ? user.email[0].toUpperCase() : "U";
  const avatarUrl = user?.user_metadata?.avatar_url;
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";

  return (
    <>
      {/* ═══ SIDEBAR (desktop) ═══ */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:fixed md:inset-y-0 bg-[#0A0A0A] border-r border-white/[0.06] z-30">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-white/[0.06]">
          <Link href="/dashboard" className="flex items-center font-mono">
            <span className="text-white font-bold text-lg">InternOS</span>
            <span className="text-white font-bold text-lg animate-blink">|</span>
          </Link>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-blue-500/10 text-[#3B82F6]"
                    : "text-[#777] hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={18} className={isActive ? "text-[#3B82F6]" : ""} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Plan badge */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5">
            <Zap size={14} className="text-blue-400 fill-blue-400" />
            <span className="text-xs text-[#999]">Free Plan</span>
          </div>
        </div>

        {/* User section */}
        <div className="border-t border-white/[0.06] p-3" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#3B82F6] flex items-center justify-center text-white text-sm font-medium">
                {userInitial}
              </div>
            )}
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm text-white truncate">{displayName}</p>
              <p className="text-xs text-[#555] truncate">{user?.email}</p>
            </div>
          </button>

          {dropdownOpen && (
            <div className="mt-1 bg-[#111] border border-white/10 rounded-lg overflow-hidden">
              <Link
                href="/profile"
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-[#999] hover:text-white hover:bg-white/5 transition-colors"
              >
                <User size={15} /> Profile
              </Link>
              <button
                onClick={signOut}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ═══ TOP HEADER (mobile) ═══ */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="h-14 px-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center font-mono">
            <span className="text-white font-bold text-lg">InternOS</span>
            <span className="text-white font-bold text-lg animate-blink">|</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-[#999] hover:text-white p-1"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="bg-[#0A0A0A] border-b border-white/[0.06] px-4 pb-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? "bg-blue-500/10 text-[#3B82F6]" : "text-[#999] hover:text-white"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors mt-2"
            >
              <LogOut size={18} /> Sign out
            </button>
          </div>
        )}
      </header>

      {/* ═══ BOTTOM NAV (mobile) ═══ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-white/[0.06]">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-lg transition-colors ${
                  isActive ? "text-[#3B82F6]" : "text-[#555]"
                }`}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

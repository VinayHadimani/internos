import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FileEdit, Search, Clock, ArrowRight, Upload, BarChart3 } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'

  return (
    <>
      {/* Welcome section */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Welcome back, <span className="text-[#3B82F6]">{displayName}</span>
        </h1>
        <p className="text-[#777] mt-2">Here&apos;s your internship search at a glance.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {[
          { icon: <Upload size={20} />, label: 'Resumes Uploaded', value: '2', sub: 'of 5 max' },
          { icon: <FileEdit size={20} />, label: 'Tailors Used', value: '2/2', sub: 'Upgrade for unlimited' },
          { icon: <BarChart3 size={20} />, label: 'Applications Tracked', value: '0', sub: 'Start tracking' },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-gradient-to-b from-[#0E0E11] to-[#050505] border border-white/[0.08] rounded-2xl p-6 hover:border-white/[0.15] transition-all duration-200"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 flex items-center justify-center text-[#3B82F6]">
                {stat.icon}
              </div>
              <span className="text-sm text-[#777]">{stat.label}</span>
            </div>
            <p className="text-3xl font-bold text-white font-mono">{stat.value}</p>
            <p className="text-xs text-[#555] mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        <Link
          href="/tailor"
          className="group bg-gradient-to-b from-[#0E0E11] to-[#050505] border border-white/[0.08] rounded-2xl p-8 hover:border-[#3B82F6]/50 hover:shadow-[0_0_40px_rgba(37,99,235,0.1)] transition-all duration-300"
        >
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 shadow-inner flex items-center justify-center mb-6">
            <FileEdit size={24} className="text-[#3B82F6]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Tailor My Resume</h2>
          <p className="text-[#777] text-[15px] leading-relaxed mb-6">
            Paste a job description and let AI rewrite your resume with the perfect keywords for ATS.
          </p>
          <span className="inline-flex items-center gap-2 text-[#3B82F6] text-sm font-medium group-hover:gap-3 transition-all">
            Start tailoring <ArrowRight size={16} />
          </span>
        </Link>

        <Link
          href="/internships"
          className="group bg-gradient-to-b from-[#0E0E11] to-[#050505] border border-white/[0.08] rounded-2xl p-8 hover:border-[#3B82F6]/50 hover:shadow-[0_0_40px_rgba(37,99,235,0.1)] transition-all duration-300"
        >
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 shadow-inner flex items-center justify-center mb-6">
            <Search size={24} className="text-[#3B82F6]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Find Internships</h2>
          <p className="text-[#777] text-[15px] leading-relaxed mb-6">
            Browse 10,000+ internships matched to your skills and preferences, updated daily.
          </p>
          <span className="inline-flex items-center gap-2 text-[#3B82F6] text-sm font-medium group-hover:gap-3 transition-all">
            Browse listings <ArrowRight size={16} />
          </span>
        </Link>
      </div>

      {/* Recent activity */}
      <div className="bg-gradient-to-b from-[#0E0E11] to-[#050505] border border-white/[0.08] rounded-2xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Recent Activity</h2>
          <button className="text-sm text-[#777] hover:text-white transition-colors cursor-pointer">
            View all
          </button>
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
            <Clock size={24} className="text-[#555]" />
          </div>
          <p className="text-[#777] text-[15px] mb-1">No activity yet</p>
          <p className="text-[#555] text-sm max-w-[280px]">
            Upload a resume or tailor an application to see your activity here.
          </p>
          <Link
            href="/tailor"
            className="mt-6 inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all"
          >
            Tailor your first resume <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Upgrade banner */}
      <div className="mt-10 bg-gradient-to-r from-blue-600/10 to-blue-500/5 border border-[#3B82F6]/20 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Unlock unlimited tailoring</h3>
          <p className="text-[#777] text-[15px]">
            Upgrade to Pro for unlimited resume tailoring, AI cover letters, and priority matching.
          </p>
        </div>
        <Link
          href="/pricing"
          className="shrink-0 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium px-6 py-3 rounded-xl text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_40px_rgba(37,99,235,0.4)] hover:scale-[1.02] transition-all"
        >
          Upgrade to Pro
        </Link>
      </div>
    </>
  )
}

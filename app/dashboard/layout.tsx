import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Zap } from 'lucide-react'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      {/* Shared header for all dashboard pages */}
      <header className="border-b border-white/[0.05] bg-black/50 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center font-mono">
              <span className="text-white font-bold text-lg">InternOS</span>
              <span className="text-white font-bold text-lg animate-blink">|</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/dashboard" className="text-sm text-[#777] hover:text-white transition-colors">Dashboard</Link>
              <Link href="/tailor" className="text-sm text-[#777] hover:text-white transition-colors">Tailor</Link>
              <Link href="/internships" className="text-sm text-[#777] hover:text-white transition-colors">Internships</Link>
              <Link href="/applications" className="text-sm text-[#777] hover:text-white transition-colors">Applications</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
              <Zap size={14} className="text-blue-400 fill-blue-400" />
              <span className="text-xs text-[#999]">Free Plan</span>
            </div>
            <form action="/auth/signout" method="post">
              <button className="text-sm text-[#777] hover:text-white transition-colors cursor-pointer">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-[1200px] mx-auto px-6 py-10">
        {children}
      </main>
    </div>
  )
}

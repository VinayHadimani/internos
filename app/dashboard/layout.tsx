import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardNav from '@/components/dashboard/DashboardNav'

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
      <DashboardNav />

      {/* Main content — offset for sidebar on desktop */}
      <div className="md:pl-60">
        {/* Spacer for mobile top header */}
        <div className="h-14 md:h-0" />

        {/* Page content */}
        <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-6 md:py-10">
          {children}
        </main>

        {/* Spacer for mobile bottom nav */}
        <div className="h-20 md:h-0" />
      </div>
    </div>
  )
}

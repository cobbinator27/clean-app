'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { autoGenerateIfStale } from '@/lib/schedule-generator'
import BottomNav from '@/components/BottomNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  useEffect(() => {
    async function maybeGenerate() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single()
      if (!data?.household_id) return

      autoGenerateIfStale(supabase, data.household_id)
    }

    maybeGenerate()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-1 pb-24">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}

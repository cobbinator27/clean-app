'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const navItems = [
  { label: 'Schedule', icon: '📅' },
  { label: 'Customers', icon: '👥' },
  { label: 'Payments', icon: '💳' },
  { label: 'Settings', icon: '⚙️' },
]

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [activeNav, setActiveNav] = useState('Schedule')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login')
      } else {
        setEmail(user.email ?? '')
      }
    })
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#2C5F8A' }}>
          clean.
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 hidden sm:block">{email}</span>
          <button
            onClick={handleSignOut}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Welcome banner */}
      <div className="px-4 pt-6 pb-2">
        <p className="text-gray-500 text-sm">Welcome back</p>
        <p className="text-gray-800 font-medium text-sm truncate">{email}</p>
      </div>

      {/* Main content area */}
      <main className="flex-1 px-4 py-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center text-gray-400 text-sm">
          {activeNav} — coming soon
        </div>
      </main>

      {/* Bottom nav */}
      <nav className="bg-white border-t border-gray-100 px-2 pb-safe">
        <div className="flex">
          {navItems.map(item => (
            <button
              key={item.label}
              onClick={() => setActiveNav(item.label)}
              className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors"
              style={{ color: activeNav === item.label ? '#2C5F8A' : '#9CA3AF' }}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

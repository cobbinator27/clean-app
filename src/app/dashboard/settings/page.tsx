'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { generateRecurringEvents } from '@/lib/schedule-generator'

const LAST_GENERATED_KEY = 'clean_last_generated'

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null)
  const [lastGenerated, setLastGenerated] = useState<string | null>(null)

  useEffect(() => {
    setLastGenerated(localStorage.getItem(LAST_GENERATED_KEY))

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setEmail(user.email ?? '')

      const { data } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single()
      if (data) setHouseholdId(data.household_id)
    }
    load()
  }, [])

  function showToast(message: string, ok = true) {
    setToast({ message, ok })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleGenerate() {
    if (!householdId) { showToast('Not linked to a household', false); return }
    setGenerating(true)
    try {
      const result = await generateRecurringEvents(supabase, householdId)
      const now = new Date().toISOString()
      localStorage.setItem(LAST_GENERATED_KEY, now)
      setLastGenerated(now)
      showToast(
        result.generated === 0
          ? `All up to date — no new cleans needed (${result.skipped} already exist)`
          : `Generated ${result.generated} new clean${result.generated !== 1 ? 's' : ''} across ${result.customers} customer${result.customers !== 1 ? 's' : ''}`,
        true
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Something went wrong', false)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
      </header>

      <div className="px-4 py-5 space-y-6">

        {/* ── Schedule ── */}
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Schedule</p>
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
            <div>
              <p className="text-sm font-bold text-gray-800 mb-0.5">Auto-generate cleans</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                Creates recurring clean events for all active customers for the next 10 weeks.
                Safe to run multiple times — won&apos;t create duplicates.
              </p>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || !householdId}
              className="w-full h-12 rounded-xl font-semibold text-white text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
              style={{ backgroundColor: '#0E9F8E' }}
            >
              {generating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  Generate Schedule for Next 10 Weeks
                </>
              )}
            </button>

            {lastGenerated && (
              <p className="text-xs text-gray-400 text-center">
                Last generated: {formatTimestamp(lastGenerated)}
              </p>
            )}
          </div>
        </section>

        {/* ── Account ── */}
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Account</p>
          <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-sm text-gray-500">Email</span>
              <span className="text-sm font-medium text-gray-800 text-right max-w-[60%] truncate">{email || '—'}</span>
            </div>
            <div className="px-4 py-3">
              <button
                onClick={handleSignOut}
                className="w-full h-11 rounded-xl border border-red-200 text-red-500 text-sm font-semibold active:bg-red-50 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </section>

        {/* ── About ── */}
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">About</p>
          <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-sm text-gray-500">App</span>
              <span className="text-sm font-bold" style={{ color: '#2C5F8A' }}>clean.</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-sm text-gray-500">Version</span>
              <span className="text-sm font-medium text-gray-800">1.0.0</span>
            </div>
          </div>
        </section>

        <div className="h-4" />
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-xl max-w-xs text-center transition-all ${
            toast.ok ? 'bg-gray-900' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}
    </>
  )
}

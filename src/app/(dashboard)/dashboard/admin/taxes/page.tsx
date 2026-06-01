'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type {
  CleanBusinessSettings,
  CleanMonthlyFinancials,
  CleanOwnerIncome,
} from '@/types/clean'
import { fetchBusinessSettings } from '@/lib/pacing'
import { buildTaxSummary, type TaxSummary } from '@/lib/tax-summary'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return '$0'
  return `$${Math.round(n).toLocaleString('en-US')}`
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminTaxesPage() {
  const supabase = createClient()
  const currentYear = new Date().getFullYear()
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [year, setYear] = useState(currentYear)
  const [summary, setSummary] = useState<TaxSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [ownerTableMissing, setOwnerTableMissing] = useState(false)

  // Load household
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: member } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single()
      if (member) setHouseholdId(member.household_id)
    }
    init()
  }, [])

  const loadData = useCallback(async () => {
    if (!householdId) return

    const settings: CleanBusinessSettings | null = await fetchBusinessSettings(supabase, householdId)

    const { data: monthlyRows } = await supabase
      .from('clean_monthly_financials')
      .select('*')
      .eq('household_id', householdId)

    const { data: ownerRows, error: ownerErr } = await supabase
      .from('clean_owner_income')
      .select('*')
      .eq('household_id', householdId)

    const monthly = (monthlyRows ?? []) as CleanMonthlyFinancials[]
    const owner = (ownerRows ?? []) as CleanOwnerIncome[]

    setOwnerTableMissing(ownerErr?.code === '42P01')
    setSummary(buildTaxSummary(year, monthly, owner, settings))
    setLoading(false)
  }, [householdId, year])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [loadData])

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-4">
        <Link href="/dashboard/admin" className="inline-flex items-center gap-1 text-xs text-gray-500 mb-2 active:text-gray-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold" style={{ color: '#2C5F8A' }}>Tax Center</h1>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setYear(y => y - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200 text-lg font-bold"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-gray-700 w-12 text-center">{year}</span>
            <button
              onClick={() => setYear(y => y + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200 text-lg font-bold"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-[#2C5F8A] rounded-full animate-spin" />
        </div>
      ) : !summary ? (
        <div className="text-center text-gray-400 text-sm py-12">No data</div>
      ) : (
        <div className="px-4 pt-4 space-y-5">

          <p className="text-xs text-gray-500 leading-relaxed">
            Everything you’ve set aside for taxes across <span className="font-semibold">both sides</span> of
            the business — Julie’s cleans and your owner income — in one place. Owner months that are locked
            in use your actual numbers; the rest use the live estimate.
          </p>

          {ownerTableMissing && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-xs text-blue-800">
              Owner income table not set up yet — showing Julie’s side only. Run the owner-income migrations to include your extra income here.
            </div>
          )}

          {/* ── YTD hero ── */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
              {year} Set Aside for Taxes
            </p>
            <p className="text-3xl font-bold" style={{ color: '#2C5F8A' }}>{fmt(summary.ytd.total)}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-[11px] text-gray-400 font-medium">Julie (cleans)</p>
                <p className="text-base font-bold text-gray-800">{fmt(summary.ytd.julieReserve)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-[11px] text-gray-400 font-medium">You (owner income)</p>
                <p className="text-base font-bold text-gray-800">{fmt(summary.ytd.ownerReserve)}</p>
              </div>
            </div>
          </div>

          {/* ── Quarterly breakdown ── */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              By Estimated-Tax Quarter
            </h2>
            <div className="space-y-2">
              {summary.quarters.map(q => (
                <div key={q.q} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-800">{q.q}</span>
                      <span className="text-[11px] text-gray-400">due {q.dueLabel}</span>
                      {q.ownerReserve > 0 && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${q.ownerFinalized ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {q.ownerFinalized ? 'actuals' : 'est.'}
                        </span>
                      )}
                    </div>
                    <span className="text-base font-bold" style={{ color: '#2C5F8A' }}>{fmt(q.total)}</span>
                  </div>
                  {q.total > 0 ? (
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>Julie {fmt(q.julieReserve)}</span>
                      <span>You {fmt(q.ownerReserve)}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-300">No data yet</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <p className="text-[11px] text-gray-400 px-1 leading-relaxed">
            Estimated-tax periods are federal (Q2 = Apr–May, Q4 = Sep–Dec), not calendar quarters.
            These are amounts <span className="font-medium">set aside</span> from the business, not a
            filed tax calculation — confirm actual liability with your CPA.
          </p>

          <Link
            href="/dashboard/admin"
            className="block text-center text-xs text-gray-400 active:text-gray-600 pt-2"
          >
            ← Back to dashboard
          </Link>

          <div className="h-4" />
        </div>
      )}
    </div>
  )
}

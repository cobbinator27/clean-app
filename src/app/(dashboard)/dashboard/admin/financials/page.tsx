'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { CleanBusinessSettings, CleanMonthlyFinancials } from '@/types/clean'
import { recalculatePacing, fetchBusinessSettings } from '@/lib/pacing'
import AdminTabs from '@/components/AdminTabs'
import { useStickyMonthKey } from '@/lib/use-admin-period'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function offsetMonth(monthKey: string, offset: number): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 1 + offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '$0.00'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Event status counts ──────────────────────────────────────────────────────

interface EventSummary {
  scheduled: number
  arrived: number
  in_progress: number
  done: number
  payment_pending: number
  paid: number
  cancelled: number
  paidTotal: number
  outstandingTotal: number
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminFinancialsPage() {
  const supabase = createClient()
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [monthKey, setMonthKey] = useStickyMonthKey()
  const [financials, setFinancials] = useState<CleanMonthlyFinancials | null>(null)
  const [settings, setSettings] = useState<CleanBusinessSettings | null>(null)
  const [eventSummary, setEventSummary] = useState<EventSummary | null>(null)
  const [loading, setLoading] = useState(true)

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

  // Load data when month or householdId changes
  const loadData = useCallback(async () => {
    if (!householdId) return
    setLoading(true)

    // Trigger a fresh recalculation
    await recalculatePacing(supabase, householdId, monthKey)

    // Load financials row
    const { data: fin } = await supabase
      .from('clean_monthly_financials')
      .select('*')
      .eq('household_id', householdId)
      .eq('month_key', monthKey)
      .maybeSingle()
    setFinancials(fin as CleanMonthlyFinancials | null)

    // Load business settings
    const s = await fetchBusinessSettings(supabase, householdId)
    setSettings(s)

    // Load event breakdown for the month
    const monthStart = `${monthKey}-01`
    const nextMonth = offsetMonth(monthKey, 1)
    const nextMonthStart = `${nextMonth}-01`

    const { data: events } = await supabase
      .from('clean_events')
      .select('status, expected_amount, actual_amount')
      .eq('household_id', householdId)
      .gte('scheduled_date', monthStart)
      .lt('scheduled_date', nextMonthStart)

    if (events) {
      const summary: EventSummary = {
        scheduled: 0, arrived: 0, in_progress: 0, done: 0,
        payment_pending: 0, paid: 0, cancelled: 0,
        paidTotal: 0, outstandingTotal: 0,
      }
      for (const e of events) {
        const status = e.status as keyof EventSummary
        if (status in summary && typeof summary[status] === 'number') {
          (summary[status] as number)++
        }
        if (e.status === 'paid') {
          summary.paidTotal += e.actual_amount ?? e.expected_amount ?? 0
        } else if (e.status !== 'cancelled') {
          summary.outstandingTotal += e.expected_amount ?? 0
        }
      }
      setEventSummary(summary)
    }

    setLoading(false)
  }, [householdId, monthKey])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Load category target from SB monthly_budgets
  const [categoryTarget, setCategoryTarget] = useState<number>(0)
  useEffect(() => {
    if (!householdId || !settings?.sb_income_category_id) return
    async function loadTarget() {
      const { data } = await supabase
        .from('monthly_budgets')
        .select('target_amount')
        .eq('category_id', settings!.sb_income_category_id)
        .eq('month_key', monthKey)
        .maybeSingle()
      setCategoryTarget(data?.target_amount ?? 0)
    }
    loadTarget()
  }, [householdId, monthKey, settings?.sb_income_category_id])

  // ── Derived values ─────────────────────────────────────────────────────────

  const target = categoryTarget
  const pacing = financials?.net_to_household ?? 0
  const vsTarget = pacing - target
  const isFinalized = financials?.finalized ?? false

  // ── Render ─────────────────────────────────────────────────────────────────

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
          <h1 className="text-lg font-bold" style={{ color: '#2C5F8A' }}>Monthly Financials</h1>
          <div className="flex items-center gap-2">
            {isFinalized && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                Finalized
              </span>
            )}
            {!isFinalized && financials && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                Pacing
              </span>
            )}
          </div>
        </div>

        <AdminTabs active="monthly" />

        {/* Month nav */}
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={() => setMonthKey(offsetMonth(monthKey, -1))}
            className="p-2 rounded-xl bg-gray-100 active:bg-gray-200"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-500"><path d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-sm font-semibold text-gray-700">{formatMonthLabel(monthKey)}</span>
          <button
            onClick={() => setMonthKey(offsetMonth(monthKey, 1))}
            className="p-2 rounded-xl bg-gray-100 active:bg-gray-200"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-500"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-[#2C5F8A] rounded-full animate-spin" />
        </div>
      ) : !financials ? (
        <div className="text-center text-gray-400 text-sm py-12">
          No data for {formatMonthLabel(monthKey)}
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-4">

          {/* Net to household — hero card */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
              {isFinalized ? 'Final Net' : 'Pacing Net'}
            </p>
            <p className="text-3xl font-bold" style={{ color: '#2C5F8A' }}>{fmt(pacing)}</p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="text-xs text-gray-400">Target: {fmt(target)}</span>
              <span className={`text-xs font-semibold ${vsTarget >= 0 ? 'text-green-600' : 'text-amber-600'}`}>
                {vsTarget >= 0 ? '+' : ''}{fmt(vsTarget)}
              </span>
            </div>
          </div>

          {/* Revenue & Payroll */}
          <div className="grid grid-cols-2 gap-3">
            <Card label="Gross Income" value={fmt(financials.gross_income)} />
            <Card label="Gross Wages" value={fmt(financials.gross_wages)} sub={`${financials.total_hours}hrs × $${settings?.hourly_rate ?? 20}`} />
            <Card label="Payroll Withdrawal" value={fmt(financials.payroll_withdrawal)} sub={isFinalized ? 'Actual' : 'Estimated'} />
            <Card label="Payroll Deposit" value={fmt(financials.payroll_deposit)} sub={isFinalized ? 'Actual' : 'Estimated'} />
          </div>

          {/* Expenses & Deductions */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Expenses & Deductions</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Mileage</span>
                <span className="font-medium">{fmt(financials.total_mileage_expense)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">SB Expenses</span>
                <span className="font-medium">{fmt(financials.sb_expenses_total)}</span>
              </div>
              {financials.total_flat_expense > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Flat Per-Clean</span>
                  <span className="font-medium">{fmt(financials.total_flat_expense)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="text-gray-600 font-medium">Total Expenses</span>
                <span className="font-semibold">{fmt(
                  (financials.total_mileage_expense ?? 0) +
                  (financials.sb_expenses_total ?? 0) +
                  (financials.total_flat_expense ?? 0)
                )}</span>
              </div>
            </div>
          </div>

          {/* Tax & Transfer */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Tax & Transfer</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Income as Profit</span>
                <span className="font-medium">{fmt(financials.income_as_profit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tax Reserve ({((settings?.tax_reserve_pct ?? 0.22) * 100).toFixed(0)}%)</span>
                <span className="font-medium">{fmt(financials.tax_reserve)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="text-gray-600 font-medium">Transfer to Bank</span>
                <span className="font-semibold text-amber-600">{fmt(financials.transfer_to_bank)}</span>
              </div>
            </div>
          </div>

          {/* Event breakdown */}
          {eventSummary && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Events</p>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Paid</span><span className="font-medium text-green-600">{eventSummary.paid} · {fmt(eventSummary.paidTotal)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Scheduled</span><span className="font-medium">{eventSummary.scheduled}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Done / Pending</span><span className="font-medium">{eventSummary.done + eventSummary.payment_pending}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Cancelled</span><span className="font-medium text-gray-400">{eventSummary.cancelled}</span></div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
                <span className="text-gray-500">Outstanding</span>
                <span className="font-semibold text-amber-600">{fmt(eventSummary.outstandingTotal)}</span>
              </div>
            </div>
          )}

          {/* Month-End — now managed on the Payroll tab */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Month-End</p>
              {isFinalized ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Finalized</span>
              ) : (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pacing</span>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Payroll Withdrawal</span>
                <span className="font-medium">{fmt(financials.payroll_withdrawal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payroll Deposit</span>
                <span className="font-medium">{fmt(financials.payroll_deposit)}</span>
              </div>
            </div>
            <Link
              href="/dashboard/admin/payroll"
              className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 active:bg-gray-100"
            >
              <span className="text-sm font-medium text-gray-700">
                {isFinalized ? 'Edit on Payroll →' : 'Run payroll & close month →'}
              </span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-400">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
            <p className="text-[11px] text-gray-400 mt-2">
              Both Julie and your owner income are now reconciled together on the Payroll tab.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Reusable card ────────────────────────────────────────────────────────────

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
      <p className="text-lg font-bold text-gray-800">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

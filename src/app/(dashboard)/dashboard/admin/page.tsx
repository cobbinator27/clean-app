'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { CleanComplianceItem, CleanMonthlyFinancials } from '@/types/clean'
import { toLocalDateString, getWeekMonday, addDays } from '@/lib/date-utils'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return '$0'
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  target.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

// Map a Q-estimated-tax compliance item to the months whose tax_reserve feeds it.
// Federal estimated tax periods (not calendar quarters):
//   Q1: Jan–Mar (due Apr 15), Q2: Apr–May (due Jun 15),
//   Q3: Jun–Aug (due Sep 15), Q4: Sep–Dec (due Jan 15 of next year)
function quarterMonthsForItem(item: CleanComplianceItem): string[] {
  const q = item.name.match(/Q([1-4])/)?.[1]
  if (!q) return []
  const due = new Date(item.due_date + 'T00:00:00')
  // Q4's due date is Jan of the year AFTER the quarter — adjust back
  const baseYear = q === '4' ? due.getFullYear() - 1 : due.getFullYear()
  const ranges: Record<string, [number, number]> = {
    '1': [1, 3], '2': [4, 5], '3': [6, 8], '4': [9, 12],
  }
  const [s, e] = ranges[q]
  const months: string[] = []
  for (let m = s; m <= e; m++) {
    months.push(`${baseYear}-${String(m).padStart(2, '0')}`)
  }
  return months
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Snapshot {
  outstandingTotal: number
  outstandingCount: number
  overdueCount: number
  overdueTotal: number
  thisWeekCount: number
  thisWeekExpected: number
}

interface YTD {
  grossIncome: number
  totalExpenses: number
  taxReserve: number
  netToHousehold: number
  totalHours: number
  monthsClosed: number
  monthsPacing: number
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const supabase = createClient()
  const currentYear = new Date().getFullYear()
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [year, setYear] = useState(currentYear)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [allMonthly, setAllMonthly] = useState<CleanMonthlyFinancials[]>([])
  const [allItems, setAllItems] = useState<CleanComplianceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [cloning, setCloning] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single()
      if (data) setHouseholdId(data.household_id)
    }
    init()
  }, [])

  const loadData = useCallback(async () => {
    if (!householdId) return
    setLoading(true)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weekStart = getWeekMonday(today)
    const weekEnd = addDays(weekStart, 6)
    const overdueCutoff = addDays(today, -7)

    const [
      { data: outstandingRows },
      { data: weekRows },
      { data: monthlyRows },
      { data: complianceRows },
    ] = await Promise.all([
      supabase
        .from('clean_events')
        .select('id, scheduled_date, expected_amount, status')
        .eq('household_id', householdId)
        .in('status', ['done', 'payment_pending']),
      supabase
        .from('clean_events')
        .select('id, scheduled_date, expected_amount, status')
        .eq('household_id', householdId)
        .neq('status', 'cancelled')
        .gte('scheduled_date', toLocalDateString(weekStart))
        .lte('scheduled_date', toLocalDateString(weekEnd)),
      supabase
        .from('clean_monthly_financials')
        .select('*')
        .eq('household_id', householdId),
      supabase
        .from('clean_compliance_items')
        .select('*')
        .eq('household_id', householdId)
        .order('due_date', { ascending: true }),
    ])

    // ── Snapshot (always current, never year-bound) ──
    const out = (outstandingRows ?? []) as Array<{ scheduled_date: string; expected_amount: number | null }>
    const overdueCutoffStr = toLocalDateString(overdueCutoff)
    const overdue = out.filter(e => e.scheduled_date <= overdueCutoffStr)
    const week = (weekRows ?? []) as Array<{ expected_amount: number | null }>
    setSnapshot({
      outstandingTotal: out.reduce((s, e) => s + (e.expected_amount ?? 0), 0),
      outstandingCount: out.length,
      overdueCount: overdue.length,
      overdueTotal: overdue.reduce((s, e) => s + (e.expected_amount ?? 0), 0),
      thisWeekCount: week.length,
      thisWeekExpected: week.reduce((s, e) => s + (e.expected_amount ?? 0), 0),
    })

    setAllMonthly((monthlyRows ?? []) as CleanMonthlyFinancials[])
    setAllItems((complianceRows ?? []) as CleanComplianceItem[])
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data loader
    loadData()
  }, [loadData])

  // ── Year-scoped derived data ──────────────────────────────────────────────
  const yearStr = String(year)
  const monthlyByKey: Record<string, CleanMonthlyFinancials> = {}
  for (const m of allMonthly) monthlyByKey[m.month_key] = m

  const monthlyForYear = allMonthly.filter(m => m.month_key.startsWith(`${yearStr}-`))
  const ytd: YTD = (() => {
    let grossIncome = 0, totalExpenses = 0, taxReserve = 0, netToHousehold = 0, totalHours = 0
    let closed = 0, pacing = 0
    for (const m of monthlyForYear) {
      grossIncome += m.gross_income ?? 0
      totalExpenses += (m.total_mileage_expense ?? 0) + (m.sb_expenses_total ?? 0) + (m.total_flat_expense ?? 0)
      taxReserve += m.tax_reserve ?? 0
      netToHousehold += m.net_to_household ?? 0
      totalHours += m.total_hours ?? 0
      if (m.finalized) closed++
      else pacing++
    }
    return { grossIncome, totalExpenses, taxReserve, netToHousehold, totalHours, monthsClosed: closed, monthsPacing: pacing }
  })()

  const items = allItems.filter(i => i.due_date.startsWith(`${yearStr}-`))
  const priorYearItems = allItems.filter(i => i.due_date.startsWith(`${year - 1}-`))
  const itemNamesInYear = new Set(items.map(i => i.name))
  const missingFromPrior = priorYearItems.filter(p => !itemNamesInYear.has(p.name))
  const ytdLabel = year < currentYear ? `${year} Totals` : year > currentYear ? `${year} Projected` : `${year} Year-to-Date`

  // Compute suggested amount for a Q-tax item based on monthly tax_reserve
  function suggestedFor(item: CleanComplianceItem): number | null {
    const months = quarterMonthsForItem(item)
    if (months.length === 0) return null
    let sum = 0
    let any = false
    for (const m of months) {
      const row = monthlyByKey[m]
      if (row) {
        sum += row.tax_reserve ?? 0
        any = true
      }
    }
    return any ? sum : null
  }

  async function updateItem(id: string, patch: Partial<CleanComplianceItem>) {
    setAllItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
    await supabase.from('clean_compliance_items').update(patch).eq('id', id)
  }

  async function cloneMissingFromPrior() {
    if (!householdId || missingFromPrior.length === 0) return
    setCloning(true)
    const inserts = missingFromPrior.map(p => {
      // Advance due_date by exactly one year
      const [y, m, d] = p.due_date.split('-').map(Number)
      const advanced = `${y + 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      return {
        household_id: householdId,
        name: p.name,
        due_date: advanced,
        recurrence: p.recurrence,
        link: p.link,
        amount: null,
        paid: false,
        paid_at: null,
        notes: null,
      }
    })
    const { data: inserted, error } = await supabase
      .from('clean_compliance_items')
      .insert(inserts)
      .select()
    if (!error && inserted) {
      setAllItems(prev => [...prev, ...(inserted as CleanComplianceItem[])])
    }
    setCloning(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setYear(y => y - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors text-lg font-bold"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-gray-700 w-12 text-center">
              {year}
            </span>
            <button
              onClick={() => setYear(y => y + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors text-lg font-bold"
            >
              ›
            </button>
          </div>
        </div>

        {/* View tabs */}
        <div className="flex gap-1 mt-3">
          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700">
            Yearly
          </span>
          <Link
            href="/dashboard/admin/financials"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            Monthly →
          </Link>
          <Link
            href="/dashboard/admin/payroll"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            Payroll →
          </Link>
          <Link
            href="/dashboard/admin/owner"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            Owner + →
          </Link>
          <Link
            href="/dashboard/admin/taxes"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            Taxes →
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-[#2C5F8A] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 py-5 space-y-6">

          {/* ── Right-now snapshot ── */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Right Now</h2>
            <div className="grid grid-cols-2 gap-3">
              <Tile
                label="Outstanding"
                value={fmt(snapshot?.outstandingTotal)}
                sub={`${snapshot?.outstandingCount ?? 0} clean${snapshot?.outstandingCount === 1 ? '' : 's'}`}
                tone="amber"
              />
              <Tile
                label="Overdue >7d"
                value={fmt(snapshot?.overdueTotal)}
                sub={`${snapshot?.overdueCount ?? 0} clean${snapshot?.overdueCount === 1 ? '' : 's'}`}
                tone={(snapshot?.overdueCount ?? 0) > 0 ? 'red' : 'gray'}
              />
              <Tile
                label="This Week"
                value={String(snapshot?.thisWeekCount ?? 0)}
                sub={`${fmt(snapshot?.thisWeekExpected)} expected`}
                tone="blue"
              />
              <Tile
                label="Awaiting Payment"
                value={String(snapshot?.outstandingCount ?? 0)}
                sub={(snapshot?.overdueCount ?? 0) > 0 ? `${snapshot?.overdueCount} overdue` : 'all current'}
                tone="gray"
              />
            </div>
          </section>

          {/* ── Year totals ── */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{ytdLabel}</h2>
              <span className="text-xs text-gray-400">
                {ytd.monthsClosed} closed · {ytd.monthsPacing} pacing
              </span>
            </div>
            {monthlyForYear.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                <p className="text-sm text-gray-400">No financial data for {year}</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                <YTDRow label="Gross Income" value={fmt(ytd.grossIncome)} bold />
                <YTDRow label="Total Expenses" value={fmt(ytd.totalExpenses)} negative />
                <YTDRow label="Tax Reserve" value={fmt(ytd.taxReserve)} sub="set aside for federal" />
                <div className="border-t border-gray-100 pt-3">
                  <YTDRow label="Net to Household" value={fmt(ytd.netToHousehold)} bold accent />
                </div>
                <div className="text-xs text-gray-400 flex justify-between pt-1">
                  <span>Total Hours</span>
                  <span>{ytd.totalHours.toFixed(1)}h</span>
                </div>
              </div>
            )}
          </section>

          {/* ── Compliance ── */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Compliance Calendar — {year}
            </h2>
            {items.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center space-y-3">
                <p className="text-sm text-gray-500">No compliance items for {year}</p>
                {missingFromPrior.length > 0 && (
                  <button
                    onClick={cloneMissingFromPrior}
                    disabled={cloning}
                    className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                    style={{ backgroundColor: '#0E9F8E' }}
                  >
                    {cloning ? 'Creating…' : `Create ${year} from ${year - 1} (${missingFromPrior.length} items)`}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {items.map(item => (
                  <ComplianceRow
                    key={item.id}
                    item={item}
                    suggested={suggestedFor(item)}
                    onUpdate={patch => updateItem(item.id, patch)}
                  />
                ))}
                {missingFromPrior.length > 0 && (
                  <button
                    onClick={cloneMissingFromPrior}
                    disabled={cloning}
                    className="w-full mt-2 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 disabled:opacity-50 transition-colors"
                  >
                    {cloning ? 'Adding…' : `+ Add ${missingFromPrior.length} missing from ${year - 1}`}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* ── Drill-in link ── */}
          <Link
            href="/dashboard/admin/financials"
            className="block bg-white rounded-2xl border border-gray-100 p-4 active:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Monthly Financials →</p>
                <p className="text-xs text-gray-400 mt-0.5">Per-month pacing, payroll, and month-end close</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-300">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </Link>

          <div className="h-4" />
        </div>
      )}
    </div>
  )
}

// ── Tile ─────────────────────────────────────────────────────────────────────

function Tile({ label, value, sub, tone }: {
  label: string; value: string; sub?: string;
  tone: 'amber' | 'red' | 'blue' | 'gray' | 'green'
}) {
  const styles = {
    amber: 'bg-amber-50 text-amber-700',
    red:   'bg-red-50 text-red-700',
    blue:  'bg-blue-50 text-blue-700',
    gray:  'bg-gray-100 text-gray-700',
    green: 'bg-green-50 text-green-700',
  }[tone]
  const labelStyles = {
    amber: 'text-amber-500',
    red:   'text-red-500',
    blue:  'text-blue-500',
    gray:  'text-gray-500',
    green: 'text-green-500',
  }[tone]
  return (
    <div className={`${styles} rounded-2xl p-4`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${labelStyles}`}>{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${labelStyles}`}>{sub}</p>}
    </div>
  )
}

// ── YTD Row ──────────────────────────────────────────────────────────────────

function YTDRow({ label, value, sub, bold, negative, accent }: {
  label: string; value: string; sub?: string;
  bold?: boolean; negative?: boolean; accent?: boolean
}) {
  return (
    <div className="flex justify-between items-baseline">
      <div>
        <p className={`text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>{label}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
      <p className={`${bold ? 'text-base font-bold' : 'text-sm font-medium'} ${
        negative ? 'text-gray-700' :
        accent ? '' : 'text-gray-800'
      }`}
      style={accent ? { color: '#2C5F8A' } : undefined}>
        {negative ? '−' : ''}{value}
      </p>
    </div>
  )
}

// ── Compliance row ──────────────────────────────────────────────────────────

function ComplianceRow({ item, suggested, onUpdate }: {
  item: CleanComplianceItem
  suggested: number | null
  onUpdate: (patch: Partial<CleanComplianceItem>) => Promise<void>
}) {
  const [amountStr, setAmountStr] = useState(item.amount != null ? String(item.amount) : '')
  const [savingPaid, setSavingPaid] = useState(false)

  const days = daysUntil(item.due_date)
  const isPaid = item.paid
  const isOverdue = !isPaid && days < 0
  const isDueSoon = !isPaid && days <= 14 && days >= 0

  let badge: string
  if (isPaid) {
    badge = item.paid_at
      ? `Paid ${new Date(item.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : 'Paid'
  } else if (days === 0) badge = 'Due today'
  else if (isOverdue) badge = `Overdue ${Math.abs(days)}d`
  else badge = `Due in ${days}d`

  const badgeStyle = isPaid
    ? 'bg-green-100 text-green-700'
    : isOverdue
    ? 'bg-red-100 text-red-700'
    : isDueSoon
    ? 'bg-amber-100 text-amber-700'
    : 'bg-gray-100 text-gray-500'

  async function handleAmountBlur() {
    const parsed = amountStr === '' ? null : parseFloat(amountStr)
    if (parsed === item.amount) return
    if (parsed !== null && isNaN(parsed)) return
    await onUpdate({ amount: parsed })
  }

  async function handleTogglePaid() {
    setSavingPaid(true)
    if (isPaid) {
      await onUpdate({ paid: false, paid_at: null })
    } else {
      await onUpdate({ paid: true, paid_at: new Date().toISOString() })
    }
    setSavingPaid(false)
  }

  return (
    <div className={`bg-white rounded-2xl border p-4 ${isPaid ? 'border-gray-100 opacity-70' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 leading-snug">{item.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{fmtDate(item.due_date)}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${badgeStyle}`}>
          {badge}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <div className="flex-1 flex items-center gap-2">
          <span className="text-sm text-gray-400">$</span>
          <input
            type="number"
            inputMode="decimal"
            value={amountStr}
            onChange={e => setAmountStr(e.target.value)}
            onBlur={handleAmountBlur}
            placeholder={suggested != null ? `Suggested ${fmt(suggested)}` : 'Amount'}
            className="flex-1 h-10 rounded-xl border border-gray-200 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2C5F8A]/30"
          />
        </div>
        <button
          onClick={handleTogglePaid}
          disabled={savingPaid}
          className={`h-10 px-4 rounded-xl text-xs font-semibold whitespace-nowrap disabled:opacity-50 transition-colors ${
            isPaid
              ? 'border border-gray-200 text-gray-500 bg-white'
              : 'text-white'
          }`}
          style={!isPaid ? { backgroundColor: '#0E9F8E' } : undefined}
        >
          {isPaid ? 'Unmark' : 'Mark Paid'}
        </button>
      </div>

      {suggested != null && !isPaid && item.amount == null && (
        <p className="text-xs text-gray-400 mt-2">
          Based on {new Date().getFullYear()} reserves so far
        </p>
      )}

      {item.link && (
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 mt-3 hover:underline"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Open agency page
        </a>
      )}
    </div>
  )
}

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
import { computeOwnerIncome } from '@/lib/owner-income'
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOwnerIncomePage() {
  const supabase = createClient()
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [monthKey, setMonthKey] = useStickyMonthKey()
  const [financials, setFinancials] = useState<CleanMonthlyFinancials | null>(null)
  const [settings, setSettings] = useState<CleanBusinessSettings | null>(null)
  const [existing, setExisting] = useState<CleanOwnerIncome | null>(null)
  const [amountInput, setAmountInput] = useState('')
  const [mirrorExpenses, setMirrorExpenses] = useState(true)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tableMissing, setTableMissing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [ytdNetToYou, setYtdNetToYou] = useState(0)
  const [ytdReserve, setYtdReserve] = useState(0)
  const [ytdMonths, setYtdMonths] = useState(0)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

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

  // Load data for the selected month
  const loadData = useCallback(async () => {
    if (!householdId) return

    // Settings first (read-only). All reads happen before any state update so the
    // effect has no setState on its synchronous path.
    const s = await fetchBusinessSettings(supabase, householdId)

    // This month's real financials — read-only, we never write to this table here.
    const { data: fin } = await supabase
      .from('clean_monthly_financials')
      .select('*')
      .eq('household_id', householdId)
      .eq('month_key', monthKey)
      .maybeSingle()

    // Any saved owner-income entry for this month.
    const { data: owner, error: ownerErr } = await supabase
      .from('clean_owner_income')
      .select('*')
      .eq('household_id', householdId)
      .eq('month_key', monthKey)
      .maybeSingle()

    const row = (owner ?? null) as CleanOwnerIncome | null

    // Year-to-date roll-up of Daniel's income (net that stays with you) for the
    // selected year. netToYou isn't stored, so recompute it per saved month from
    // that month's ratios — consistent with how the live figure is derived.
    const year = monthKey.slice(0, 4)
    let ytdNet = 0, ytdRes = 0, ytdMo = 0
    if (ownerErr?.code !== '42P01') {
      const [{ data: ownerYear }, { data: finYear }] = await Promise.all([
        supabase.from('clean_owner_income').select('*')
          .eq('household_id', householdId).gte('month_key', `${year}-01`).lte('month_key', `${year}-12`),
        supabase.from('clean_monthly_financials').select('*')
          .eq('household_id', householdId).gte('month_key', `${year}-01`).lte('month_key', `${year}-12`),
      ])
      const finByMonth = new Map(
        ((finYear ?? []) as CleanMonthlyFinancials[]).map(f => [f.month_key, f])
      )
      for (const o of (ownerYear ?? []) as CleanOwnerIncome[]) {
        const bb = computeOwnerIncome(o.amount ?? 0, finByMonth.get(o.month_key) ?? null, s, o.mirror_expenses ?? false)
        ytdNet += bb.netToYou
        ytdRes += bb.taxReserve
        if ((o.amount ?? 0) > 0) ytdMo++
      }
    }

    // Commit all state once reads are done.
    setSettings(s)
    setFinancials(fin as CleanMonthlyFinancials | null)
    setExisting(row)
    setAmountInput(row ? String(row.amount) : '')
    setMirrorExpenses(row?.mirror_expenses ?? true)
    setNote(row?.note ?? '')
    setYtdNetToYou(ytdNet)
    setYtdReserve(ytdRes)
    setYtdMonths(ytdMo)
    // Table not created yet — calculator still works, persistence doesn't.
    setTableMissing(ownerErr?.code === '42P01')
    setLoading(false)
  }, [householdId, monthKey])

  useEffect(() => {
    // Load-on-mount: loadData only calls setState after awaiting its reads, so the
    // cascading-render concern doesn't apply. Same pattern as the Julie view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [loadData])

  // Save / upsert the owner-income entry for this month
  async function handleSave() {
    if (!householdId) return
    const amount = amountInput ? parseFloat(amountInput) : 0
    if (!Number.isFinite(amount) || amount < 0) {
      showToast('Enter a valid amount')
      return
    }
    setSaving(true)

    const payload = {
      household_id: householdId,
      month_key: monthKey,
      amount,
      mirror_expenses: mirrorExpenses,
      note: note.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('clean_owner_income')
      .upsert(payload, { onConflict: 'household_id,month_key' })

    setSaving(false)
    if (error) {
      showToast(
        error.code === '42P01'
          ? 'Table missing — run the one-time SQL first.'
          : 'Save failed: ' + error.message
      )
    } else {
      showToast('Saved')
      loadData()
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const liveAmount = amountInput ? parseFloat(amountInput) : 0
  const b = computeOwnerIncome(liveAmount, financials, settings, mirrorExpenses)
  const taxPct = settings?.tax_reserve_pct ?? 0.22
  const isFinalized = existing?.finalized ?? false
  const dirty =
    existing == null ||
    String(existing.amount) !== (amountInput || '0') ||
    existing.mirror_expenses !== mirrorExpenses ||
    (existing.note ?? '') !== note

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
          <h1 className="text-lg font-bold" style={{ color: '#2C5F8A' }}>Daniel</h1>
          <div className="flex items-center gap-2">
            {isFinalized ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                Locked In
              </span>
            ) : existing ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                Estimate
              </span>
            ) : null}
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
              Separate
            </span>
          </div>
        </div>

        <AdminTabs active="daniel" />

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
      ) : (
        <div className="px-4 pt-4 space-y-4">

          {/* Setup banner — table not created yet */}
          {tableMissing && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
              <span className="font-semibold">Saving is off.</span> The calculator works,
              but to remember your entries run the one-time SQL in{' '}
              <code className="text-[11px] bg-blue-100 px-1 py-0.5 rounded">supabase/migrations/20260531_clean_owner_income.sql</code>{' '}
              in the Supabase SQL editor.
            </div>
          )}

          {/* Explainer */}
          <p className="text-xs text-gray-500 leading-relaxed">
            Your extra income, tracked <span className="font-semibold">separately</span> from Julie&apos;s
            budget-wired financials. It splits the amount using {formatMonthLabel(monthKey)}&apos;s real ratios
            and shows what to move for taxes. Nothing here touches the Julie tab or your budget app.
          </p>

          {/* Your income — this month + YTD */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Net that stays with you</span>
              <span className="text-base font-bold text-green-600">{fmt(b.netToYou)}</span>
            </div>
            <div className="mt-1 pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                YTD {monthKey.slice(0, 4)} · {ytdMonths} mo
              </span>
              <span className="text-sm font-bold text-gray-700">{fmt(ytdNetToYou)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-gray-400">YTD tax reserved</span>
              <span className="text-xs font-medium text-amber-600">{fmt(ytdReserve)}</span>
            </div>
          </div>

          {/* Amount input */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="block text-sm text-gray-600 mb-1 font-medium">Extra income this month</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amountInput}
                onChange={e => setAmountInput(e.target.value)}
                className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#2C5F8A]/30"
              />
            </div>

            {/* Expense-mode toggle */}
            <button
              type="button"
              onClick={() => setMirrorExpenses(v => !v)}
              className="mt-3 w-full flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2.5 text-left active:bg-gray-50"
            >
              <span className="text-sm">
                <span className="font-medium text-gray-700">
                  {mirrorExpenses ? 'Mirror month’s expenses' : 'Expense-free'}
                </span>
                <span className="block text-[11px] text-gray-400 mt-0.5">
                  {mirrorExpenses
                    ? 'Applies this month’s expense ratio — same effective rate as Julie (recommended)'
                    : 'No phantom expenses — reserves more for taxes (conservative)'}
                </span>
              </span>
              <span className={`shrink-0 w-10 h-6 rounded-full transition-colors relative ${mirrorExpenses ? 'bg-[#2C5F8A]' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${mirrorExpenses ? 'left-[18px]' : 'left-0.5'}`} />
              </span>
            </button>
          </div>

          {/* No-ratio warning */}
          {!b.hasRatio && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
              No revenue recorded for {formatMonthLabel(monthKey)} yet, so there&apos;s no ratio to apply.
              Add Julie&apos;s cleans for this month on the Julie tab first, then come back.
            </div>
          )}

          {b.hasRatio && (
            <>
              {/* Hero — transfer for taxes */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
                  Move to tax / bank account
                </p>
                <p className="text-3xl font-bold text-amber-600">{fmt(b.transferToBank)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Tax reserve {fmt(b.taxReserve)} + payroll {fmt(b.payrollWithdrawal)}
                </p>
              </div>

              {/* Wages */}
              <div className="grid grid-cols-2 gap-3">
                <Card
                  label="Your W-2 Wages"
                  value={fmt(b.grossWages)}
                  sub={`${(b.wageRatio * 100).toFixed(1)}% of income (reasonable comp)`}
                />
                <Card
                  label="Your Take-Home"
                  value={fmt(b.payrollDeposit)}
                  sub="after 7.65% deduction"
                />
              </div>

              {/* Payroll detail */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Payroll</p>
                <div className="space-y-2 text-sm">
                  <Row label="Gross wages (reasonable comp)" value={fmt(b.grossWages)} />
                  <Row label="Employee deduction (7.65%)" value={`− ${fmt(b.employeeDeduction)}`} />
                  <Row label="Employer payroll tax" value={`+ ${fmt(b.employerTax)}`} />
                  <div className="flex justify-between pt-2 border-t border-gray-100">
                    <span className="text-gray-600 font-medium">Total payroll cost</span>
                    <span className="font-semibold">{fmt(b.payrollWithdrawal)}</span>
                  </div>
                </div>
              </div>

              {/* Profit & tax */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Profit & Tax</p>
                <div className="space-y-2 text-sm">
                  {mirrorExpenses && (
                    <Row
                      label={`Expenses (${(b.expenseRatio * 100).toFixed(1)}% of income)`}
                      value={`− ${fmt(b.expenses)}`}
                    />
                  )}
                  <Row label="Income as profit / distribution" value={fmt(b.incomeAsProfit)} />
                  <Row label={`Tax reserve (${(taxPct * 100).toFixed(0)}%)`} value={fmt(b.taxReserve)} />
                  <div className="flex justify-between pt-2 border-t border-gray-100">
                    <span className="text-gray-600 font-medium">Net that stays with you</span>
                    <span className="font-semibold text-green-600">{fmt(b.netToYou)}</span>
                  </div>
                </div>
              </div>

              {/* Source ratios (transparency) */}
              <p className="text-[11px] text-gray-400 px-1">
                Ratios from {formatMonthLabel(monthKey)} actuals: gross income {fmt(financials?.gross_income)},
                gross wages {fmt(financials?.gross_wages)} ({(b.wageRatio * 100).toFixed(1)}%).
              </p>
            </>
          )}

          {/* Note */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="block text-sm text-gray-600 mb-1 font-medium">Note (optional)</label>
            <input
              type="text"
              placeholder="e.g. new commercial contract"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2C5F8A]/30"
            />
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
            style={{ backgroundColor: '#2C5F8A' }}
          >
            {saving ? 'Saving...' : existing && !dirty ? 'Saved' : 'Save this month'}
          </button>
          {existing && (
            <p className="text-center text-[11px] text-gray-400">
              Last saved {new Date(existing.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' · '}move {fmt(existing.amount)} into your separate subaccount manually for now.
            </p>
          )}

          {/* Reconcile now lives on the unified Payroll tab */}
          {existing && b.hasRatio && (
            <Link
              href="/dashboard/admin/payroll"
              className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {isFinalized ? 'Locked in on Payroll →' : 'Run payroll & lock in →'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Reconcile your actual wages and tax set-aside alongside Julie, in one place.
                  </p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-300">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-xl max-w-xs text-center">
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Reusable bits ────────────────────────────────────────────────────────────

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
      <p className="text-lg font-bold text-gray-800">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

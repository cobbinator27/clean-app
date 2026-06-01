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

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

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
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey())
  const [financials, setFinancials] = useState<CleanMonthlyFinancials | null>(null)
  const [settings, setSettings] = useState<CleanBusinessSettings | null>(null)
  const [existing, setExisting] = useState<CleanOwnerIncome | null>(null)
  const [amountInput, setAmountInput] = useState('')
  const [mirrorExpenses, setMirrorExpenses] = useState(false)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [wagesInput, setWagesInput] = useState('')
  const [reserveInput, setReserveInput] = useState('')
  const [tableMissing, setTableMissing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

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

    // Commit all state once reads are done.
    setSettings(s)
    setFinancials(fin as CleanMonthlyFinancials | null)
    setExisting(row)
    setAmountInput(row ? String(row.amount) : '')
    setMirrorExpenses(row?.mirror_expenses ?? false)
    setNote(row?.note ?? '')
    // Prefill reconcile inputs from saved actuals (when finalized).
    setWagesInput(row?.finalized && row.actual_wages != null ? String(row.actual_wages) : '')
    setReserveInput(row?.finalized && row.actual_tax_reserve != null ? String(row.actual_tax_reserve) : '')
    // Table not created yet — calculator still works, persistence doesn't.
    setTableMissing(ownerErr?.code === '42P01')
    setLoading(false)
  }, [householdId, monthKey])

  useEffect(() => {
    // Load-on-mount: loadData only calls setState after awaiting its reads, so the
    // cascading-render concern doesn't apply. Same pattern as the Monthly view.
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

  // Reconcile: lock the month in with the owner's actual numbers.
  async function handleFinalize() {
    if (!householdId || !existing) {
      showToast('Save the month first, then reconcile.')
      return
    }
    const actualWages = wagesInput ? parseFloat(wagesInput) : b.grossWages
    const actualReserve = reserveInput ? parseFloat(reserveInput) : b.taxReserve
    if (!Number.isFinite(actualWages) || !Number.isFinite(actualReserve)) {
      showToast('Enter valid amounts')
      return
    }
    setFinalizing(true)
    const { error } = await supabase
      .from('clean_owner_income')
      .update({
        finalized: true,
        finalized_at: new Date().toISOString(),
        actual_wages: actualWages,
        actual_tax_reserve: actualReserve,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    setFinalizing(false)
    if (error) showToast('Reconcile failed: ' + error.message)
    else { showToast('Month locked in'); loadData() }
  }

  async function handleUnfinalize() {
    if (!existing) return
    const { error } = await supabase
      .from('clean_owner_income')
      .update({ finalized: false, finalized_at: null, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) showToast('Unlock failed: ' + error.message)
    else { showToast('Month unlocked — back to estimate'); loadData() }
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
          <h1 className="text-lg font-bold" style={{ color: '#2C5F8A' }}>Owner / Extra Income</h1>
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
            Extra income tracked <span className="font-semibold">separately</span> from your budget-wired
            financials. It splits the amount using {formatMonthLabel(monthKey)}&apos;s real ratios and shows
            what to move for taxes. Nothing here touches the Monthly view or your budget app.
          </p>

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
                    ? 'Applies this month’s expense ratio (reserves less for taxes)'
                    : 'No phantom expenses — reserves more for taxes (recommended)'}
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
              Add Julie&apos;s cleans for this month on the Monthly view first, then come back.
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

          {/* Reconcile / month-end — lock in actuals */}
          {existing && b.hasRatio && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Reconcile — Lock In Actuals
              </p>

              {!isFinalized ? (
                <>
                  <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                    Once you’ve run payroll and set money aside, enter what actually happened to
                    freeze this month. Blank fields fall back to the estimate above.
                  </p>
                  <label className="block text-sm text-gray-600 mb-1">Actual owner wages run</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder={`Estimated: ${fmt(b.grossWages)}`}
                    value={wagesInput}
                    onChange={e => setWagesInput(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#2C5F8A]/30"
                  />
                  <label className="block text-sm text-gray-600 mb-1">Actual set aside for taxes</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder={`Estimated: ${fmt(b.taxReserve)}`}
                    value={reserveInput}
                    onChange={e => setReserveInput(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#2C5F8A]/30"
                  />
                  <button
                    onClick={handleFinalize}
                    disabled={finalizing || dirty}
                    className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                    style={{ backgroundColor: '#0E9F8E' }}
                  >
                    {finalizing ? 'Locking in…' : 'Lock In Month'}
                  </button>
                  {dirty && (
                    <p className="text-center text-[11px] text-amber-600 mt-2">
                      Save your changes above before locking in.
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <Row label="Actual wages run" value={fmt(existing.actual_wages)} />
                  <Row label="Actual set aside for taxes" value={fmt(existing.actual_tax_reserve)} />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Locked in</span>
                    <span className="font-medium text-green-600">
                      {existing.finalized_at
                        ? new Date(existing.finalized_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : 'Yes'}
                    </span>
                  </div>
                  <button
                    onClick={handleUnfinalize}
                    className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 font-medium"
                  >
                    Unlock (back to estimate)
                  </button>
                </div>
              )}
            </div>
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

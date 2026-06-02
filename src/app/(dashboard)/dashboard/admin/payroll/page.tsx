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
import {
  buildPayrollSummary,
  saveJuliePayroll,
  saveOwnerPayroll,
  type PayrollSummary,
} from '@/lib/payroll'
import AdminTabs from '@/components/AdminTabs'

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

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function taxReserveFor(incomeBase: number, withdrawal: number, expenses: number, pct: number): number {
  return round2((incomeBase - withdrawal - expenses) * pct)
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPayrollPage() {
  const supabase = createClient()
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey())
  const [financials, setFinancials] = useState<CleanMonthlyFinancials | null>(null)
  const [owner, setOwner] = useState<CleanOwnerIncome | null>(null)
  const [settings, setSettings] = useState<CleanBusinessSettings | null>(null)
  const [summary, setSummary] = useState<PayrollSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ownerTableMissing, setOwnerTableMissing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Editable inputs — ONE combined withdrawal + ONE combined net pay (blank = estimate)
  const [withdrawalInput, setWithdrawalInput] = useState('')
  const [depositInput, setDepositInput] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

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

    const s = await fetchBusinessSettings(supabase, householdId)

    const { data: fin } = await supabase
      .from('clean_monthly_financials')
      .select('*')
      .eq('household_id', householdId)
      .eq('month_key', monthKey)
      .maybeSingle()

    const { data: own, error: ownErr } = await supabase
      .from('clean_owner_income')
      .select('*')
      .eq('household_id', householdId)
      .eq('month_key', monthKey)
      .maybeSingle()

    const finRow = (fin as CleanMonthlyFinancials | null) ?? null
    const ownRow = (own as CleanOwnerIncome | null) ?? null
    const sum = buildPayrollSummary(monthKey, finRow, ownRow, s)

    setSettings(s)
    setFinancials(finRow)
    setOwner(ownRow)
    setSummary(sum)
    setOwnerTableMissing(ownErr?.code === '42P01')

    // Prefill the two combined fields from saved actuals when locked.
    const locked = (finRow?.finalized ?? false) || (ownRow?.finalized ?? false)
    if (locked) {
      const wd = (finRow?.payroll_withdrawal ?? 0) + (ownRow?.actual_withdrawal ?? 0)
      const dep = (finRow?.payroll_deposit ?? 0) + (ownRow?.actual_deposit ?? 0)
      setWithdrawalInput(wd ? String(round2(wd)) : '')
      setDepositInput(dep ? String(round2(dep)) : '')
    } else {
      setWithdrawalInput('')
      setDepositInput('')
    }

    setLoading(false)
  }, [householdId, monthKey])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [loadData])

  // ── Live preview from current inputs (falls back to estimate) ──
  const taxPct = settings?.tax_reserve_pct ?? 0.22

  const jHasData = summary?.julie.hasData ?? false
  const oHasData = summary?.owner.hasData ?? false

  // Estimated withdrawal/deposit per person — used both as the fallback when the
  // field is blank, and as the ratio for splitting the ONE combined amount the
  // user types back across the two people (so storage + Tax Center stay per-person).
  const jEstW = summary?.julie.estWithdrawal ?? 0
  const oEstW = summary?.owner.estWithdrawal ?? 0
  const jEstD = summary?.julie.estDeposit ?? 0
  const oEstD = summary?.owner.estDeposit ?? 0
  const estTotalW = jEstW + oEstW
  const estTotalD = jEstD + oEstD

  // Combined inputs (blank → combined estimate).
  const totalWithdrawal = withdrawalInput !== '' ? round2(parseFloat(withdrawalInput) || 0) : round2(estTotalW)
  const totalNet = depositInput !== '' ? round2(parseFloat(depositInput) || 0) : round2(estTotalD)

  // Split the combined figures back to each person by their estimated share.
  // If only one person has data, they get all of it; if neither, shares are 0.
  // Julie's share of each total; the owner gets the remainder (avoids rounding drift).
  // When only the owner has data, Julie's share is 0 so the owner gets all of it.
  const jShareW = estTotalW > 0 ? jEstW / estTotalW : (jHasData ? 1 : 0)
  const jShareD = estTotalD > 0 ? jEstD / estTotalD : (jHasData ? 1 : 0)

  const jW = round2(totalWithdrawal * jShareW)
  const oW = round2(totalWithdrawal - jW)
  const jD = round2(totalNet * jShareD)
  const oD = round2(totalNet - jD)

  const jExpenses =
    (financials?.total_mileage_expense ?? 0) + (financials?.sb_expenses_total ?? 0) + (financials?.total_flat_expense ?? 0)
  const oExpenses = owner?.mirror_expenses && financials && financials.gross_income > 0
    ? (owner.amount * (jExpenses / financials.gross_income))
    : 0

  const jReserve = jHasData ? taxReserveFor(financials?.gross_income ?? 0, jW, jExpenses, taxPct) : 0
  const oReserve = oHasData ? taxReserveFor(owner?.amount ?? 0, oW, oExpenses, taxPct) : 0
  const totalReserve = round2(jReserve + oReserve)

  const totalToBank = round2(totalWithdrawal + totalReserve)

  const isFinalized = summary?.finalized ?? false
  const anyData = jHasData || oHasData

  // ── Save / lock in both ──
  async function handleSave(finalize: boolean) {
    if (!householdId || !settings) return
    setSaving(true)
    const errs: string[] = []

    if (jHasData && financials) {
      const { error } = await saveJuliePayroll(supabase, financials, settings, jW, jD, finalize)
      if (error) errs.push('Julie: ' + error)
    }
    if (oHasData && owner) {
      const { error } = await saveOwnerPayroll(supabase, owner, oW, oD, oReserve, finalize)
      if (error) errs.push('Owner: ' + error)
    }

    setSaving(false)
    if (errs.length) showToast(errs.join(' · '))
    else { showToast(finalize ? 'Locked in for the month' : 'Saved'); loadData() }
  }

  async function handleUnlock() {
    if (!householdId) return
    setSaving(true)
    if (jHasData && financials) {
      await supabase.from('clean_monthly_financials')
        .update({ finalized: false, finalized_at: null }).eq('id', financials.id)
    }
    if (oHasData && owner) {
      await supabase.from('clean_owner_income')
        .update({ finalized: false, finalized_at: null, updated_at: new Date().toISOString() }).eq('id', owner.id)
    }
    setSaving(false)
    showToast('Unlocked — back to estimates')
    loadData()
  }

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
          <h1 className="text-lg font-bold" style={{ color: '#2C5F8A' }}>Payroll</h1>
          {isFinalized ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Locked In</span>
          ) : anyData ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Estimate</span>
          ) : null}
        </div>

        <AdminTabs active="payroll" />

        {/* Month nav */}
        <div className="flex items-center justify-between mt-3">
          <button onClick={() => setMonthKey(offsetMonth(monthKey, -1))} className="p-2 rounded-xl bg-gray-100 active:bg-gray-200">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-500"><path d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-sm font-semibold text-gray-700">{formatMonthLabel(monthKey)}</span>
          <button onClick={() => setMonthKey(offsetMonth(monthKey, 1))} className="p-2 rounded-xl bg-gray-100 active:bg-gray-200">
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

          <p className="text-xs text-gray-500 leading-relaxed">
            Run payroll for the whole household in one place. Enter the actual total withdrawal and total
            net pay; the tax reserve and the amount to move to your bank are calculated. Leave blank to use
            the estimate.
          </p>

          {ownerTableMissing && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-xs text-blue-800">
              Owner income table not set up — managing Julie only.
            </div>
          )}

          {/* Hero: move to bank */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Move to bank account</p>
            <p className="text-3xl font-bold text-amber-600">{fmt(totalToBank)}</p>
            <p className="text-xs text-gray-400 mt-1">
              Withdrawal {fmt(totalWithdrawal)} + tax reserve {fmt(totalReserve)}
            </p>
          </div>

          {/* Single combined input */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Actuals (whole household)</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Actual total payroll withdrawal</label>
                <input
                  type="number" inputMode="decimal" disabled={isFinalized}
                  placeholder={`Estimated: ${fmt(estTotalW)}`}
                  value={withdrawalInput} onChange={e => setWithdrawalInput(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2C5F8A]/30 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Actual total net pay (deposit)</label>
                <input
                  type="number" inputMode="decimal" disabled={isFinalized}
                  placeholder={`Estimated: ${fmt(estTotalD)}`}
                  value={depositInput} onChange={e => setDepositInput(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2C5F8A]/30 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
            </div>
          </div>

          {/* Per-person breakdown (read-only, for the record + Tax Center) */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Breakdown by person</p>
            <div className="space-y-3 text-sm">
              {jHasData && (
                <PersonRow label="Julie (cleans)" withdrawal={jW} netPay={jD} reserve={jReserve} fmt={fmt} />
              )}
              {oHasData && (
                <PersonRow label="You (owner income)" withdrawal={oW} netPay={oD} reserve={oReserve} fmt={fmt} />
              )}
              {!jHasData && !oHasData && (
                <p className="text-xs text-gray-400">No income recorded this month — nothing to run.</p>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-3">
              The total you enter above is split between people by their estimated share, so the Tax Center
              still shows each side.
            </p>
          </div>

          {/* Combined summary */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Combined</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Total withdrawal</span><span className="font-medium">{fmt(totalWithdrawal)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total tax reserve ({(taxPct * 100).toFixed(0)}%)</span><span className="font-medium">{fmt(totalReserve)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total net pay</span><span className="font-medium">{fmt(totalNet)}</span></div>
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="text-gray-600 font-semibold">Move to bank</span>
                <span className="font-bold text-amber-600">{fmt(totalToBank)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          {anyData && (
            !isFinalized ? (
              <div className="space-y-2">
                <button onClick={() => handleSave(true)} disabled={saving}
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                  style={{ backgroundColor: '#0E9F8E' }}>
                  {saving ? 'Saving…' : 'Lock In Month'}
                </button>
                <button onClick={() => handleSave(false)} disabled={saving}
                  className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium disabled:opacity-40">
                  Save without locking
                </button>
              </div>
            ) : (
              <button onClick={handleUnlock} disabled={saving}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 font-medium disabled:opacity-40">
                Unlock (back to estimates)
              </button>
            )
          )}

          <p className="text-[11px] text-gray-400 px-1 leading-relaxed">
            Tax reserve is each person’s profit × {(taxPct * 100).toFixed(0)}%. This is money to set aside,
            not a filed tax figure — confirm with your CPA.
          </p>
        </div>
      )}

      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-xl max-w-xs text-center">
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Per-person read-only row ─────────────────────────────────────────────────

function PersonRow({
  label, withdrawal, netPay, reserve, fmt,
}: {
  label: string
  withdrawal: number
  netPay: number
  reserve: number
  fmt: (n: number | null | undefined) => string
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <p className="text-sm font-semibold text-gray-700 mb-1.5">{label}</p>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-gray-400">Withdrawal</p>
          <p className="font-medium text-gray-700">{fmt(withdrawal)}</p>
        </div>
        <div>
          <p className="text-gray-400">Net pay</p>
          <p className="font-medium text-gray-700">{fmt(netPay)}</p>
        </div>
        <div>
          <p className="text-gray-400">Tax reserve</p>
          <p className="font-medium text-gray-700">{fmt(reserve)}</p>
        </div>
      </div>
    </div>
  )
}

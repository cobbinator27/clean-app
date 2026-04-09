'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { CleanEvent, CleanCustomer } from '@/types/clean'

type PayEvent = CleanEvent & { customer: CleanCustomer }
type PayStep = 'idle' | 'amount' | 'mismatch' | 'method'
const PAYMENT_METHODS = ['Venmo', 'Check', 'Cash', 'Other']
function displayPaymentMethod(m: string): string { return m.charAt(0).toUpperCase() + m.slice(1) }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatPaymentDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function todayDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 animate-pulse flex items-center gap-3">
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-32" />
        <div className="h-3 bg-gray-100 rounded w-20" />
      </div>
      <div className="h-4 bg-gray-100 rounded w-12" />
    </div>
  )
}

// ── Inline payment flow ───────────────────────────────────────────────────────

function InlinePayment({
  event,
  onConfirm,
  onCancel,
}: {
  event: PayEvent
  onConfirm: (amount: number, method: string) => Promise<void>
  onCancel: () => void
}) {
  const [step, setStep] = useState<PayStep>('amount')
  const [amount, setAmount] = useState(event.expected_amount != null ? String(event.expected_amount) : '')
  const [method, setMethod] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function handleNext() {
    const entered = parseFloat(amount)
    const expected = event.expected_amount
    if (expected != null && !isNaN(entered) && entered !== expected) {
      setStep('mismatch')
    } else {
      setStep('method')
    }
  }

  async function handleConfirm() {
    if (!method) return
    setLoading(true)
    await onConfirm(parseFloat(amount), method)
    setLoading(false)
  }

  return (
    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
      {step === 'amount' && (
        <>
          <p className="text-sm font-semibold text-amber-800">How much was paid?</p>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-medium">$</span>
            <input
              type="number"
              min="0"
              step="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              autoFocus
              className="flex-1 h-11 rounded-xl border border-amber-200 bg-white px-3 text-base font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium bg-white">Cancel</button>
            <button onClick={handleNext} className="flex-1 h-10 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: '#2C5F8A' }}>Next</button>
          </div>
        </>
      )}

      {step === 'mismatch' && (
        <>
          <p className="text-sm font-semibold text-amber-800">
            ⚠️ Doesn&apos;t match expected ${event.expected_amount?.toFixed(0)}. Is this correct?
          </p>
          <div className="flex gap-2">
            <button onClick={() => setStep('amount')} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium bg-white">No, edit</button>
            <button onClick={() => setStep('method')} className="flex-1 h-10 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: '#D97706' }}>Yes, continue</button>
          </div>
        </>
      )}

      {step === 'method' && (
        <>
          <p className="text-sm font-semibold text-amber-800">Payment method</p>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map(m => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`h-10 px-4 rounded-full text-sm font-medium border transition-colors ${
                  method === m ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            onClick={handleConfirm}
            disabled={!method || loading}
            className="w-full h-12 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
            style={{ backgroundColor: '#0E9F8E' }}
          >
            {loading ? 'Saving…' : `Confirm · $${parseFloat(amount || '0').toFixed(0)}`}
          </button>
        </>
      )}
    </div>
  )
}

// ── Outstanding row ───────────────────────────────────────────────────────────

function OutstandingRow({
  event,
  onPaid,
}: {
  event: PayEvent
  onPaid: (id: string, amount: number, method: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)

  async function handleConfirm(amount: number, method: string) {
    await onPaid(event.id, amount, method)
    setExpanded(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 leading-snug">{event.customer.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{formatDateShort(event.scheduled_date)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {event.expected_amount != null && (
            <span className="text-base font-bold text-amber-600">${event.expected_amount.toFixed(0)}</span>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="h-9 px-3 rounded-xl text-white text-xs font-semibold shrink-0"
            style={{ backgroundColor: expanded ? '#9CA3AF' : '#D97706' }}
          >
            {expanded ? 'Cancel' : 'Log Payment'}
          </button>
        </div>
      </div>

      {expanded && (
        <InlinePayment
          event={event}
          onConfirm={handleConfirm}
          onCancel={() => setExpanded(false)}
        />
      )}
    </div>
  )
}

// ── History row ───────────────────────────────────────────────────────────────

function HistoryRow({ event }: { event: PayEvent }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm leading-snug">{event.customer.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">{formatDateShort(event.scheduled_date)}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {event.payment_method && (
          <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
            {displayPaymentMethod(event.payment_method)}
          </span>
        )}
        {event.payment_date && (
          <span className="text-xs text-gray-400">{formatPaymentDate(event.payment_date)}</span>
        )}
        {event.actual_amount != null && (
          <span className="text-sm font-bold text-green-600">${event.actual_amount.toFixed(0)}</span>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const supabase = createClient()
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [outstanding, setOutstanding] = useState<PayEvent[]>([])
  const [history, setHistory] = useState<PayEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadHousehold() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single()
      if (data) setHouseholdId(data.household_id)
    }
    loadHousehold()
  }, [])

  const loadPayments = useCallback(async () => {
    if (!householdId) return
    setLoading(true)

    const { data } = await supabase
      .from('clean_events')
      .select('*, customer:clean_customers(*)')
      .eq('household_id', householdId)
      .in('status', ['done', 'payment_pending', 'paid'])
      .order('scheduled_date', { ascending: false })
      .limit(200)

    const all = (data ?? []) as PayEvent[]
    setOutstanding(all.filter(e => e.status === 'done' || e.status === 'payment_pending'))
    setHistory(all.filter(e => e.status === 'paid').slice(0, 30))
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    if (householdId) loadPayments()
    else setLoading(false)
  }, [householdId, loadPayments])

  async function handlePaid(id: string, amount: number, method: string) {
    const updates = {
      actual_amount: amount,
      payment_method: method.toLowerCase(),
      payment_date: todayDateString(),
      status: 'paid' as const,
    }
    // Optimistic: move from outstanding to history
    const event = outstanding.find(e => e.id === id)
    if (event) {
      const updated = { ...event, ...updates }
      setOutstanding(prev => prev.filter(e => e.id !== id))
      setHistory(prev => [updated, ...prev].slice(0, 30))
    }
    await supabase.from('clean_events').update(updates).eq('id', id)
  }

  // Running total of outstanding
  const totalOutstanding = outstanding.reduce((sum, e) => sum + (e.expected_amount ?? 0), 0)
  const totalThisMonth = (() => {
    const now = new Date()
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return history
      .filter(e => e.payment_date?.startsWith(monthStr))
      .reduce((sum, e) => sum + (e.actual_amount ?? 0), 0)
  })()

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">Payments</h1>
      </header>

      <div className="px-4 py-4 space-y-6">
        {/* Summary tiles */}
        {!loading && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-amber-50 rounded-2xl p-4">
              <p className="text-xs text-amber-500 font-semibold uppercase tracking-wide">Outstanding</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">${totalOutstanding.toFixed(0)}</p>
              <p className="text-xs text-amber-500 mt-0.5">{outstanding.length} clean{outstanding.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-green-50 rounded-2xl p-4">
              <p className="text-xs text-green-500 font-semibold uppercase tracking-wide">This Month</p>
              <p className="text-2xl font-bold text-green-700 mt-1">${totalThisMonth.toFixed(0)}</p>
              <p className="text-xs text-green-500 mt-0.5">paid</p>
            </div>
          </div>
        )}

        {/* Outstanding section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Outstanding</h2>
            {!loading && outstanding.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {outstanding.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>
          ) : outstanding.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-green-600">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-700">All caught up!</p>
              <p className="text-xs text-gray-400 mt-1">No outstanding payments</p>
            </div>
          ) : (
            <div className="space-y-3">
              {outstanding.map(ev => (
                <OutstandingRow key={ev.id} event={ev} onPaid={handlePaid} />
              ))}
            </div>
          )}
        </section>

        {/* History section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">History</h2>
            {!loading && (
              <span className="text-xs text-gray-400">{history.length} cleans</span>
            )}
          </div>

          {loading ? (
            <div className="space-y-2"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No payment history yet</p>
          ) : (
            <div className="space-y-2">
              {history.map(ev => (
                <HistoryRow key={ev.id} event={ev} />
              ))}
            </div>
          )}
        </section>

        <div className="h-4" />
      </div>
    </>
  )
}

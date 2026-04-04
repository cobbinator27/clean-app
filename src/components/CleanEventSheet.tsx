'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { CleanEvent, CleanCustomer, EventStatus } from '@/types/clean'

// ── Helpers ───────────────────────────────────────────────────────────────────

const statusConfig: Record<EventStatus, { label: string; color: string }> = {
  scheduled:       { label: 'Scheduled',   color: 'bg-gray-100 text-gray-600' },
  arrived:         { label: 'Arrived',     color: 'bg-blue-100 text-blue-700' },
  in_progress:     { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  done:            { label: 'Done',        color: 'bg-green-100 text-green-700' },
  payment_pending: { label: 'Payment Due', color: 'bg-amber-100 text-amber-700' },
  paid:            { label: 'Paid ✓',      color: 'bg-green-100 text-green-700' },
  cancelled:       { label: 'Cancelled',   color: 'bg-red-100 text-red-700' },
}

const eventTypeLabels: Record<string, string> = {
  one_off:    'One-Off',
  move_out:   'Move-Out',
  deep_clean: 'Deep Clean',
  other:      'Other',
}

const PAYMENT_METHODS = ['Venmo', 'Check', 'Cash', 'Other']

function formatTime(time: string | null): string | null {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDateNice(dateStr: string): string {
  // Parse as local date to avoid UTC shift
  const [y, mo, d] = dateStr.split('-').map(Number)
  const date = new Date(y, mo - 1, d)
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatPaymentDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function todayDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 mt-5">
      {children}
    </p>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type FullEvent = CleanEvent & { customer: CleanCustomer }

type PayStep = 'idle' | 'amount' | 'mismatch' | 'method'

interface Props {
  event: FullEvent | null
  onClose: () => void
  onUpdate: (updated: CleanEvent) => void
}

export default function CleanEventSheet({ event, onClose, onUpdate }: Props) {
  const supabase = createClient()

  // Sheet animation
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (event) {
      // Defer to next frame so transition fires
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [event])

  // Local event state (so sheet reflects optimistic updates)
  const [local, setLocal] = useState<FullEvent | null>(null)
  useEffect(() => { if (event) setLocal(event) }, [event])

  // Notes editing
  const [notes, setNotes] = useState('')
  useEffect(() => { setNotes(local?.notes ?? '') }, [local?.id])

  // Manual hours
  const [manualHours, setManualHours] = useState('')
  const [savingHours, setSavingHours] = useState(false)

  // Payment flow
  const [payStep, setPayStep] = useState<PayStep>('idle')
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<string | null>(null)
  const [payLoading, setPayLoading] = useState(false)

  // Cancel confirm
  const [confirmCancel, setConfirmCancel] = useState(false)

  const sheetRef = useRef<HTMLDivElement>(null)

  if (!event || !local) return null

  const sc = statusConfig[local.status]
  const customer = local.customer
  const mapsUrl = customer.address
    ? `maps://?address=${encodeURIComponent(customer.address)}`
    : null
  const googleMapsUrl = customer.address
    ? `https://maps.google.com/?q=${encodeURIComponent(customer.address)}`
    : null

  async function patch(updates: Partial<CleanEvent>) {
    const updated = { ...local!, ...updates }
    setLocal(updated)
    onUpdate(updated)
    await supabase.from('clean_events').update(updates).eq('id', local!.id)
  }

  async function handleArrive() {
    await patch({ status: 'arrived', arrived_at: new Date().toISOString() })
  }

  async function handleMarkDone() {
    const now = new Date()
    const arrivedAt = local!.arrived_at ? new Date(local!.arrived_at) : null
    const hoursLogged = arrivedAt
      ? Math.round(((now.getTime() - arrivedAt.getTime()) / 3600000) * 100) / 100
      : null
    await patch({ status: 'done', left_at: now.toISOString(), hours_logged: hoursLogged })
  }

  async function handleSaveHours() {
    const h = parseFloat(manualHours)
    if (isNaN(h) || h <= 0) return
    setSavingHours(true)
    await patch({ hours_logged: h })
    setSavingHours(false)
  }

  async function handleNoteBlur() {
    if (notes === (local!.notes ?? '')) return
    await patch({ notes })
  }

  function startPayment() {
    setPayAmount(local!.expected_amount != null ? String(local!.expected_amount) : '')
    setPayMethod(null)
    setPayStep('amount')
  }

  function handlePayAmountNext() {
    const expected = local!.expected_amount
    const entered = parseFloat(payAmount)
    if (expected != null && !isNaN(entered) && entered !== expected) {
      setPayStep('mismatch')
    } else {
      setPayStep('method')
    }
  }

  async function handleConfirmPayment() {
    if (!payMethod) return
    setPayLoading(true)
    const updates: Partial<CleanEvent> = {
      actual_amount: parseFloat(payAmount),
      payment_method: payMethod,
      payment_date: todayDateString(),
      status: 'paid',
    }
    await patch(updates)
    setPayStep('idle')
    setPayLoading(false)
  }

  async function handleCancelClean() {
    await patch({ status: 'cancelled' })
    setConfirmCancel(false)
    onClose()
  }

  const showPaymentSection = ['done', 'payment_pending', 'paid'].includes(local.status)
  const showTimeTracking = true

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 max-w-lg mx-auto"
        style={{
          maxHeight: '90vh',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 pb-2">

          {/* Header */}
          <div className="flex items-start justify-between gap-3 mt-2 mb-1">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 leading-snug">{customer.name}</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${sc.color}`}>
                {sc.label}
              </span>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 active:bg-gray-200"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-4 h-4">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Details ── */}
          <SectionLabel>Details</SectionLabel>
          <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100 overflow-hidden">
            {/* Date */}
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-sm text-gray-500">Date</span>
              <span className="text-sm font-medium text-gray-800">{formatDateNice(local.scheduled_date)}</span>
            </div>

            {/* Time */}
            {local.scheduled_time && (
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-sm text-gray-500">Time</span>
                <span className="text-sm font-medium text-gray-800">{formatTime(local.scheduled_time)}</span>
              </div>
            )}

            {/* Address */}
            {customer.address && (
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-sm text-gray-500">Address</span>
                <a
                  href={mapsUrl ?? googleMapsUrl ?? '#'}
                  className="text-sm font-medium text-blue-500 underline-offset-2 hover:underline text-right max-w-[60%]"
                >
                  {customer.address}
                </a>
              </div>
            )}

            {/* Expected amount */}
            {local.expected_amount != null && (
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-sm text-gray-500">Expected</span>
                <span className="text-sm font-semibold text-gray-800">${local.expected_amount.toFixed(0)}</span>
              </div>
            )}

            {/* Event type */}
            {local.event_type !== 'regular' && eventTypeLabels[local.event_type] && (
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-sm text-gray-500">Type</span>
                <span className="text-xs font-medium bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full">
                  {eventTypeLabels[local.event_type]}
                </span>
              </div>
            )}
          </div>

          {/* Notes */}
          <SectionLabel>Notes</SectionLabel>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={handleNoteBlur}
            placeholder="Add notes…"
            rows={3}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
          />

          {/* ── Time Tracking ── */}
          {showTimeTracking && (
            <>
              <SectionLabel>Time Tracking</SectionLabel>
              <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100 overflow-hidden">
                {local.arrived_at ? (
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-sm text-gray-500">Arrived</span>
                    <span className="text-sm font-medium text-green-600">{formatTimestamp(local.arrived_at)}</span>
                  </div>
                ) : null}

                {local.left_at ? (
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-sm text-gray-500">Left</span>
                    <span className="text-sm font-medium text-green-600">{formatTimestamp(local.left_at)}</span>
                  </div>
                ) : null}

                {local.hours_logged != null ? (
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-sm text-gray-500">Total</span>
                    <span className="text-sm font-bold text-gray-800">{local.hours_logged} hrs</span>
                  </div>
                ) : ['done', 'payment_pending', 'paid'].includes(local.status) ? (
                  <div className="px-4 py-3">
                    <p className="text-xs text-gray-400 mb-2">Enter hours manually</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        value={manualHours}
                        onChange={e => setManualHours(e.target.value)}
                        placeholder="0.0"
                        className="flex-1 h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                      <button
                        onClick={handleSaveHours}
                        disabled={savingHours}
                        className="h-10 px-4 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                        style={{ backgroundColor: '#2C5F8A' }}
                      >
                        {savingHours ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-3">
                    <span className="text-sm text-gray-400">No time logged yet</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Payment ── */}
          {showPaymentSection && (
            <>
              <SectionLabel>Payment</SectionLabel>

              {local.status === 'paid' ? (
                <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-green-700">Paid ✓</p>
                    {local.payment_method && (
                      <p className="text-xs text-green-600 mt-0.5">
                        via {local.payment_method}
                        {local.payment_date ? ` · ${formatPaymentDate(local.payment_date)}` : ''}
                      </p>
                    )}
                  </div>
                  {local.actual_amount != null && (
                    <span className="text-lg font-bold text-green-700">${local.actual_amount.toFixed(0)}</span>
                  )}
                </div>
              ) : payStep === 'idle' ? (
                <button
                  onClick={startPayment}
                  className="w-full h-12 rounded-2xl font-semibold text-white text-sm"
                  style={{ backgroundColor: '#D97706' }}
                >
                  Log Payment
                </button>
              ) : payStep === 'amount' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-amber-800">How much was paid?</p>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-medium">$</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      className="flex-1 h-11 rounded-xl border border-amber-200 bg-white px-3 text-base font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPayStep('idle')}
                      className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePayAmountNext}
                      className="flex-1 h-10 rounded-xl text-white text-sm font-semibold"
                      style={{ backgroundColor: '#2C5F8A' }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : payStep === 'mismatch' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-amber-800">
                    ⚠️ This doesn&apos;t match the expected amount of ${local.expected_amount?.toFixed(0)}. Is this correct?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPayStep('amount')}
                      className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium"
                    >
                      No, edit
                    </button>
                    <button
                      onClick={() => setPayStep('method')}
                      className="flex-1 h-10 rounded-xl text-white text-sm font-semibold"
                      style={{ backgroundColor: '#D97706' }}
                    >
                      Yes, continue
                    </button>
                  </div>
                </div>
              ) : payStep === 'method' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-amber-800">Payment method</p>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_METHODS.map(m => (
                      <button
                        key={m}
                        onClick={() => setPayMethod(m)}
                        className={`h-10 px-4 rounded-full text-sm font-medium border transition-colors ${
                          payMethod === m
                            ? 'border-amber-500 bg-amber-500 text-white'
                            : 'border-gray-200 bg-white text-gray-700'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleConfirmPayment}
                    disabled={!payMethod || payLoading}
                    className="w-full h-12 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                    style={{ backgroundColor: '#0E9F8E' }}
                  >
                    {payLoading ? 'Saving…' : `Confirm Payment · $${parseFloat(payAmount || '0').toFixed(0)}`}
                  </button>
                </div>
              ) : null}
            </>
          )}

          {/* Spacer before action buttons */}
          <div className="h-4" />
        </div>

        {/* ── Action buttons (sticky at bottom) ── */}
        <div className="shrink-0 px-5 pt-3 pb-8 border-t border-gray-100 space-y-2 bg-white">
          {local.status === 'scheduled' && (
            <button
              onClick={handleArrive}
              className="w-full h-12 rounded-xl font-semibold text-white text-sm"
              style={{ backgroundColor: '#0E9F8E' }}
            >
              Arrive
            </button>
          )}
          {(local.status === 'arrived' || local.status === 'in_progress') && (
            <button
              onClick={handleMarkDone}
              className="w-full h-12 rounded-xl font-semibold text-white text-sm"
              style={{ backgroundColor: '#0E9F8E' }}
            >
              Mark Done
            </button>
          )}

          {/* Cancel */}
          {!['paid', 'cancelled'].includes(local.status) && (
            confirmCancel ? (
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500 flex-1">Cancel this clean?</p>
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="text-xs font-medium text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200"
                >
                  No
                </button>
                <button
                  onClick={handleCancelClean}
                  className="text-xs font-medium text-red-600 px-3 py-1.5 rounded-lg border border-red-200"
                >
                  Yes, cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmCancel(true)}
                className="w-full text-xs font-medium text-red-400 py-2 text-center"
              >
                Cancel Clean
              </button>
            )
          )}
        </div>
      </div>
    </>
  )
}

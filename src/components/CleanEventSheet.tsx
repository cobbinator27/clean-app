'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { CleanEvent, CleanCustomer, EventStatus } from '@/types/clean'
import { formatTime, formatDateLong, formatPaymentDate, toLocalDateString } from '@/lib/date-utils'
import StatusPicker from '@/components/StatusPicker'

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

const ALL_STATUSES: EventStatus[] = [
  'scheduled', 'arrived', 'in_progress', 'done', 'payment_pending', 'paid', 'cancelled',
]

const eventTypeLabels: Record<string, string> = {
  one_off:    'One-Off',
  move_out:   'Move-Out',
  deep_clean: 'Deep Clean',
  other:      'Other',
}

const PAYMENT_METHODS = ['Venmo', 'Check', 'Cash', 'Other']
// DB constraint expects lowercase — always lowercase before saving
function toDbPaymentMethod(m: string): string { return m.toLowerCase() }
// Display stored value with first letter capitalized
function displayPaymentMethod(m: string): string { return m.charAt(0).toUpperCase() + m.slice(1) }

function todayDateString(): string {
  return toLocalDateString(new Date())
}

function timeInputValueFromISO(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Build an ISO timestamp from the event's scheduled_date + a "HH:MM" time string */
function isoFromScheduledDateAndTime(scheduledDate: string, timeStr: string): string {
  const [y, m, d] = scheduledDate.split('-').map(Number)
  const [h, min] = timeStr.split(':').map(Number)
  return new Date(y, m - 1, d, h, min, 0, 0).toISOString()
}

function calcHours(arrivedISO: string, leftISO: string): number {
  const ms = new Date(leftISO).getTime() - new Date(arrivedISO).getTime()
  return Math.round((ms / 3600000) * 100) / 100
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 mt-5">
      {children}
    </p>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="9" y="2" width="6" height="4" rx="1" ry="1" />
      <path d="M15 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  )
}

function CheckIcon({ className = 'w-4 h-4 text-green-500' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-3.5 h-3.5">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
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
    if (event) requestAnimationFrame(() => setVisible(true))
    else setVisible(false)
  }, [event])

  // Local event state
  const [local, setLocal] = useState<FullEvent | null>(null)
  useEffect(() => { if (event) setLocal(event) }, [event])

  // Notes
  const [notes, setNotes] = useState('')
  useEffect(() => { setNotes(local?.notes ?? '') }, [local?.id])

  // Time inputs — synced on event open
  const [arrivedInput, setArrivedInput] = useState('')
  const [departedInput, setDepartedInput] = useState('')
  useEffect(() => {
    setArrivedInput(local?.arrived_at ? timeInputValueFromISO(local.arrived_at) : '')
    setDepartedInput(local?.left_at ? timeInputValueFromISO(local.left_at) : '')
  }, [local?.id])

  // Hours override
  const [hoursOverride, setHoursOverride] = useState(false)
  const [manualHoursInput, setManualHoursInput] = useState('')
  useEffect(() => {
    setHoursOverride(local?.hours_manual_override === true)
    setManualHoursInput(local?.hours_logged != null ? String(local.hours_logged) : '')
  }, [local?.id])

  // Saved indicator
  const [savedField, setSavedField] = useState<string | null>(null)
  function showSaved(field: string) {
    setSavedField(field)
    setTimeout(() => setSavedField(null), 1000)
  }

  // Payment flow
  const [payStep, setPayStep] = useState<PayStep>('idle')
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<string | null>(null)
  const [payLoading, setPayLoading] = useState(false)

  // Cancel confirm
  const [confirmCancel, setConfirmCancel] = useState(false)

  // Reschedule flow
  type RescheduleStep = 'idle' | 'picking' | 'choosing'
  const [rescheduleStep, setRescheduleStep] = useState<RescheduleStep>('idle')
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleLoading, setRescheduleLoading] = useState(false)

  // Header status picker (pencil icon)
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const [clearTimesConfirm, setClearTimesConfirm] = useState(false)

  // Status modal (long press on action button)
  const [showStatusModal, setShowStatusModal] = useState(false)

  // Long press refs
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const darkenTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggered = useRef(false)
  const [btnDarkened, setBtnDarkened] = useState(false)

  // Address copy
  const [copiedAddress, setCopiedAddress] = useState(false)

  const sheetRef = useRef<HTMLDivElement>(null)

  if (!event || !local) return null

  const sc = statusConfig[local.status]
  const customer = local.customer

  // ── Core patch ────────────────────────────────────────────────────────────

  async function patch(updates: Partial<CleanEvent>) {
    const updated = { ...local!, ...updates }
    setLocal(updated)
    onUpdate(updated)
    const { error } = await supabase.from('clean_events').update(updates).eq('id', local!.id)
    if (error) console.error('[CleanEventSheet] patch failed:', error.message, '| updates:', updates)
  }

  // ── Long press logic ──────────────────────────────────────────────────────

  function startLongPress() {
    longPressTriggered.current = false
    darkenTimer.current = setTimeout(() => setBtnDarkened(true), 300)
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true
      setBtnDarkened(false)
      setShowStatusModal(true)
    }, 500)
  }

  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    if (darkenTimer.current) clearTimeout(darkenTimer.current)
    longPressTimer.current = null
    darkenTimer.current = null
    setBtnDarkened(false)
  }

  function longPressProps(tapAction: () => void) {
    return {
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      onMouseDown: startLongPress,
      onMouseUp: cancelLongPress,
      onMouseLeave: cancelLongPress,
      onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); startLongPress() },
      onTouchEnd: cancelLongPress,
      onTouchMove: cancelLongPress,
      onClick: () => {
        if (longPressTriggered.current) {
          longPressTriggered.current = false
          return
        }
        tapAction()
      },
    }
  }

  // ── Status picker (header pencil) ─────────────────────────────────────────

  async function handleStatusPick(newStatus: EventStatus) {
    if (!local) return
    if (newStatus === local.status) {
      setShowStatusPicker(false)
      setShowStatusModal(false)
      return
    }

    if (newStatus === 'paid') {
      setShowStatusPicker(false)
      setShowStatusModal(false)
      if (local.actual_amount == null) { startPayment(); return }
      await patch({ status: 'paid' })
      return
    }

    if (newStatus === 'scheduled' && (local.arrived_at || local.left_at)) {
      setShowStatusPicker(false)
      setShowStatusModal(false)
      setClearTimesConfirm(true)
      return
    }

    setShowStatusPicker(false)
    setShowStatusModal(false)
    await patch({ status: newStatus })
  }

  async function handleClearTimesYes() {
    setClearTimesConfirm(false)
    setArrivedInput('')
    setDepartedInput('')
    await patch({ status: 'scheduled', arrived_at: null, left_at: null })
  }

  async function handleClearTimesNo() {
    setClearTimesConfirm(false)
    await patch({ status: 'scheduled' })
  }

  // ── Action button tap handlers ────────────────────────────────────────────

  async function handleArrive() {
    const now = new Date()
    const iso = now.toISOString()
    setArrivedInput(timeInputValueFromISO(iso))
    await patch({ status: 'arrived', arrived_at: iso })
  }

  async function handleMarkDone() {
    const now = new Date()
    const arrivedAt = local!.arrived_at ? new Date(local!.arrived_at) : null
    const hoursLogged = arrivedAt
      ? Math.round(((now.getTime() - arrivedAt.getTime()) / 3600000) * 100) / 100
      : null
    const iso = now.toISOString()
    setDepartedInput(timeInputValueFromISO(iso))
    await patch({ status: 'done', left_at: iso, hours_logged: hoursLogged })
  }

  async function handleNoteBlur() {
    if (notes === (local!.notes ?? '')) return
    await patch({ notes })
  }

  // ── Time tracking ─────────────────────────────────────────────────────────

  async function handleArrivedBlur() {
    if (!arrivedInput) return
    const iso = isoFromScheduledDateAndTime(local!.scheduled_date, arrivedInput)
    if (iso === local!.arrived_at) return
    if (local!.left_at && !hoursOverride) {
      const h = calcHours(iso, local!.left_at)
      setManualHoursInput(String(h))
      await patch({ arrived_at: iso, hours_logged: h })
    } else {
      await patch({ arrived_at: iso })
    }
    showSaved('arrived')
  }

  async function handleDepartedBlur() {
    if (!departedInput) return
    const iso = isoFromScheduledDateAndTime(local!.scheduled_date, departedInput)
    if (iso === local!.left_at) return
    if (local!.arrived_at && !hoursOverride) {
      const h = calcHours(local!.arrived_at, iso)
      setManualHoursInput(String(h))
      await patch({ left_at: iso, hours_logged: h })
    } else {
      await patch({ left_at: iso })
    }
    showSaved('departed')
  }

  async function handleClearArrived() {
    setArrivedInput('')
    await patch({ arrived_at: null })
  }

  async function handleClearDeparted() {
    setDepartedInput('')
    await patch({ left_at: null })
  }

  async function handleManualHoursBlur() {
    const h = parseFloat(manualHoursInput)
    if (isNaN(h) || h < 0) return
    await patch({ hours_logged: h, hours_manual_override: true })
    setHoursOverride(true)
    showSaved('hours')
  }

  async function handleResetHoursToAuto() {
    if (!local?.arrived_at || !local?.left_at) return
    const h = calcHours(local.arrived_at, local.left_at)
    setManualHoursInput(String(h))
    setHoursOverride(false)
    await patch({ hours_logged: h, hours_manual_override: false })
  }

  // ── Address copy ──────────────────────────────────────────────────────────

  function handleCopyAddress() {
    if (!customer.address) return
    navigator.clipboard.writeText(customer.address).then(() => {
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 1500)
    })
  }

  // ── Payment flow ──────────────────────────────────────────────────────────

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
    const payUpdates = {
      actual_amount: parseFloat(payAmount),
      payment_method: toDbPaymentMethod(payMethod!),
      payment_date: todayDateString(),
      status: 'paid' as const,
    }
    console.log('=== LOGGING PAYMENT ===')
    console.log('event id:', local!.id)
    console.log('updates:', JSON.stringify(payUpdates))
    const { error } = await supabase.from('clean_events').update(payUpdates).eq('id', local!.id)
    console.log('payment save error:', error)
    if (!error) {
      const updated = { ...local!, ...payUpdates }
      setLocal(updated)
      onUpdate(updated)
    }
    setPayStep('idle')
    setPayLoading(false)
  }

  async function handleCancelClean() {
    await patch({ status: 'cancelled' })
    setConfirmCancel(false)
    onClose()
  }

  // ── Reschedule ────────────────────────────────────────────────────────────

  const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

  function getDayName(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    return DAY_NAMES[new Date(y, m - 1, d).getDay()]
  }

  async function handleRescheduleJustThis() {
    setRescheduleLoading(true)
    await patch({ scheduled_date: rescheduleDate })
    setRescheduleStep('idle')
    setRescheduleLoading(false)
    onClose()
  }

  async function handleRescheduleAllFuture() {
    if (!local) return
    setRescheduleLoading(true)
    const newDayOfWeek = getDayName(rescheduleDate)
    const customerId = local.customer_id

    await supabase.from('clean_customers').update({
      recurrence_day: newDayOfWeek,
      recurrence_start: rescheduleDate,
    }).eq('id', customerId)

    await supabase.from('clean_events')
      .delete()
      .eq('customer_id', customerId)
      .eq('status', 'scheduled')
      .gt('scheduled_date', todayDateString())
      .is('arrived_at', null)
      .is('notes', null)
      .neq('id', local.id)

    await patch({ scheduled_date: rescheduleDate })
    setRescheduleStep('idle')
    setRescheduleLoading(false)
    onClose()
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const showPaymentSection = ['done', 'payment_pending', 'paid'].includes(local.status)
  const bothTimesSet = !!(local.arrived_at && local.left_at)
  const autoHours = bothTimesSet ? calcHours(local.arrived_at!, local.left_at!) : null

  // Which action button bgColor (darkens on long-press hold)
  const actionBgColor = btnDarkened ? '#0a7a6e' : '#0E9F8E'

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
        style={{ maxHeight: '90vh', transform: visible ? 'translateY(0)' : 'translateY(100%)' }}
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
                onClick={() => { setShowStatusPicker(p => !p); setClearTimesConfirm(false) }}
                className="flex items-center justify-center w-7 h-7 rounded-full text-gray-400 active:bg-gray-100"
                aria-label="Change status"
              >
                <PencilIcon />
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 active:bg-gray-200"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-4 h-4">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Inline status picker (pencil) */}
          {showStatusPicker && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 mb-2 flex flex-wrap gap-2">
              {ALL_STATUSES.map(s => {
                const cfg = statusConfig[s]
                const active = local.status === s
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusPick(s)}
                    className={`h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${
                      active ? `${cfg.color} border-transparent` : 'bg-white border-gray-200 text-gray-600'
                    }`}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Clear times confirm */}
          {clearTimesConfirm && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-2 space-y-2">
              <p className="text-sm text-amber-800 font-medium">Also clear arrival and departure times?</p>
              <div className="flex gap-2">
                <button onClick={handleClearTimesNo} className="flex-1 h-9 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium bg-white">
                  No, keep times
                </button>
                <button onClick={handleClearTimesYes} className="flex-1 h-9 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: '#D97706' }}>
                  Yes, clear
                </button>
              </div>
            </div>
          )}

          {/* ── Details ── */}
          <SectionLabel>Details</SectionLabel>
          <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-sm text-gray-500">Date</span>
              <span className="text-sm font-medium text-gray-800">{formatDateLong(local.scheduled_date)}</span>
            </div>
            {local.scheduled_time && (
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-sm text-gray-500">Scheduled time</span>
                <span className="text-sm font-medium text-gray-800">{formatTime(local.scheduled_time)}</span>
              </div>
            )}
            {customer.address && (
              <div className="flex justify-between items-center px-4 py-3 gap-3">
                <span className="text-sm text-gray-500 shrink-0">Address</span>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-gray-800 text-right truncate">{customer.address}</span>
                  <button onClick={handleCopyAddress} className="shrink-0 text-gray-400 active:text-gray-600 transition-colors" aria-label="Copy address">
                    {copiedAddress ? <CheckIcon /> : <ClipboardIcon />}
                  </button>
                </div>
              </div>
            )}
            {local.expected_amount != null && (
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-sm text-gray-500">Expected</span>
                <span className="text-sm font-semibold text-gray-800">${local.expected_amount.toFixed(0)}</span>
              </div>
            )}
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
          <SectionLabel>Time Tracking</SectionLabel>
          <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100 overflow-hidden">

            {/* Arrived row */}
            <div className="flex items-center justify-between px-4 py-3 gap-3">
              <span className="text-sm text-gray-500 shrink-0 w-20">Arrived</span>
              <div className="flex items-center gap-2 flex-1 justify-end">
                <input
                  type="time"
                  value={arrivedInput}
                  onChange={e => setArrivedInput(e.target.value)}
                  onBlur={handleArrivedBlur}
                  className="h-9 rounded-xl border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                {local.arrived_at && (
                  <button onClick={handleClearArrived} className="text-red-400 active:text-red-600 shrink-0" aria-label="Clear arrival time">
                    <XIcon />
                  </button>
                )}
                {savedField === 'arrived' && <span className="text-xs text-green-500 font-medium shrink-0">Saved</span>}
              </div>
            </div>

            {/* Departed row */}
            <div className="flex items-center justify-between px-4 py-3 gap-3">
              <span className="text-sm text-gray-500 shrink-0 w-20">Departed</span>
              <div className="flex items-center gap-2 flex-1 justify-end">
                <input
                  type="time"
                  value={departedInput}
                  onChange={e => setDepartedInput(e.target.value)}
                  onBlur={handleDepartedBlur}
                  className="h-9 rounded-xl border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                {local.left_at && (
                  <button onClick={handleClearDeparted} className="text-red-400 active:text-red-600 shrink-0" aria-label="Clear departure time">
                    <XIcon />
                  </button>
                )}
                {savedField === 'departed' && <span className="text-xs text-green-500 font-medium shrink-0">Saved</span>}
              </div>
            </div>

            {/* Total hours row */}
            {bothTimesSet && !hoursOverride ? (
              <div className="flex items-center justify-between px-4 py-3 gap-3">
                <span className="text-sm text-gray-500 shrink-0 w-20">Total hours</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800">{autoHours} hrs</span>
                  <span className="text-xs font-medium text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">auto</span>
                  <button
                    onClick={() => setHoursOverride(true)}
                    className="text-xs font-medium text-gray-400 underline-offset-2 hover:underline"
                  >
                    Override
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Total hours</span>
                  <div className="flex items-center gap-2">
                    {hoursOverride && (
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">manual</span>
                    )}
                    {hoursOverride && bothTimesSet && (
                      <button
                        onClick={handleResetHoursToAuto}
                        className="text-xs font-medium text-gray-400 underline-offset-2 hover:underline"
                      >
                        Reset to auto
                      </button>
                    )}
                    {savedField === 'hours' && <span className="text-xs text-green-500 font-medium">Saved</span>}
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={manualHoursInput}
                  onChange={e => setManualHoursInput(e.target.value)}
                  onBlur={handleManualHoursBlur}
                  placeholder="0.00"
                  className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            )}
          </div>

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
                        via {displayPaymentMethod(local.payment_method)}
                        {local.payment_date ? ` · ${formatPaymentDate(local.payment_date)}` : ''}
                      </p>
                    )}
                  </div>
                  {local.actual_amount != null && (
                    <span className="text-lg font-bold text-green-700">${local.actual_amount.toFixed(0)}</span>
                  )}
                </div>
              ) : payStep === 'idle' ? (
                <button onClick={startPayment} className="w-full h-12 rounded-2xl font-semibold text-white text-sm" style={{ backgroundColor: '#D97706' }}>
                  Log Payment
                </button>
              ) : payStep === 'amount' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-amber-800">How much was paid?</p>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-medium">$</span>
                    <input
                      type="number" min="0" step="1" value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      className="flex-1 h-11 rounded-xl border border-amber-200 bg-white px-3 text-base font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setPayStep('idle')} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium">Cancel</button>
                    <button onClick={handlePayAmountNext} className="flex-1 h-10 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: '#2C5F8A' }}>Next</button>
                  </div>
                </div>
              ) : payStep === 'mismatch' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-amber-800">
                    ⚠️ This doesn&apos;t match the expected amount of ${local.expected_amount?.toFixed(0)}. Is this correct?
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setPayStep('amount')} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium">No, edit</button>
                    <button onClick={() => setPayStep('method')} className="flex-1 h-10 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: '#D97706' }}>Yes, continue</button>
                  </div>
                </div>
              ) : payStep === 'method' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-amber-800">Payment method</p>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_METHODS.map(m => (
                      <button key={m} onClick={() => setPayMethod(m)}
                        className={`h-10 px-4 rounded-full text-sm font-medium border transition-colors ${payMethod === m ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-200 bg-white text-gray-700'}`}
                      >{m}</button>
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

          <div className="h-4" />
        </div>

        {/* ── Action buttons ── */}
        <div className="shrink-0 px-5 pt-3 pb-8 border-t border-gray-100 space-y-2 bg-white">

          {local.status === 'scheduled' && (
            <button
              className="w-full h-12 rounded-xl font-semibold text-white text-sm select-none transition-colors"
              style={{ backgroundColor: actionBgColor }}
              {...longPressProps(handleArrive)}
            >
              Arrive
            </button>
          )}

          {(local.status === 'arrived' || local.status === 'in_progress') && (
            <button
              className="w-full h-12 rounded-xl font-semibold text-white text-sm select-none transition-colors"
              style={{ backgroundColor: actionBgColor }}
              {...longPressProps(handleMarkDone)}
            >
              Mark Done
            </button>
          )}

          {(local.status === 'done' || local.status === 'payment_pending') && (
            <button
              className="w-full h-12 rounded-xl font-semibold text-white text-sm select-none transition-colors"
              style={{ backgroundColor: btnDarkened ? '#b05e00' : '#D97706' }}
              {...longPressProps(startPayment)}
            >
              Log Payment
            </button>
          )}

          {/* Reschedule */}
          {local.status === 'scheduled' && rescheduleStep === 'idle' && (
            <button
              onClick={() => { setRescheduleDate(local.scheduled_date); setRescheduleStep('picking') }}
              className="w-full h-11 rounded-xl font-semibold text-sm border border-gray-300 text-gray-600 bg-white"
            >
              Reschedule Clean
            </button>
          )}

          {/* Reschedule date picker */}
          {local.status === 'scheduled' && rescheduleStep === 'picking' && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Choose a new date</p>
              <input
                type="date" value={rescheduleDate} min={todayDateString()}
                onChange={e => setRescheduleDate(e.target.value)}
                className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <div className="flex gap-2">
                <button onClick={() => setRescheduleStep('idle')} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium bg-white">Cancel</button>
                <button
                  onClick={() => rescheduleDate && setRescheduleStep('choosing')}
                  disabled={!rescheduleDate}
                  className="flex-1 h-10 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                  style={{ backgroundColor: '#2C5F8A' }}
                >
                  Set New Date
                </button>
              </div>
            </div>
          )}

          {/* Cancel clean */}
          {!['paid', 'cancelled'].includes(local.status) && rescheduleStep === 'idle' && (
            confirmCancel ? (
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500 flex-1">Cancel this clean?</p>
                <button onClick={() => setConfirmCancel(false)} className="text-xs font-medium text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200">No</button>
                <button onClick={handleCancelClean} className="text-xs font-medium text-red-600 px-3 py-1.5 rounded-lg border border-red-200">Yes, cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmCancel(true)} className="w-full text-xs font-medium text-red-400 py-2 text-center">
                Cancel Clean
              </button>
            )
          )}
        </div>
      </div>

      {/* Reschedule choice overlay */}
      {rescheduleStep === 'choosing' && (
        <div className="fixed inset-0 flex items-end justify-center bg-black/50" style={{ zIndex: 60 }}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 pb-10 space-y-3">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <p className="text-base font-bold text-gray-900 text-center mb-1">Reschedule to {rescheduleDate}</p>
            <p className="text-xs text-gray-400 text-center mb-4">How would you like to apply this change?</p>
            <button onClick={handleRescheduleJustThis} disabled={rescheduleLoading}
              className="w-full bg-white border-2 border-gray-200 rounded-2xl p-4 text-left active:bg-gray-50 disabled:opacity-50">
              <p className="font-semibold text-gray-800 text-sm">Just this clean</p>
              <p className="text-xs text-gray-400 mt-0.5">Move only this appointment</p>
            </button>
            <button onClick={handleRescheduleAllFuture} disabled={rescheduleLoading}
              className="w-full border-2 rounded-2xl p-4 text-left active:opacity-90 disabled:opacity-50"
              style={{ borderColor: '#2C5F8A', backgroundColor: '#EEF4FA' }}>
              <p className="font-semibold text-sm" style={{ color: '#2C5F8A' }}>This and all future cleans</p>
              <p className="text-xs text-gray-500 mt-0.5">Update {local.customer.name}&apos;s recurring schedule going forward</p>
            </button>
            <button onClick={() => setRescheduleStep('picking')} disabled={rescheduleLoading}
              className="w-full text-sm font-medium text-gray-400 py-2 text-center">
              {rescheduleLoading ? 'Saving…' : 'Back'}
            </button>
          </div>
        </div>
      )}

      {/* Status picker modal (long press on action button) */}
      {showStatusModal && (
        <StatusPicker
          currentStatus={local.status}
          onSelect={handleStatusPick}
          onClose={() => setShowStatusModal(false)}
        />
      )}
    </>
  )
}

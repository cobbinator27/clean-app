'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { CleanEvent, CleanCustomer, EventStatus } from '@/types/clean'
import CleanEventSheet from '@/components/CleanEventSheet'
import AddCleanSheet from '@/components/AddCleanSheet'
import StatusPicker from '@/components/StatusPicker'
import {
  getWeekMonday,
  addDays,
  toLocalDateString,
  formatWeekHeader,
  formatDayHeader,
  formatTime,
  isToday,
  isPast,
} from '@/lib/date-utils'

type FullEvent = CleanEvent & { customer: CleanCustomer }

// ── Status config ─────────────────────────────────────────────────────────────

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

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="h-5 bg-gray-200 rounded w-36" />
        <div className="h-5 bg-gray-200 rounded w-16" />
      </div>
      <div className="h-4 bg-gray-100 rounded w-48 mb-4" />
      <div className="h-11 bg-gray-100 rounded-xl w-full" />
    </div>
  )
}

// ── Event Card ────────────────────────────────────────────────────────────────

function EventCard({
  event,
  onStatusUpdate,
  onTap,
  onOpenSheet,
}: {
  event: CleanEvent
  onStatusUpdate: (id: string, updates: Partial<CleanEvent>) => void
  onTap: (event: CleanEvent) => void
  onOpenSheet: (event: CleanEvent) => void
}) {
  const customer = event.customer
  const status = event.status
  const sc = statusConfig[status]

  const [showPicker, setShowPicker] = useState(false)
  const [badgeDark, setBadgeDark] = useState(false)
  const [clearTimesConfirm, setClearTimesConfirm] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<EventStatus | null>(null)

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const darkenTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggered = useRef(false)

  function startBadgeLongPress() {
    longPressTriggered.current = false
    darkenTimer.current = setTimeout(() => setBadgeDark(true), 300)
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true
      setBadgeDark(false)
      setShowPicker(true)
    }, 500)
  }

  function cancelBadgeLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    if (darkenTimer.current) clearTimeout(darkenTimer.current)
    longPressTimer.current = null
    darkenTimer.current = null
    setBadgeDark(false)
  }

  function handleArrive(e: React.MouseEvent) {
    e.stopPropagation()
    onStatusUpdate(event.id, { status: 'arrived', arrived_at: new Date().toISOString() })
  }

  function handleDone(e: React.MouseEvent) {
    e.stopPropagation()
    const now = new Date()
    const arrivedAt = event.arrived_at ? new Date(event.arrived_at) : null
    const hoursLogged = arrivedAt
      ? Math.round(((now.getTime() - arrivedAt.getTime()) / 3600000) * 100) / 100
      : null
    onStatusUpdate(event.id, { status: 'done', left_at: now.toISOString(), hours_logged: hoursLogged })
  }

  function handlePickStatus(newStatus: EventStatus) {
    setShowPicker(false)
    if (newStatus === status) return

    if (newStatus === 'paid' && event.actual_amount == null) {
      // Open sheet to handle payment flow
      onOpenSheet(event)
      return
    }

    if (newStatus === 'scheduled' && (event.arrived_at || event.left_at)) {
      setPendingStatus(newStatus)
      setClearTimesConfirm(true)
      return
    }

    onStatusUpdate(event.id, { status: newStatus })
  }

  function handleClearTimesYes() {
    if (pendingStatus) onStatusUpdate(event.id, { status: pendingStatus, arrived_at: null, left_at: null })
    setClearTimesConfirm(false)
    setPendingStatus(null)
  }

  function handleClearTimesNo() {
    if (pendingStatus) onStatusUpdate(event.id, { status: pendingStatus })
    setClearTimesConfirm(false)
    setPendingStatus(null)
  }

  // Compute badge color — slightly darker when long-press held
  const badgeClass = badgeDark
    ? sc.color.replace('100', '200')
    : sc.color

  return (
    <>
      <div
        className="bg-white rounded-2xl shadow-sm p-4 active:scale-[0.99] transition-transform cursor-pointer"
        onClick={() => onTap(event)}
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="font-bold text-gray-900 leading-snug" style={{ fontSize: 18 }}>
            {customer?.name ?? 'Unknown Customer'}
          </span>
          {/* Status badge — long press opens picker */}
          <span
            className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${badgeClass}`}
            style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
            onContextMenu={e => { e.preventDefault(); e.stopPropagation() }}
            onMouseDown={e => { e.stopPropagation(); startBadgeLongPress() }}
            onMouseUp={e => { e.stopPropagation(); cancelBadgeLongPress() }}
            onMouseLeave={e => { e.stopPropagation(); cancelBadgeLongPress() }}
            onTouchStart={e => { e.preventDefault(); e.stopPropagation(); startBadgeLongPress() }}
            onTouchEnd={e => { e.stopPropagation(); cancelBadgeLongPress() }}
            onTouchMove={e => { e.stopPropagation(); cancelBadgeLongPress() }}
            onClick={e => {
              e.stopPropagation()
              if (longPressTriggered.current) { longPressTriggered.current = false }
            }}
          >
            {sc.label}
          </span>
        </div>

        {/* Address */}
        {customer?.address && (
          <p className="text-sm text-gray-400 mb-2 leading-snug">{customer.address}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          {event.scheduled_time && (
            <span className="text-sm text-gray-500">{formatTime(event.scheduled_time)}</span>
          )}
          {event.expected_amount != null && (
            <span className="text-base font-semibold text-gray-800">
              ${event.expected_amount.toFixed(0)}
            </span>
          )}
          {event.event_type !== 'regular' && eventTypeLabels[event.event_type] && (
            <span className="text-xs font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
              {eventTypeLabels[event.event_type]}
            </span>
          )}
        </div>

        {/* Action button */}
        {status === 'scheduled' && (
          <button
            onClick={handleArrive}
            className="w-full h-11 rounded-xl font-semibold text-white text-sm transition-opacity active:opacity-80"
            style={{ backgroundColor: '#0E9F8E' }}
          >
            Arrive
          </button>
        )}
        {(status === 'arrived' || status === 'in_progress') && (
          <button
            onClick={handleDone}
            className="w-full h-11 rounded-xl font-semibold text-white text-sm transition-opacity active:opacity-80"
            style={{ backgroundColor: '#0E9F8E' }}
          >
            Mark Done
          </button>
        )}
        {(status === 'done' || status === 'payment_pending') && (
          <button
            onClick={e => { e.stopPropagation(); onOpenSheet(event) }}
            className="w-full h-11 rounded-xl font-semibold text-white text-sm transition-opacity active:opacity-80"
            style={{ backgroundColor: '#D97706' }}
          >
            Log Payment
          </button>
        )}

        {/* Clear times confirm (rendered inside card to avoid layout shift) */}
        {clearTimesConfirm && (
          <div
            className="mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-2"
            onClick={e => e.stopPropagation()}
          >
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
      </div>

      {/* Status picker modal */}
      {showPicker && (
        <StatusPicker
          currentStatus={status}
          onSelect={handlePickStatus}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

// ── Customer color palette ───────────────────────────────────────────────────

const CUSTOMER_COLORS = [
  '#2C5F8A', '#0E9F8E', '#D97706', '#7C3AED', '#DC2626',
  '#2563EB', '#059669', '#CA8A04', '#9333EA', '#E11D48',
  '#0891B2', '#65A30D', '#EA580C', '#6D28D9', '#DB2777',
]

function customerColor(customerId: string): string {
  let hash = 0
  for (let i = 0; i < customerId.length; i++) {
    hash = ((hash << 5) - hash + customerId.charCodeAt(i)) | 0
  }
  return CUSTOMER_COLORS[Math.abs(hash) % CUSTOMER_COLORS.length]
}

function customerFirstName(name: string): string {
  return name.split(' ')[0]
}

// ── Month calendar grid ─────────────────────────────────────────────────────

function MonthCalendar({
  monthDate,
  events,
  onDayTap,
}: {
  monthDate: Date // any date in the target month
  events: CleanEvent[]
  onDayTap: (date: Date) => void
}) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()

  // Build grid: start on Sunday of the week containing the 1st
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)
  const firstDow = firstOfMonth.getDay() // 0=Sun
  const gridStart = addDays(firstOfMonth, -firstDow)
  // End on Saturday of the week containing the last day
  const lastDow = lastOfMonth.getDay() // 0=Sun
  const gridEnd = lastDow === 6
    ? lastOfMonth
    : addDays(lastOfMonth, 6 - lastDow)

  // Build array of dates
  const days: Date[] = []
  let cursor = gridStart
  while (cursor <= gridEnd) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }

  // Index events by date
  const eventsByDate = new Map<string, CleanEvent[]>()
  for (const e of events) {
    const key = e.scheduled_date
    if (!eventsByDate.has(key)) eventsByDate.set(key, [])
    eventsByDate.get(key)!.push(e)
  }

  const todayStr = toLocalDateString(new Date())

  return (
    <div className="px-4 pt-3 pb-2">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map(day => {
          const dateStr = toLocalDateString(day)
          const inMonth = day.getMonth() === month
          const today = dateStr === todayStr
          const dayEvents = eventsByDate.get(dateStr) ?? []
          const nonCancelled = dayEvents.filter(e => e.status !== 'cancelled')

          return (
            <button
              key={dateStr}
              onClick={() => onDayTap(day)}
              className={`flex flex-col items-center py-1.5 px-0.5 rounded-xl min-h-[60px] transition-colors
                ${today ? 'bg-[#2C5F8A]/10' : 'active:bg-gray-50'}
                ${!inMonth ? 'opacity-30' : ''}
              `}
            >
              <span className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                ${today ? 'bg-[#2C5F8A] text-white' : 'text-gray-600'}
              `}>
                {day.getDate()}
              </span>
              {nonCancelled.length > 0 && (
                <div className="flex flex-col items-center gap-[2px] w-full overflow-hidden">
                  {nonCancelled.slice(0, 3).map(e => (
                    <div key={e.id} className="flex items-center gap-[3px] max-w-full">
                      <span
                        className="w-[5px] h-[5px] rounded-full shrink-0"
                        style={{ backgroundColor: customerColor(e.customer_id) }}
                      />
                      <span className="text-[9px] text-gray-600 truncate leading-tight">
                        {customerFirstName(e.customer?.name ?? '?')}
                      </span>
                    </div>
                  ))}
                  {nonCancelled.length > 3 && (
                    <span className="text-[8px] text-gray-400">+{nonCancelled.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const supabase = createClient()
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekMonday(new Date()))
  const [monthDate, setMonthDate] = useState<Date>(() => new Date())
  const [events, setEvents] = useState<CleanEvent[]>([])
  const [monthEvents, setMonthEvents] = useState<CleanEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [monthLoading, setMonthLoading] = useState(false)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [customers, setCustomers] = useState<CleanCustomer[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<FullEvent | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Load household_id and customers once
  useEffect(() => {
    async function loadHousehold() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single()
      if (data) {
        setHouseholdId(data.household_id)
        const { data: cxData } = await supabase
          .from('clean_customers')
          .select('*')
          .eq('household_id', data.household_id)
          .eq('status', 'active')
          .order('name')
        setCustomers((cxData ?? []) as CleanCustomer[])
      }
    }
    loadHousehold()
  }, [])

  // Load events whenever week or householdId changes
  const loadEvents = useCallback(async () => {
    if (!householdId) return
    setLoading(true)
    const weekEnd = addDays(weekStart, 6)
    const { data } = await supabase
      .from('clean_events')
      .select('*, customer:clean_customers(*)')
      .eq('household_id', householdId)
      .gte('scheduled_date', toLocalDateString(weekStart))
      .lte('scheduled_date', toLocalDateString(weekEnd))
      .order('scheduled_date')
      .order('scheduled_time', { ascending: true, nullsFirst: true })
    setEvents((data as CleanEvent[]) ?? [])
    setLoading(false)
  }, [householdId, weekStart])

  useEffect(() => {
    if (householdId) loadEvents()
    else setLoading(false)
  }, [householdId, loadEvents])

  // Load month events when in month view
  const loadMonthEvents = useCallback(async () => {
    if (!householdId) return
    setMonthLoading(true)
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()
    const monthStart = toLocalDateString(new Date(year, month, 1))
    const monthEnd = toLocalDateString(new Date(year, month + 1, 0))
    const { data } = await supabase
      .from('clean_events')
      .select('*, customer:clean_customers(*)')
      .eq('household_id', householdId)
      .gte('scheduled_date', monthStart)
      .lte('scheduled_date', monthEnd)
      .order('scheduled_date')
      .order('scheduled_time', { ascending: true, nullsFirst: true })
    setMonthEvents((data as CleanEvent[]) ?? [])
    setMonthLoading(false)
  }, [householdId, monthDate])

  useEffect(() => {
    if (householdId && viewMode === 'month') loadMonthEvents()
  }, [householdId, viewMode, loadMonthEvents])

  // Optimistic status update (from cards)
  async function handleStatusUpdate(id: string, updates: Partial<CleanEvent>) {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
    await supabase.from('clean_events').update(updates).eq('id', id)
  }

  // Called by CleanEventSheet when it mutates an event
  function handleEventUpdate(updated: CleanEvent) {
    setEvents(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e))
    setSelectedEvent(prev => prev && prev.id === updated.id ? { ...prev, ...updated } : prev)
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const eventsByDay = weekDays.map(day => ({
    day,
    events: events.filter(e => e.scheduled_date === toLocalDateString(day)),
  }))
  const todayIsInWeek = weekDays.some(d => isToday(d))

  // Month view: tap day → switch to week view
  function handleMonthDayTap(day: Date) {
    setWeekStart(getWeekMonday(day))
    setViewMode('week')
  }

  const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <>
      {/* Navigation header — sticky */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        {/* View mode toggle */}
        <div className="flex items-center justify-center gap-1 pt-3 pb-2 px-4">
          <button
            onClick={() => setViewMode('week')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              viewMode === 'week'
                ? 'bg-[#2C5F8A] text-white'
                : 'text-gray-500 active:bg-gray-100'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              viewMode === 'month'
                ? 'bg-[#2C5F8A] text-white'
                : 'text-gray-500 active:bg-gray-100'
            }`}
          >
            Month
          </button>
        </div>

        {/* Period navigation */}
        <div className="flex items-center justify-between px-4 pb-3">
          <button
            onClick={() => {
              if (viewMode === 'week') setWeekStart(w => addDays(w, -7))
              else setMonthDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-500 active:bg-gray-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <h1 className="text-base font-bold text-gray-800">
            {viewMode === 'week' ? `Week of ${formatWeekHeader(weekStart)}` : monthLabel}
          </h1>

          <div className="flex items-center gap-1">
            {viewMode === 'week' && !todayIsInWeek && (
              <button
                onClick={() => setWeekStart(getWeekMonday(new Date()))}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 active:bg-gray-50 mr-1"
              >
                Today
              </button>
            )}
            {viewMode === 'month' && (
              <button
                onClick={() => setMonthDate(new Date())}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 active:bg-gray-50 mr-1"
              >
                Today
              </button>
            )}
            <button
              onClick={() => {
                if (viewMode === 'week') setWeekStart(w => addDays(w, 7))
                else setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
              }}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-500 active:bg-gray-100"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Month view */}
      {viewMode === 'month' && (
        monthLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-[#2C5F8A] rounded-full animate-spin" />
          </div>
        ) : (
          <MonthCalendar
            monthDate={monthDate}
            events={monthEvents}
            onDayTap={handleMonthDayTap}
          />
        )
      )}

      {/* Day sections (week view) */}
      {viewMode === 'week' && <div className="px-4 py-4 space-y-5">
        {eventsByDay.map(({ day, events: dayEvents }) => {
          const today = isToday(day)
          const past = isPast(day)
          const hasEvents = dayEvents.length > 0

          // During load: show skeleton only for today
          if (loading) {
            if (!today) return null
            return (
              <section key={toLocalDateString(day)}>
                <DayHeader day={day} today={today} past={past} />
                <div className="space-y-3 mt-2"><SkeletonCard /></div>
              </section>
            )
          }

          // No events: show today's "empty" state, hide all other days
          if (!hasEvents) {
            if (!today) return null
            return (
              <section key={toLocalDateString(day)}>
                <DayHeader day={day} today={today} past={past} />
                <p className="text-xs text-gray-300 font-medium py-1 pl-1 mt-2">No cleans today</p>
              </section>
            )
          }

          // Has events: show header + cards
          return (
            <section key={toLocalDateString(day)}>
              <DayHeader day={day} today={today} past={past} />
              <div className="space-y-3 mt-2">
                {dayEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onStatusUpdate={handleStatusUpdate}
                    onTap={e => setSelectedEvent(e as FullEvent)}
                    onOpenSheet={e => setSelectedEvent(e as FullEvent)}
                  />
                ))}
              </div>
            </section>
          )
        })}

        <div className="h-4" />
      </div>}

      {/* Floating + button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white z-30 active:scale-95 transition-transform"
        style={{ backgroundColor: '#0E9F8E' }}
        aria-label="Add clean"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-7 h-7">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Add clean sheet */}
      {showAddModal && householdId && (
        <AddCleanSheet
          householdId={householdId}
          customers={customers}
          onClose={() => setShowAddModal(false)}
          onCreated={(scheduledDate, customerName) => {
            setShowAddModal(false)
            const [y, m, d] = scheduledDate.split('-').map(Number)
            setWeekStart(getWeekMonday(new Date(y, m - 1, d)))
            loadEvents()
            const [yr, mo, dy] = scheduledDate.split('-').map(Number)
            const dateLabel = new Date(yr, mo - 1, dy).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            setToast(`Clean added for ${customerName} on ${dateLabel}`)
            setTimeout(() => setToast(null), 3500)
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-xl max-w-xs text-center">
          {toast}
        </div>
      )}

      {/* Event detail sheet */}
      <CleanEventSheet
        event={selectedEvent}
        householdId={householdId}
        onClose={() => setSelectedEvent(null)}
        onUpdate={handleEventUpdate}
      />
    </>
  )
}

// ── Day header sub-component ──────────────────────────────────────────────────

function DayHeader({ day, today, past }: { day: Date; today: boolean; past: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`text-sm font-bold tracking-wide ${
          today
            ? 'text-white rounded-lg px-2 py-0.5'
            : past
            ? 'text-gray-300'
            : 'text-gray-500'
        }`}
        style={today ? { backgroundColor: '#2C5F8A' } : {}}
      >
        {formatDayHeader(day)}
      </span>
      {today && <span className="text-xs font-medium text-blue-400">Today</span>}
    </div>
  )
}

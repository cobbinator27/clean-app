'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { CleanEvent, EventStatus } from '@/types/clean'

// ── Helpers ──────────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday = 0 offset
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatWeekHeader(weekStart: Date): string {
  return weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(time: string | null): string | null {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function isToday(date: Date): boolean {
  const today = new Date()
  return toDateString(date) === toDateString(today)
}

// ── Status config ─────────────────────────────────────────────────────────────

const statusConfig: Record<EventStatus, { label: string; color: string }> = {
  scheduled:       { label: 'Scheduled',    color: 'bg-gray-100 text-gray-600' },
  arrived:         { label: 'Arrived',      color: 'bg-blue-100 text-blue-700' },
  in_progress:     { label: 'In Progress',  color: 'bg-blue-100 text-blue-700' },
  done:            { label: 'Done',         color: 'bg-green-100 text-green-700' },
  payment_pending: { label: 'Payment Due',  color: 'bg-amber-100 text-amber-700' },
  paid:            { label: 'Paid ✓',       color: 'bg-green-100 text-green-700' },
  cancelled:       { label: 'Cancelled',    color: 'bg-red-100 text-red-700' },
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

// ── Add Clean Modal ───────────────────────────────────────────────────────────

function AddCleanModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl w-full max-w-lg p-6 pb-12"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
        <h2 className="text-lg font-bold text-gray-800 mb-1">Add a Clean</h2>
        <p className="text-sm text-gray-400 mb-6">Quick-add a one-off appointment</p>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Customer</label>
            <div className="mt-1 w-full h-11 rounded-xl border border-gray-200 bg-gray-50 flex items-center px-3 text-sm text-gray-400">
              Select customer…
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date</label>
            <input type="date" className="mt-1 w-full h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Expected Amount</label>
            <input type="number" placeholder="$0" className="mt-1 w-full h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</label>
            <textarea className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 resize-none" rows={3} placeholder="Optional notes…" />
          </div>
        </div>
        <button
          className="mt-6 w-full h-12 rounded-xl text-white font-semibold text-sm"
          style={{ backgroundColor: '#2C5F8A' }}
          onClick={onClose}
        >
          Save — coming soon
        </button>
      </div>
    </div>
  )
}

// ── Event Card ────────────────────────────────────────────────────────────────

function EventCard({
  event,
  onStatusUpdate,
  onTap,
}: {
  event: CleanEvent
  onStatusUpdate: (id: string, updates: Partial<CleanEvent>) => void
  onTap: (event: CleanEvent) => void
}) {
  const customer = event.customer
  const status = event.status
  const sc = statusConfig[status]
  const mapsUrl = customer?.address
    ? `maps://?address=${encodeURIComponent(customer.address)}`
    : null

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
    onStatusUpdate(event.id, {
      status: 'done',
      left_at: now.toISOString(),
      hours_logged: hoursLogged,
    })
  }

  return (
    <div
      className="bg-white rounded-2xl shadow-sm p-4 active:scale-[0.99] transition-transform cursor-pointer"
      onClick={() => onTap(event)}
    >
      {/* Top row: name + status */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-bold text-gray-900 leading-snug" style={{ fontSize: 18 }}>
          {customer?.name ?? 'Unknown Customer'}
        </span>
        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${sc.color}`}>
          {sc.label}
        </span>
      </div>

      {/* Address */}
      {customer?.address && (
        <a
          href={mapsUrl ?? '#'}
          onClick={e => e.stopPropagation()}
          className="block text-sm text-blue-500 underline-offset-2 hover:underline mb-2 leading-snug"
        >
          {customer.address}
        </a>
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
      {(status === 'scheduled') && (
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
          onClick={e => e.stopPropagation()}
          className="w-full h-11 rounded-xl font-semibold text-white text-sm transition-opacity active:opacity-80"
          style={{ backgroundColor: '#D97706' }}
        >
          Log Payment
        </button>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const supabase = createClient()
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()))
  const [events, setEvents] = useState<CleanEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CleanEvent | null>(null)

  // Load household_id once
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

  // Load events whenever week or householdId changes
  const loadEvents = useCallback(async () => {
    if (!householdId) return
    setLoading(true)
    const weekEnd = addDays(weekStart, 6)
    const { data } = await supabase
      .from('clean_events')
      .select('*, customer:clean_customers(*)')
      .eq('household_id', householdId)
      .gte('scheduled_date', toDateString(weekStart))
      .lte('scheduled_date', toDateString(weekEnd))
      .order('scheduled_date')
      .order('scheduled_time', { ascending: true, nullsFirst: true })
    setEvents((data as CleanEvent[]) ?? [])
    setLoading(false)
  }, [householdId, weekStart])

  useEffect(() => {
    if (householdId) loadEvents()
    else setLoading(false)
  }, [householdId, loadEvents])

  // Optimistic status update
  async function handleStatusUpdate(id: string, updates: Partial<CleanEvent>) {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
    await supabase.from('clean_events').update(updates).eq('id', id)
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const eventsByDay = weekDays.map(day => ({
    day,
    events: events.filter(e => e.scheduled_date === toDateString(day)),
  }))

  const todayIsInWeek = weekDays.some(d => isToday(d))

  return (
    <>
      {/* Week navigation — sticky */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setWeekStart(w => addDays(w, -7))}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-500 active:bg-gray-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div className="text-center">
            <h1 className="text-base font-bold text-gray-800">
              Week of {formatWeekHeader(weekStart)}
            </h1>
          </div>

          <div className="flex items-center gap-1">
            {!todayIsInWeek && (
              <button
                onClick={() => setWeekStart(getWeekStart(new Date()))}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 active:bg-gray-50 mr-1"
              >
                Today
              </button>
            )}
            <button
              onClick={() => setWeekStart(w => addDays(w, 7))}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-500 active:bg-gray-100"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Day sections */}
      <div className="px-4 py-4 space-y-5">
        {eventsByDay.map(({ day, events: dayEvents }) => {
          const today = isToday(day)
          return (
            <section key={toDateString(day)}>
              {/* Day header */}
              <div className={`flex items-center gap-2 mb-2 ${today ? '' : ''}`}>
                <span
                  className={`text-sm font-bold tracking-wide ${today ? 'text-white rounded-lg px-2 py-0.5' : 'text-gray-400'}`}
                  style={today ? { backgroundColor: '#2C5F8A' } : {}}
                >
                  {formatDayHeader(day)}
                </span>
                {today && <span className="text-xs font-medium text-blue-500">Today</span>}
              </div>

              {/* Events or empty */}
              {loading ? (
                today || dayEvents.length > 0 ? (
                  <div className="space-y-3">
                    <SkeletonCard />
                  </div>
                ) : null
              ) : dayEvents.length === 0 ? (
                <div className="text-xs text-gray-300 font-medium py-1 pl-1">No cleans</div>
              ) : (
                <div className="space-y-3">
                  {dayEvents.map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onStatusUpdate={handleStatusUpdate}
                      onTap={setSelectedEvent}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })}

        {/* Bottom spacer so content isn't hidden behind nav */}
        <div className="h-4" />
      </div>

      {/* Floating + button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white text-2xl font-light z-30 active:scale-95 transition-transform"
        style={{ backgroundColor: '#0E9F8E' }}
        aria-label="Add clean"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-7 h-7">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Add modal */}
      {showAddModal && <AddCleanModal onClose={() => setShowAddModal(false)} />}

      {/* Event detail sheet (stub) */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-white rounded-t-3xl w-full max-w-lg p-6 pb-12"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
            <h2 className="text-lg font-bold text-gray-800 mb-1">
              {selectedEvent.customer?.name ?? 'Clean'}
            </h2>
            <p className="text-sm text-gray-400 mb-4">{selectedEvent.customer?.address}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-0.5">Date</p>
                <p className="font-medium text-gray-700">{selectedEvent.scheduled_date}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-0.5">Status</p>
                <p className="font-medium text-gray-700">{statusConfig[selectedEvent.status].label}</p>
              </div>
              {selectedEvent.expected_amount != null && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Expected</p>
                  <p className="font-medium text-gray-700">${selectedEvent.expected_amount}</p>
                </div>
              )}
              {selectedEvent.hours_logged != null && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Hours</p>
                  <p className="font-medium text-gray-700">{selectedEvent.hours_logged}h</p>
                </div>
              )}
            </div>
            {selectedEvent.notes && (
              <div className="mt-3 bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-0.5">Notes</p>
                <p className="text-sm text-gray-700">{selectedEvent.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

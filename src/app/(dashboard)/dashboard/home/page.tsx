'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { CleanEvent, CleanCustomer, EventStatus } from '@/types/clean'
import CleanEventSheet from '@/components/CleanEventSheet'
import { toLocalDateString, formatTime, formatDateShort } from '@/lib/date-utils'

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

function fmtMoney(n: number | null | undefined): string {
  if (!n) return '$0'
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const supabase = createClient()
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [todayEvents, setTodayEvents] = useState<FullEvent[]>([])
  const [missedEvents, setMissedEvents] = useState<FullEvent[]>([])
  const [unpaidEvents, setUnpaidEvents] = useState<FullEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<FullEvent | null>(null)

  // Load household once
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single()
      if (data?.household_id) setHouseholdId(data.household_id)
      else setLoading(false)
    }
    init()
  }, [])

  const loadData = useCallback(async () => {
    if (!householdId) return
    const today = toLocalDateString(new Date())

    const [{ data: todayRows }, { data: missedRows }, { data: unpaidRows }] = await Promise.all([
      // Today's cleans (anything but cancelled)
      supabase
        .from('clean_events')
        .select('*, customer:clean_customers(*)')
        .eq('household_id', householdId)
        .eq('scheduled_date', today)
        .neq('status', 'cancelled')
        .order('scheduled_time', { ascending: true, nullsFirst: true }),
      // Missed: still scheduled, date already past
      supabase
        .from('clean_events')
        .select('*, customer:clean_customers(*)')
        .eq('household_id', householdId)
        .eq('status', 'scheduled')
        .lt('scheduled_date', today)
        .order('scheduled_date', { ascending: true }),
      // Payments due: completed work not yet paid
      supabase
        .from('clean_events')
        .select('*, customer:clean_customers(*)')
        .eq('household_id', householdId)
        .in('status', ['done', 'payment_pending'])
        .order('scheduled_date', { ascending: true }),
    ])

    setTodayEvents((todayRows ?? []) as FullEvent[])
    setMissedEvents((missedRows ?? []) as FullEvent[])
    setUnpaidEvents((unpaidRows ?? []) as FullEvent[])
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    if (householdId) loadData()
  }, [householdId, loadData])

  // Optimistic quick-action update (today's rows)
  async function handleStatusUpdate(id: string, updates: Partial<CleanEvent>) {
    setTodayEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
    await supabase.from('clean_events').update(updates).eq('id', id)
    // A status change can move an event between sections — refetch to resync.
    loadData()
  }

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  const unpaidTotal = unpaidEvents.reduce((s, e) => s + (e.expected_amount ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm px-5 py-4">
        <p className="text-sm font-medium text-gray-400">{greeting()}</p>
        <h1 className="text-xl font-bold text-gray-900">{todayStr}</h1>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-[#2C5F8A] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 py-5 space-y-6">

          {/* ── Missed cleans alert ── */}
          {missedEvents.length > 0 && (
            <section>
              <div className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-red-100">
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-red-700">
                      {missedEvents.length} clean{missedEvents.length === 1 ? '' : 's'} missed
                    </p>
                    <p className="text-xs text-red-500">Scheduled but never closed out — reschedule or cancel each</p>
                  </div>
                </div>
                <div className="divide-y divide-red-100">
                  {missedEvents.map(e => (
                    <button
                      key={e.id}
                      onClick={() => setSelectedEvent(e)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-red-100/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{e.customer?.name ?? 'Unknown'}</p>
                        <p className="text-xs text-red-500">{formatDateShort(e.scheduled_date)}</p>
                      </div>
                      {e.expected_amount != null && (
                        <span className="text-sm font-semibold text-gray-500 shrink-0">{fmtMoney(e.expected_amount)}</span>
                      )}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-red-300 shrink-0">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── Today ── */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                Today · {todayEvents.length} clean{todayEvents.length === 1 ? '' : 's'}
              </h2>
              <Link href="/dashboard/schedule" className="text-xs font-semibold text-[#2C5F8A]">
                Full schedule →
              </Link>
            </div>

            {todayEvents.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                <p className="text-sm text-gray-400">No cleans scheduled today</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayEvents.map(e => (
                  <TodayCard
                    key={e.id}
                    event={e}
                    onStatusUpdate={handleStatusUpdate}
                    onOpenSheet={() => setSelectedEvent(e)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── Payments due ── */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                Payments Due
              </h2>
              {unpaidEvents.length > 0 && (
                <Link href="/dashboard/payments" className="text-xs font-semibold text-[#2C5F8A]">
                  All payments →
                </Link>
              )}
            </div>

            {unpaidEvents.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                <p className="text-sm text-gray-400">All caught up — nothing awaiting payment</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-100">
                  <span className="text-sm font-semibold text-amber-700">
                    {unpaidEvents.length} awaiting payment
                  </span>
                  <span className="text-lg font-bold text-amber-700">{fmtMoney(unpaidTotal)}</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {unpaidEvents.map(e => (
                    <button
                      key={e.id}
                      onClick={() => setSelectedEvent(e)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{e.customer?.name ?? 'Unknown'}</p>
                        <p className="text-xs text-gray-400">{formatDateShort(e.scheduled_date)}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusConfig[e.status].color}`}>
                        {statusConfig[e.status].label}
                      </span>
                      <span className="text-sm font-semibold text-gray-700 shrink-0">{fmtMoney(e.expected_amount)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <div className="h-4" />
        </div>
      )}

      {/* Event detail sheet — handles arrive/done/reschedule/cancel/payment */}
      <CleanEventSheet
        event={selectedEvent}
        householdId={householdId}
        onClose={() => setSelectedEvent(null)}
        onUpdate={() => loadData()}
      />
    </div>
  )
}

// ── Today card ────────────────────────────────────────────────────────────────

function TodayCard({
  event,
  onStatusUpdate,
  onOpenSheet,
}: {
  event: FullEvent
  onStatusUpdate: (id: string, updates: Partial<CleanEvent>) => void
  onOpenSheet: () => void
}) {
  const { status } = event
  const sc = statusConfig[status]

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

  return (
    <div
      className="bg-white rounded-2xl shadow-sm p-4 active:scale-[0.99] transition-transform cursor-pointer"
      onClick={onOpenSheet}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-bold text-gray-900 leading-snug" style={{ fontSize: 17 }}>
          {event.customer?.name ?? 'Unknown Customer'}
        </span>
        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${sc.color}`}>
          {sc.label}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {event.scheduled_time && (
          <span className="text-sm text-gray-500">{formatTime(event.scheduled_time)}</span>
        )}
        {event.expected_amount != null && (
          <span className="text-base font-semibold text-gray-800">{fmtMoney(event.expected_amount)}</span>
        )}
      </div>

      {status === 'scheduled' && (
        <button
          onClick={handleArrive}
          className="w-full h-11 rounded-xl font-semibold text-white text-sm active:opacity-80"
          style={{ backgroundColor: '#0E9F8E' }}
        >
          Arrive
        </button>
      )}
      {(status === 'arrived' || status === 'in_progress') && (
        <button
          onClick={handleDone}
          className="w-full h-11 rounded-xl font-semibold text-white text-sm active:opacity-80"
          style={{ backgroundColor: '#0E9F8E' }}
        >
          Mark Done
        </button>
      )}
      {(status === 'done' || status === 'payment_pending') && (
        <button
          onClick={e => { e.stopPropagation(); onOpenSheet() }}
          className="w-full h-11 rounded-xl font-semibold text-white text-sm active:opacity-80"
          style={{ backgroundColor: '#D97706' }}
        >
          Log Payment
        </button>
      )}
    </div>
  )
}

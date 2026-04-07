'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { CleanCustomer, CleanEvent, EventStatus, Recurrence } from '@/types/clean'
import CleanEventSheet from '@/components/CleanEventSheet'
import { toLocalDateString, formatDateShort } from '@/lib/date-utils'

type FullEvent = CleanEvent & { customer: CleanCustomer }

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

const RECURRENCE_OPTIONS: { value: NonNullable<Recurrence>; label: string }[] = [
  { value: 'weekly',    label: 'Weekly' },
  { value: 'bi_weekly', label: 'Bi-Weekly' },
  { value: 'monthly',   label: 'Monthly' },
]

const DAY_OPTIONS = [
  { value: 'monday',    label: 'Mon' },
  { value: 'tuesday',   label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday',  label: 'Thu' },
  { value: 'friday',    label: 'Fri' },
  { value: 'saturday',  label: 'Sat' },
]

const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

function describeSchedule(customer: CleanCustomer): string {
  if (!customer.recurrence) return 'No recurring schedule'
  const day = customer.recurrence_day ? DAY_LABELS[customer.recurrence_day] ?? customer.recurrence_day : null
  if (customer.recurrence === 'weekly') return day ? `Weekly on ${day}` : 'Weekly'
  if (customer.recurrence === 'bi_weekly') return day ? `Every other ${day}` : 'Bi-Weekly'
  if (customer.recurrence === 'monthly') {
    if (customer.recurrence_start) {
      const [, , d] = customer.recurrence_start.split('-').map(Number)
      const suffix = d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'
      return `Monthly on the ${d}${suffix}`
    }
    return 'Monthly'
  }
  return 'No recurring schedule'
}

function formatDateFull(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

const inputCls = 'w-full h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 mt-6">
      {children}
    </p>
  )
}

// ── Event row ─────────────────────────────────────────────────────────────────

function EventRow({ event, onTap }: { event: CleanEvent; onTap: () => void }) {
  const sc = statusConfig[event.status]
  return (
    <button
      onClick={onTap}
      className="w-full bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between text-left active:scale-[0.99] transition-transform"
    >
      <div>
        <p className="text-sm font-semibold text-gray-800">{formatDateFull(event.scheduled_date)}</p>
        {event.hours_logged != null && (
          <p className="text-xs text-gray-400 mt-0.5">{event.hours_logged}h</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {event.actual_amount != null && (
          <span className="text-sm font-bold text-gray-700">${event.actual_amount.toFixed(0)}</span>
        )}
        {event.expected_amount != null && event.actual_amount == null && (
          <span className="text-sm text-gray-400">${event.expected_amount.toFixed(0)}</span>
        )}
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${sc.color}`}>
          {sc.label}
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-gray-300 shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </button>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [customer, setCustomer] = useState<CleanCustomer | null>(null)
  const [upcoming, setUpcoming] = useState<CleanEvent[]>([])
  const [history, setHistory] = useState<CleanEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<FullEvent | null>(null)

  // Editable fields
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [area, setArea] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [primaryRate, setPrimaryRate] = useState('')
  const [secondaryRate, setSecondaryRate] = useState('')
  const [miles, setMiles] = useState('')
  const [recurrence, setRecurrence] = useState<Recurrence>(null)
  const [recurrenceDay, setRecurrenceDay] = useState<string | null>(null)
  const [recurrenceStart, setRecurrenceStart] = useState('')
  const [notes, setNotes] = useState('')
  const [customerStatus, setCustomerStatus] = useState<'active' | 'inactive'>('active')

  const todayStr = toLocalDateString(new Date())

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: cx }, { data: ev }] = await Promise.all([
        supabase.from('clean_customers').select('*').eq('id', id).single(),
        supabase
          .from('clean_events')
          .select('*')
          .eq('customer_id', id)
          .order('scheduled_date', { ascending: false })
          .limit(100),
      ])
      if (cx) {
        const c = cx as CleanCustomer
        setCustomer(c)
        populateForm(c)
      }
      const all = (ev ?? []) as CleanEvent[]
      splitEvents(all)
      setLoading(false)
    }
    load()
  }, [id])

  function splitEvents(all: CleanEvent[]) {
    const up = all
      .filter(e => e.scheduled_date >= todayStr && ['scheduled', 'arrived', 'in_progress'].includes(e.status))
      .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    const hist = all
      .filter(e => !up.includes(e))
      .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))
      .slice(0, 20)
    setUpcoming(up)
    setHistory(hist)
  }

  function populateForm(c: CleanCustomer) {
    setName(c.name)
    setAddress(c.address ?? '')
    setArea(c.area ?? '')
    setPhone(c.phone ?? '')
    setEmail(c.email ?? '')
    setPrimaryRate(c.primary_rate != null ? String(c.primary_rate) : '')
    setSecondaryRate(c.secondary_rate != null ? String(c.secondary_rate) : '')
    setMiles(c.one_way_miles != null ? String(c.one_way_miles) : '')
    setRecurrence(c.recurrence ?? null)
    setRecurrenceDay(c.recurrence_day ?? null)
    setRecurrenceStart(c.recurrence_start ?? '')
    setNotes(c.notes ?? '')
    setCustomerStatus(c.status)
  }

  function handleCancelEdit() {
    if (customer) populateForm(customer)
    setEditing(false)
    setSaveError(null)
  }

  async function handleSave() {
    if (!name.trim()) { setSaveError('Name is required'); return }
    setSaving(true)
    setSaveError(null)
    const updates = {
      name: name.trim(),
      address: address.trim() || null,
      area: area.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      primary_rate: primaryRate ? parseFloat(primaryRate) : null,
      secondary_rate: secondaryRate ? parseFloat(secondaryRate) : null,
      one_way_miles: miles ? parseFloat(miles) : null,
      recurrence: recurrence ?? null,
      recurrence_day: (recurrence === 'weekly' || recurrence === 'bi_weekly') ? (recurrenceDay ?? null) : null,
      recurrence_start: (recurrence === 'weekly' || recurrence === 'bi_weekly' || recurrence === 'monthly') ? (recurrenceStart || null) : null,
      notes: notes.trim() || null,
      status: customerStatus,
    }
    console.log('[client-detail] saving updates:', updates)
    const { error } = await supabase.from('clean_customers').update(updates).eq('id', id)
    if (error) { setSaving(false); setSaveError(error.message); return }

    // Reload from Supabase so view mode reflects persisted values
    const { data: fresh } = await supabase.from('clean_customers').select('*').eq('id', id).single()
    setSaving(false)
    if (fresh) {
      const c = fresh as CleanCustomer
      setCustomer(c)
      populateForm(c)
    }
    setEditing(false)
  }

  function openEvent(ev: CleanEvent) {
    if (!customer) return
    setSelectedEvent({ ...ev, customer })
  }

  function handleEventUpdate(updated: CleanEvent) {
    // Re-split with updated event merged in
    const allUpdated = [...upcoming, ...history].map(e => e.id === updated.id ? updated : e)
    splitEvents(allUpdated)
    // Keep sheet in sync
    setSelectedEvent(prev => prev && prev.id === updated.id ? { ...prev, ...updated } : prev)
  }

  // Stats (from all events combined)
  const allEvents = [...upcoming, ...history]
  const paidEvents = allEvents.filter(e => e.status === 'paid')
  const totalEarned = paidEvents.reduce((sum, e) => sum + (e.actual_amount ?? 0), 0)
  const totalHours = allEvents.reduce((sum, e) => sum + (e.hours_logged ?? 0), 0)
  const nextEvent = upcoming[0] ?? null
  const lastPaid = history.find(e => e.status === 'paid') ?? null

  if (loading) {
    return (
      <div className="px-4 py-8 space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-4 bg-gray-100 rounded w-32" />
        <div className="h-32 bg-gray-100 rounded-2xl" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400">
        <p className="text-sm">Client not found.</p>
        <button onClick={() => router.back()} className="mt-4 text-sm font-medium text-blue-500">Go back</button>
      </div>
    )
  }

  return (
    <div className="pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 active:bg-gray-200 shrink-0"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{customer.name}</h1>
          {customer.area && <p className="text-xs text-gray-400">{customer.area}</p>}
        </div>
        {editing ? (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleCancelEdit} className="h-9 px-3 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-4 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: '#2C5F8A' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 active:bg-gray-200 shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
      </header>

      <div className="px-4">
        {saveError && <p className="mt-3 text-xs text-red-500 text-center">{saveError}</p>}

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
            <p className="text-lg font-bold text-gray-900">{paidEvents.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Cleans</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
            <p className="text-lg font-bold text-gray-900">${totalEarned.toFixed(0)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Earned</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
            <p className="text-lg font-bold text-gray-900">{totalHours > 0 ? `${totalHours.toFixed(1)}h` : '—'}</p>
            <p className="text-xs text-gray-400 mt-0.5">Hours</p>
          </div>
        </div>

        {/* Next / Last tiles */}
        {(nextEvent || lastPaid) && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            {nextEvent && (
              <div className="bg-blue-50 rounded-2xl p-3">
                <p className="text-xs text-blue-500 font-medium mb-0.5">Next Clean</p>
                <p className="text-sm font-bold text-blue-700">{formatDateShort(nextEvent.scheduled_date)}</p>
              </div>
            )}
            {lastPaid && (
              <div className="bg-green-50 rounded-2xl p-3">
                <p className="text-xs text-green-500 font-medium mb-0.5">Last Paid</p>
                <p className="text-sm font-bold text-green-700">{formatDateShort(lastPaid.scheduled_date)}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Info / Edit ── */}
        <SectionLabel>Info</SectionLabel>
        <div className={`space-y-4 ${editing ? '' : 'bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden'}`}>
          {editing ? (
            <>
              <Field label="Name *">
                <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Phone">
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(509) 555-0100" className={inputCls} />
              </Field>
              <Field label="Email">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" className={inputCls} />
              </Field>
              <Field label="Address">
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St" className={inputCls} />
              </Field>
              <Field label="Area / Neighborhood">
                <input value={area} onChange={e => setArea(e.target.value)} placeholder="Deer Park" className={inputCls} />
              </Field>
              <Field label="Primary Rate">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input type="number" min="0" step="5" value={primaryRate} onChange={e => setPrimaryRate(e.target.value)} className={`${inputCls} pl-7`} />
                </div>
              </Field>
              <Field label="Secondary Rate">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input type="number" min="0" step="5" value={secondaryRate} onChange={e => setSecondaryRate(e.target.value)} className={`${inputCls} pl-7`} />
                </div>
              </Field>
              <Field label="One-Way Miles">
                <input type="number" min="0" step="0.1" value={miles} onChange={e => setMiles(e.target.value)} className={inputCls} />
              </Field>
              {/* Schedule section */}
              <div className="pt-2 pb-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Recurring Schedule</p>
              </div>

              <Field label="Frequency">
                <div className="flex gap-2 flex-wrap">
                  {/* None pill */}
                  <button type="button"
                    onClick={() => { setRecurrence(null); setRecurrenceDay(null); setRecurrenceStart('') }}
                    className={`h-10 px-4 rounded-full text-sm font-medium border transition-colors ${recurrence === null ? 'bg-[#2C5F8A] border-[#2C5F8A] text-white' : 'border-gray-200 bg-white text-gray-600'}`}
                  >None</button>
                  {RECURRENCE_OPTIONS.map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setRecurrence(opt.value)}
                      className={`h-10 px-4 rounded-full text-sm font-medium border transition-colors ${recurrence === opt.value ? 'bg-[#2C5F8A] border-[#2C5F8A] text-white' : 'border-gray-200 bg-white text-gray-600'}`}
                    >{opt.label}</button>
                  ))}
                </div>
              </Field>

              {(recurrence === 'weekly' || recurrence === 'bi_weekly') && (
                <Field label="Day of Week">
                  <div className="flex gap-2 flex-wrap">
                    {DAY_OPTIONS.map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => setRecurrenceDay(d => d === opt.value ? null : opt.value)}
                        className={`h-10 px-3 rounded-full text-sm font-medium border transition-colors ${recurrenceDay === opt.value ? 'bg-[#2C5F8A] border-[#2C5F8A] text-white' : 'border-gray-200 bg-white text-gray-600'}`}
                      >{opt.label}</button>
                    ))}
                  </div>
                </Field>
              )}

              {(recurrence === 'weekly' || recurrence === 'bi_weekly') && (
                <Field label="Schedule anchor date">
                  <input
                    type="date"
                    value={recurrenceStart}
                    onChange={e => setRecurrenceStart(e.target.value)}
                    className={inputCls}
                  />
                  <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                    {recurrence === 'bi_weekly'
                      ? "For bi-weekly clients, this determines which weeks are 'on'. Set it to any past date when they were cleaned."
                      : "Start date for this client's weekly schedule."}
                  </p>
                </Field>
              )}

              {recurrence === 'monthly' && (
                <Field label="Monthly clean date">
                  <input
                    type="date"
                    value={recurrenceStart}
                    onChange={e => setRecurrenceStart(e.target.value)}
                    className={inputCls}
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    Day of month (e.g. set to April 15 for the 15th of each month)
                  </p>
                </Field>
              )}
              <Field label="Notes">
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </Field>
              <Field label="Status">
                <div className="flex gap-2">
                  {(['active', 'inactive'] as const).map(s => (
                    <button key={s} type="button" onClick={() => setCustomerStatus(s)}
                      className={`h-10 px-4 rounded-full text-sm font-medium border capitalize transition-colors ${s === customerStatus ? 'bg-[#2C5F8A] border-[#2C5F8A] text-white' : 'border-gray-200 bg-white text-gray-600'}`}
                    >{s}</button>
                  ))}
                </div>
              </Field>
            </>
          ) : (
            <>
              {[
                { label: 'Phone',          value: customer.phone,      href: customer.phone ? `tel:${customer.phone}` : null },
                { label: 'Email',          value: customer.email,      href: customer.email ? `mailto:${customer.email}` : null },
                { label: 'Address',        value: customer.address,    href: customer.address ? `maps://?address=${encodeURIComponent(customer.address)}` : null },
                { label: 'Area',           value: customer.area,       href: null },
                { label: 'Primary Rate',   value: customer.primary_rate   != null ? `$${customer.primary_rate}/clean`   : null, href: null },
                { label: 'Secondary Rate', value: customer.secondary_rate != null ? `$${customer.secondary_rate}/clean` : null, href: null },
                { label: 'One-Way Miles',  value: customer.one_way_miles  != null ? `${customer.one_way_miles} mi`      : null, href: null },
                { label: 'Schedule',       value: describeSchedule(customer), href: null },
              ]
                .filter(row => row.value)
                .map(row => (
                  <div key={row.label} className="flex justify-between items-center px-4 py-3">
                    <span className="text-sm text-gray-400">{row.label}</span>
                    {row.href
                      ? <a href={row.href} className="text-sm font-medium text-blue-500 text-right max-w-[60%]">{row.value}</a>
                      : <span className="text-sm font-medium text-gray-800 text-right max-w-[60%]">{row.value}</span>
                    }
                  </div>
                ))
              }
              {customer.notes && (
                <div className="px-4 py-3">
                  <span className="text-xs text-gray-400 block mb-1">Notes</span>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{customer.notes}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Upcoming / History ── */}
        {!editing && (
          <>
            <SectionLabel>Upcoming</SectionLabel>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 pl-1">No upcoming cleans scheduled</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map(ev => (
                  <EventRow key={ev.id} event={ev} onTap={() => openEvent(ev)} />
                ))}
              </div>
            )}

            <SectionLabel>History</SectionLabel>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 pl-1">No past cleans yet</p>
            ) : (
              <div className="space-y-2">
                {history.map(ev => (
                  <EventRow key={ev.id} event={ev} onTap={() => openEvent(ev)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Event sheet */}
      <CleanEventSheet
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onUpdate={handleEventUpdate}
      />
    </div>
  )
}

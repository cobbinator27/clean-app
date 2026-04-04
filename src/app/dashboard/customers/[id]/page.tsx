'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { CleanCustomer, CleanEvent, EventStatus, Recurrence } from '@/types/clean'

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

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const inputCls = 'w-full h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-white disabled:border-transparent disabled:px-0 disabled:text-gray-800'

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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [customer, setCustomer] = useState<CleanCustomer | null>(null)
  const [events, setEvents] = useState<CleanEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Editable fields mirror
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [area, setArea] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [primaryRate, setPrimaryRate] = useState('')
  const [secondaryRate, setSecondaryRate] = useState('')
  const [miles, setMiles] = useState('')
  const [recurrence, setRecurrence] = useState<Recurrence>(null)
  const [notes, setNotes] = useState('')
  const [customerStatus, setCustomerStatus] = useState<'active' | 'inactive'>('active')

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
          .limit(20),
      ])
      if (cx) {
        const c = cx as CleanCustomer
        setCustomer(c)
        populateForm(c)
      }
      setEvents((ev ?? []) as CleanEvent[])
      setLoading(false)
    }
    load()
  }, [id])

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
      notes: notes.trim() || null,
      status: customerStatus,
    }

    const { error } = await supabase.from('clean_customers').update(updates).eq('id', id)
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    setCustomer(prev => prev ? { ...prev, ...updates } : prev)
    setEditing(false)
  }

  // Stats
  const paidEvents = events.filter(e => e.status === 'paid')
  const totalEarned = paidEvents.reduce((sum, e) => sum + (e.actual_amount ?? 0), 0)
  const totalHours = events.reduce((sum, e) => sum + (e.hours_logged ?? 0), 0)
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const nextEvent = events.find(e => e.scheduled_date >= todayStr && ['scheduled', 'arrived'].includes(e.status))
  const lastEvent = events.find(e => e.scheduled_date < todayStr && e.status === 'paid')

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
        <p className="text-sm">Customer not found.</p>
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
            <button
              onClick={handleCancelEdit}
              className="h-9 px-3 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium"
            >
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
        {saveError && (
          <p className="mt-3 text-xs text-red-500 text-center">{saveError}</p>
        )}

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

        {/* Upcoming / Last */}
        {(nextEvent || lastEvent) && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            {nextEvent && (
              <div className="bg-blue-50 rounded-2xl p-3">
                <p className="text-xs text-blue-500 font-medium mb-0.5">Next Clean</p>
                <p className="text-sm font-bold text-blue-700">{formatDateShort(nextEvent.scheduled_date)}</p>
              </div>
            )}
            {lastEvent && (
              <div className="bg-green-50 rounded-2xl p-3">
                <p className="text-xs text-green-500 font-medium mb-0.5">Last Paid</p>
                <p className="text-sm font-bold text-green-700">{formatDateShort(lastEvent.scheduled_date)}</p>
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
              <Field label="Recurrence">
                <div className="flex gap-2 flex-wrap">
                  {RECURRENCE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRecurrence(r => r === opt.value ? null : opt.value)}
                      className={`h-10 px-4 rounded-full text-sm font-medium border transition-colors ${
                        recurrence === opt.value
                          ? 'bg-[#2C5F8A] border-[#2C5F8A] text-white'
                          : 'border-gray-200 bg-white text-gray-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Notes">
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </Field>
              <Field label="Status">
                <div className="flex gap-2">
                  {(['active', 'inactive'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCustomerStatus(s)}
                      className={`h-10 px-4 rounded-full text-sm font-medium border capitalize transition-colors ${
                        s === customerStatus
                          ? 'bg-[#2C5F8A] border-[#2C5F8A] text-white'
                          : 'border-gray-200 bg-white text-gray-600'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          ) : (
            <>
              {[
                { label: 'Phone', value: customer.phone, href: customer.phone ? `tel:${customer.phone}` : null },
                { label: 'Email', value: customer.email, href: customer.email ? `mailto:${customer.email}` : null },
                { label: 'Address', value: customer.address, href: customer.address ? `maps://?address=${encodeURIComponent(customer.address)}` : null },
                { label: 'Area', value: customer.area, href: null },
                { label: 'Primary Rate', value: customer.primary_rate != null ? `$${customer.primary_rate}/clean` : null, href: null },
                { label: 'Secondary Rate', value: customer.secondary_rate != null ? `$${customer.secondary_rate}/clean` : null, href: null },
                { label: 'One-Way Miles', value: customer.one_way_miles != null ? `${customer.one_way_miles} mi` : null, href: null },
                { label: 'Recurrence', value: customer.recurrence ? RECURRENCE_OPTIONS.find(o => o.value === customer.recurrence)?.label : null, href: null },
              ]
                .filter(row => row.value)
                .map(row => (
                  <div key={row.label} className="flex justify-between items-center px-4 py-3">
                    <span className="text-sm text-gray-400">{row.label}</span>
                    {row.href ? (
                      <a href={row.href} className="text-sm font-medium text-blue-500 text-right max-w-[60%]">{row.value}</a>
                    ) : (
                      <span className="text-sm font-medium text-gray-800 text-right max-w-[60%]">{row.value}</span>
                    )}
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

        {/* ── Clean History ── */}
        {!editing && (
          <>
            <SectionLabel>Clean History</SectionLabel>
            {events.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No cleans yet</p>
            ) : (
              <div className="space-y-2">
                {events.map(ev => {
                  const sc = statusConfig[ev.status]
                  return (
                    <div key={ev.id} className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{formatDate(ev.scheduled_date)}</p>
                        {ev.hours_logged != null && (
                          <p className="text-xs text-gray-400 mt-0.5">{ev.hours_logged}h</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {ev.actual_amount != null && (
                          <span className="text-sm font-bold text-gray-700">${ev.actual_amount.toFixed(0)}</span>
                        )}
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${sc.color}`}>
                          {sc.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

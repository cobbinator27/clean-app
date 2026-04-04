'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { CleanCustomer, EventType } from '@/types/clean'

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'regular',    label: 'Regular' },
  { value: 'one_off',    label: 'One-Off' },
  { value: 'move_out',   label: 'Move-Out' },
  { value: 'deep_clean', label: 'Deep Clean' },
]

function todayDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateNice(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

interface Props {
  householdId: string
  customers: CleanCustomer[]
  onClose: () => void
  onCreated: (scheduledDate: string, customerName: string) => void
}

export default function AddCleanSheet({ householdId, customers, onClose, onCreated }: Props) {
  const supabase = createClient()
  const [visible, setVisible] = useState(false)

  // Form state
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<CleanCustomer | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [date, setDate] = useState(todayDateString())
  const [time, setTime] = useState('')
  const [eventType, setEventType] = useState<EventType>('regular')
  const [amount, setAmount] = useState('')
  const [useSecondaryRate, setUseSecondaryRate] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  // Pre-fill amount when customer selected
  useEffect(() => {
    if (!selectedCustomer) { setAmount(''); return }
    const rate = useSecondaryRate
      ? (selectedCustomer.secondary_rate ?? selectedCustomer.primary_rate)
      : selectedCustomer.primary_rate
    setAmount(rate != null ? String(rate) : '')
  }, [selectedCustomer, useSecondaryRate])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  function selectCustomer(cx: CleanCustomer) {
    setSelectedCustomer(cx)
    setSearch(cx.name)
    setShowDropdown(false)
  }

  function clearCustomer() {
    setSelectedCustomer(null)
    setSearch('')
    setShowDropdown(false)
  }

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleSave() {
    if (!selectedCustomer) { setError('Select a customer'); return }
    if (!date) { setError('Date is required'); return }
    setSaving(true)
    setError(null)

    const { error: err } = await supabase.from('clean_events').insert({
      household_id: householdId,
      customer_id: selectedCustomer.id,
      scheduled_date: date,
      scheduled_time: time || null,
      status: 'scheduled',
      event_type: eventType,
      expected_amount: amount ? parseFloat(amount) : null,
      notes: notes.trim() || null,
      is_recurring_instance: false,
    })

    setSaving(false)
    if (err) { setError(err.message); return }

    onCreated(date, selectedCustomer.name)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col max-w-lg mx-auto transition-transform duration-300"
        style={{ maxHeight: '92vh', transform: visible ? 'translateY(0)' : 'translateY(100%)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 pb-4">
          <div className="flex items-center justify-between mt-2 mb-5">
            <h2 className="text-lg font-bold text-gray-900">Add a Clean</h2>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-4 h-4">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="space-y-5">
            {/* Customer selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Customer *
              </label>
              <div className="relative">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2">
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      value={search}
                      onChange={e => {
                        setSearch(e.target.value)
                        setShowDropdown(true)
                        if (selectedCustomer && e.target.value !== selectedCustomer.name) {
                          setSelectedCustomer(null)
                        }
                      }}
                      onFocus={() => setShowDropdown(true)}
                      placeholder="Search customers…"
                      className="w-full h-11 pl-9 pr-4 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  {selectedCustomer && (
                    <button onClick={clearCustomer} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-4 h-4">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Selected badge */}
                {selectedCustomer && (
                  <div className="mt-2 flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: '#2C5F8A' }}>
                      {selectedCustomer.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{selectedCustomer.name}</p>
                      {selectedCustomer.area && <p className="text-xs text-gray-400">{selectedCustomer.area}</p>}
                    </div>
                  </div>
                )}

                {/* Dropdown */}
                {showDropdown && !selectedCustomer && filteredCustomers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filteredCustomers.map(cx => (
                      <button
                        key={cx.id}
                        onClick={() => selectCustomer(cx)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 active:bg-gray-100 first:rounded-t-xl last:rounded-b-xl"
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: '#2C5F8A' }}>
                          {cx.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{cx.name}</p>
                          {cx.area && <p className="text-xs text-gray-400">{cx.area}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Secondary rate toggle */}
            {selectedCustomer?.secondary_rate != null && (
              <button
                onClick={() => setUseSecondaryRate(r => !r)}
                className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl border transition-colors ${
                  useSecondaryRate
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'border-gray-200 text-gray-500'
                }`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${useSecondaryRate ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                  {useSecondaryRate && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" className="w-3 h-3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                Use alternate rate (${selectedCustomer.secondary_rate})
              </button>
            )}

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Date *</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {date && <p className="text-xs text-gray-400 mt-1 pl-1">{formatDateNice(date)}</p>}
            </div>

            {/* Time */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Time <span className="normal-case font-normal">(optional)</span>
              </label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {/* Event type */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Type</label>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setEventType(t.value)}
                    className={`h-10 px-4 rounded-full text-sm font-medium border transition-colors ${
                      eventType === t.value
                        ? 'bg-[#2C5F8A] border-[#2C5F8A] text-white'
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Expected amount */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Expected Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full h-11 rounded-xl border border-gray-200 bg-gray-50 pl-7 pr-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Notes <span className="normal-case font-normal">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any special instructions…"
                rows={3}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 pt-3 pb-8 border-t border-gray-100 bg-white space-y-2">
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving || !selectedCustomer || !date}
            className="w-full h-12 rounded-xl font-semibold text-white text-sm disabled:opacity-40"
            style={{ backgroundColor: '#2C5F8A' }}
          >
            {saving ? 'Adding…' : 'Add Clean'}
          </button>
        </div>
      </div>
    </>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { CleanCustomer, Recurrence } from '@/types/clean'

const RECURRENCE_OPTIONS: { value: NonNullable<Recurrence>; label: string }[] = [
  { value: 'weekly',    label: 'Weekly' },
  { value: 'bi_weekly', label: 'Bi-Weekly' },
  { value: 'monthly',   label: 'Monthly' },
]

interface Props {
  householdId: string
  onClose: () => void
  onCreated: (customer: CleanCustomer) => void
}

export default function AddCustomerSheet({ householdId, onClose, onCreated }: Props) {
  const supabase = createClient()
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [area, setArea] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [primaryRate, setPrimaryRate] = useState('')
  const [recurrence, setRecurrence] = useState<Recurrence>(null)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    if (!householdId) { setError('Not linked to a household'); return }
    setSaving(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('clean_customers')
      .insert({
        household_id: householdId,
        name: name.trim(),
        address: address.trim() || null,
        area: area.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        primary_rate: primaryRate ? parseFloat(primaryRate) : null,
        recurrence: recurrence ?? null,
        notes: notes.trim() || null,
        status: 'active',
      })
      .select()
      .single()

    setSaving(false)
    if (err) { setError(err.message); return }
    onCreated(data as CleanCustomer)
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

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 pb-4">
          <div className="flex items-center justify-between mt-2 mb-5">
            <h2 className="text-lg font-bold text-gray-900">New Client</h2>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-4 h-4">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <Field label="Name *">
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jane Smith"
                className={inputCls}
              />
            </Field>

            {/* Phone */}
            <Field label="Phone">
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(509) 555-0100"
                className={inputCls}
              />
            </Field>

            {/* Email */}
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className={inputCls}
              />
            </Field>

            {/* Address */}
            <Field label="Address">
              <input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="123 Main St, Spokane WA"
                className={inputCls}
              />
            </Field>

            {/* Area */}
            <Field label="Area / Neighborhood">
              <input
                value={area}
                onChange={e => setArea(e.target.value)}
                placeholder="Deer Park, South Hill…"
                className={inputCls}
              />
            </Field>

            {/* Rate */}
            <Field label="Primary Rate">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={primaryRate}
                  onChange={e => setPrimaryRate(e.target.value)}
                  placeholder="150"
                  className={`${inputCls} pl-7`}
                />
              </div>
            </Field>

            {/* Recurrence */}
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

            {/* Notes */}
            <Field label="Notes">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Key code, parking, preferences…"
                rows={3}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 pt-3 pb-8 border-t border-gray-100 bg-white space-y-2">
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 rounded-xl font-semibold text-white text-sm disabled:opacity-50"
            style={{ backgroundColor: '#2C5F8A' }}
          >
            {saving ? 'Saving…' : 'Add Client'}
          </button>
        </div>
      </div>
    </>
  )
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

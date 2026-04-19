'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { CleanLead, LeadStatus } from '@/types/clean'

const HEARD_FROM_LABELS: Record<string, string> = {
  google: 'Google Search',
  word_of_mouth: 'Word of Mouth',
  social_media: 'Social Media',
  nextdoor: 'Nextdoor',
  other: 'Other',
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  quoted: 'Quoted',
  won: 'Won',
  lost: 'Lost',
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-amber-100 text-amber-700',
  contacted: 'bg-blue-50 text-blue-600',
  quoted: 'bg-purple-50 text-purple-600',
  won: 'bg-green-50 text-green-600',
  lost: 'bg-gray-100 text-gray-500',
}

interface Props {
  lead: CleanLead
  onClose: () => void
  onUpdated: (lead: CleanLead) => void
  onConvert: (lead: CleanLead) => void
}

export default function LeadSheet({ lead, onClose, onUpdated, onConvert }: Props) {
  const supabase = createClient()
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  async function setStatus(status: LeadStatus, lost_reason?: string) {
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('clean_leads')
      .update({ status, ...(status === 'lost' ? { lost_reason: lost_reason ?? null } : {}) })
      .eq('id', lead.id)
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    onUpdated(data as CleanLead)
  }

  const heardFromLabel = lead.heard_from
    ? HEARD_FROM_LABELS[lead.heard_from] || lead.heard_from
    : null

  const createdAgo = formatRelative(lead.created_at)

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={handleClose}
      />

      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col max-w-lg mx-auto transition-transform duration-300"
        style={{ maxHeight: '92vh', transform: visible ? 'translateY(0)' : 'translateY(100%)' }}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-4">
          <div className="flex items-start justify-between mt-2 mb-4 gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{lead.name}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[lead.status]}`}>
                  {STATUS_LABELS[lead.status]}
                </span>
                <span className="text-xs text-gray-400">{createdAgo}</span>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 shrink-0"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-4 h-4">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="space-y-3">
            {lead.email && (
              <InfoRow label="Email">
                <a href={`mailto:${lead.email}`} className="text-[#2C5F8A] underline break-all">{lead.email}</a>
              </InfoRow>
            )}
            {lead.phone && (
              <InfoRow label="Phone">
                <a href={`tel:${lead.phone}`} className="text-[#2C5F8A] underline">{lead.phone}</a>
              </InfoRow>
            )}
            {lead.address && (
              <InfoRow label="Address">
                <span className="text-gray-700">{lead.address}</span>
              </InfoRow>
            )}
            {heardFromLabel && (
              <InfoRow label="Heard from">
                <span className="text-gray-700">{heardFromLabel}</span>
              </InfoRow>
            )}
            {lead.notes && (
              <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Message</div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{lead.notes}</div>
              </div>
            )}
            {lead.lost_reason && (
              <InfoRow label="Lost reason">
                <span className="text-gray-700">{lead.lost_reason}</span>
              </InfoRow>
            )}
          </div>
        </div>

        <div className="shrink-0 px-5 pt-3 pb-8 border-t border-gray-100 bg-white space-y-2">
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}

          <div className="flex gap-2">
            {lead.status === 'new' && (
              <button
                onClick={() => setStatus('contacted')}
                disabled={saving}
                className="flex-1 h-11 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 disabled:opacity-50"
              >
                Mark Contacted
              </button>
            )}
            {(lead.status === 'new' || lead.status === 'contacted') && (
              <button
                onClick={() => setStatus('quoted')}
                disabled={saving}
                className="flex-1 h-11 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 disabled:opacity-50"
              >
                Mark Quoted
              </button>
            )}
            {lead.status !== 'lost' && lead.status !== 'won' && (
              <button
                onClick={() => setStatus('lost')}
                disabled={saving}
                className="flex-1 h-11 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-500 disabled:opacity-50"
              >
                Archive
              </button>
            )}
          </div>

          {lead.status !== 'won' && (
            <button
              onClick={() => onConvert(lead)}
              disabled={saving}
              className="w-full h-12 rounded-xl font-semibold text-white text-sm disabled:opacity-50"
              style={{ backgroundColor: '#0E9F8E' }}
            >
              Convert to Client
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <div className="w-20 shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="text-sm flex-1 min-w-0">{children}</div>
    </div>
  )
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - then)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

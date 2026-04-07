'use client'

import type { EventStatus } from '@/types/clean'

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

interface Props {
  currentStatus: EventStatus
  onSelect: (newStatus: EventStatus) => void
  onClose: () => void
}

export default function StatusPicker({ currentStatus, onSelect, onClose }: Props) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        style={{ zIndex: 70 }}
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-64 overflow-hidden"
        style={{ zIndex: 71 }}
      >
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-4 pt-4 pb-2">
          Set status
        </p>
        {ALL_STATUSES.map(s => {
          const cfg = statusConfig[s]
          const active = currentStatus === s
          return (
            <button
              key={s}
              onClick={() => onSelect(s)}
              className={`w-full flex items-center justify-between px-4 py-3.5 text-sm border-t border-gray-100 transition-colors active:bg-gray-50 ${active ? 'bg-gray-50' : 'bg-white'}`}
            >
              <span className={active ? 'font-bold text-gray-900' : 'text-gray-700'}>
                {cfg.label}
              </span>
              {active && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-green-500">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          )
        })}
      </div>
    </>
  )
}

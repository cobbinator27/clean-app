'use client'

import Link from 'next/link'

// Shared admin navigation tabs, shown on every admin screen so you can jump
// directly between Yearly / Monthly / Payroll / Owner+ / Taxes without bouncing
// back to the dashboard first. Pass the current tab to highlight it.

export type AdminTab = 'yearly' | 'monthly' | 'payroll' | 'owner' | 'taxes'

const TABS: { key: AdminTab; label: string; href: string }[] = [
  { key: 'yearly', label: 'Yearly', href: '/dashboard/admin' },
  { key: 'monthly', label: 'Monthly', href: '/dashboard/admin/financials' },
  { key: 'payroll', label: 'Payroll', href: '/dashboard/admin/payroll' },
  { key: 'owner', label: 'Owner +', href: '/dashboard/admin/owner' },
  { key: 'taxes', label: 'Taxes', href: '/dashboard/admin/taxes' },
]

export default function AdminTabs({ active }: { active: AdminTab }) {
  return (
    <nav className="flex flex-wrap gap-1 mt-3">
      {TABS.map(t =>
        t.key === active ? (
          <span
            key={t.key}
            aria-current="page"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700"
          >
            {t.label}
          </span>
        ) : (
          <Link
            key={t.key}
            href={t.href}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            {t.label}
          </Link>
        )
      )}
    </nav>
  )
}

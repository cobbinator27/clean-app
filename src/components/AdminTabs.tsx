'use client'

import Link from 'next/link'

// Shared admin navigation tabs, shown on every admin screen so you can jump
// directly between the per-person, payroll, yearly, and tax views without
// bouncing back to the dashboard first. Pass the current tab to highlight it.
//
// Julie  → each person's own money (her cleaning business, by month + YTD)
// Daniel → the owner's own money (extra income, by month + YTD)
// Payroll→ reconcile the month's actuals for both, which feed the two tabs above
// Yearly → household year overview + compliance checklist
// Taxes  → tax summary by year
//
// Routes are kept stable: Julie lives on the old "financials" route and Daniel
// on the old "owner" route, so existing links/bookmarks don't break.

export type AdminTab = 'julie' | 'daniel' | 'payroll' | 'yearly' | 'taxes'

const TABS: { key: AdminTab; label: string; href: string }[] = [
  { key: 'julie', label: 'Julie', href: '/dashboard/admin/financials' },
  { key: 'daniel', label: 'Daniel', href: '/dashboard/admin/owner' },
  { key: 'payroll', label: 'Payroll', href: '/dashboard/admin/payroll' },
  { key: 'yearly', label: 'Yearly', href: '/dashboard/admin' },
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

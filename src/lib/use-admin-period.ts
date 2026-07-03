'use client'

import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

// Sticky admin period selection.
//
// The admin screens live on separate routes (Yearly / Monthly / Payroll /
// Owner+ / Taxes), so plain useState resets the selected month/year to "current"
// every time you switch tabs. These hooks persist the selection in localStorage
// so the period you're looking at follows you across tabs.
//
// - Month-scoped tabs use useStickyMonthKey (also stamps the year so a following
//   year-scoped tab lands on the same year).
// - Year-scoped tabs use useStickyYear.

const MONTH_LS = 'clean_admin_month'
const YEAR_LS = 'clean_admin_year'

function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Persisted "YYYY-MM" selection shared across the month-scoped admin tabs. */
export function useStickyMonthKey(): [string, Dispatch<SetStateAction<string>>] {
  const [monthKey, setState] = useState<string>(currentMonthKey())

  // Hydrate from storage after mount (avoids SSR/hydration mismatch).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MONTH_LS)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate from localStorage
      if (saved && /^\d{4}-\d{2}$/.test(saved)) setState(saved)
    } catch { /* ignore */ }
  }, [])

  const setMonthKey: Dispatch<SetStateAction<string>> = value => {
    setState(prev => {
      const next = typeof value === 'function' ? (value as (p: string) => string)(prev) : value
      try {
        window.localStorage.setItem(MONTH_LS, next)
        window.localStorage.setItem(YEAR_LS, next.slice(0, 4))
      } catch { /* ignore */ }
      return next
    })
  }

  return [monthKey, setMonthKey]
}

/** Persisted year selection shared across the year-scoped admin tabs. */
export function useStickyYear(): [number, Dispatch<SetStateAction<number>>] {
  const [year, setState] = useState<number>(() => new Date().getFullYear())

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(YEAR_LS)
      const n = saved ? parseInt(saved, 10) : NaN
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate from localStorage
      if (!Number.isNaN(n) && n > 2000 && n < 3000) setState(n)
    } catch { /* ignore */ }
  }, [])

  const setYear: Dispatch<SetStateAction<number>> = value => {
    setState(prev => {
      const next = typeof value === 'function' ? (value as (p: number) => number)(prev) : value
      try { window.localStorage.setItem(YEAR_LS, String(next)) } catch { /* ignore */ }
      return next
    })
  }

  return [year, setYear]
}

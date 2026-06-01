import type {
  CleanBusinessSettings,
  CleanMonthlyFinancials,
  CleanOwnerIncome,
} from '@/types/clean'
import { computeOwnerIncome } from '@/lib/owner-income'

// ── Combined tax summary ─────────────────────────────────────────────────────
//
// Pulls together what to set aside / pay across BOTH sides of the business:
//   • Julie's side  — tax_reserve from clean_monthly_financials
//   • Owner's side  — tax reserve derived from clean_owner_income (extra income)
//
// Grouped two ways: a year-to-date running total, and per federal estimated-tax
// quarter (the periods the IRS actually uses, not calendar quarters).
//
// For a finalized owner month we use the ACTUAL set-aside the owner entered;
// otherwise we use the live estimate from that month's ratios.

// Federal estimated-tax periods → the calendar months that feed each one.
//   Q1: Jan–Mar (due Apr 15), Q2: Apr–May (due Jun 15),
//   Q3: Jun–Aug (due Sep 15), Q4: Sep–Dec (due Jan 15 next year)
export const FEDERAL_QUARTERS = [
  { q: 'Q1', months: [1, 2, 3], dueLabel: 'Apr 15' },
  { q: 'Q2', months: [4, 5], dueLabel: 'Jun 15' },
  { q: 'Q3', months: [6, 7, 8], dueLabel: 'Sep 15' },
  { q: 'Q4', months: [9, 10, 11, 12], dueLabel: 'Jan 15' },
] as const

export interface TaxBucket {
  julieReserve: number   // sum of clean_monthly_financials.tax_reserve
  ownerReserve: number   // owner extra-income tax reserve (actual if finalized, else estimate)
  total: number          // julie + owner
  ownerFinalized: boolean // true only if every owner month in the bucket is finalized
}

export interface QuarterTax extends TaxBucket {
  q: string              // 'Q1'..'Q4'
  dueLabel: string       // 'Apr 15'
  monthsWithData: number // how many of the quarter's months actually have numbers
}

export interface TaxSummary {
  year: number
  ytd: TaxBucket
  quarters: QuarterTax[]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Owner tax reserve for a single month: actual when finalized, else live estimate.
export function ownerMonthReserve(
  owner: CleanOwnerIncome,
  fin: CleanMonthlyFinancials | null,
  settings: CleanBusinessSettings | null
): number {
  if (owner.finalized && owner.actual_tax_reserve != null) {
    return owner.actual_tax_reserve
  }
  const b = computeOwnerIncome(owner.amount, fin, settings, owner.mirror_expenses)
  return b.taxReserve
}

export function buildTaxSummary(
  year: number,
  monthly: CleanMonthlyFinancials[],
  ownerIncome: CleanOwnerIncome[],
  settings: CleanBusinessSettings | null
): TaxSummary {
  const prefix = `${year}-`
  const finByMonth: Record<string, CleanMonthlyFinancials> = {}
  for (const m of monthly) finByMonth[m.month_key] = m

  const ownerByMonth: Record<string, CleanOwnerIncome> = {}
  for (const o of ownerIncome) ownerByMonth[o.month_key] = o

  // Per-month reserves for the year.
  const julieByMonthNum: Record<number, number> = {}
  const ownerByMonthNum: Record<number, number> = {}
  const ownerFinalizedByMonthNum: Record<number, boolean> = {}
  const dataMonths = new Set<number>()

  for (const m of monthly) {
    if (!m.month_key.startsWith(prefix)) continue
    const mm = Number(m.month_key.slice(5, 7))
    julieByMonthNum[mm] = (julieByMonthNum[mm] ?? 0) + (m.tax_reserve ?? 0)
    dataMonths.add(mm)
  }
  for (const o of ownerIncome) {
    if (!o.month_key.startsWith(prefix)) continue
    const mm = Number(o.month_key.slice(5, 7))
    const reserve = ownerMonthReserve(o, finByMonth[o.month_key] ?? null, settings)
    ownerByMonthNum[mm] = (ownerByMonthNum[mm] ?? 0) + reserve
    ownerFinalizedByMonthNum[mm] = (ownerFinalizedByMonthNum[mm] ?? true) && o.finalized
    if (reserve > 0 || o.amount > 0) dataMonths.add(mm)
  }

  const quarters: QuarterTax[] = FEDERAL_QUARTERS.map(({ q, months, dueLabel }) => {
    let julie = 0
    let owner = 0
    let ownerFinalized = true
    let ownerMonthsPresent = 0
    let monthsWithData = 0
    for (const mm of months) {
      julie += julieByMonthNum[mm] ?? 0
      owner += ownerByMonthNum[mm] ?? 0
      if (ownerByMonthNum[mm] != null) {
        ownerMonthsPresent++
        ownerFinalized = ownerFinalized && (ownerFinalizedByMonthNum[mm] ?? false)
      }
      if (dataMonths.has(mm)) monthsWithData++
    }
    return {
      q,
      dueLabel,
      julieReserve: round2(julie),
      ownerReserve: round2(owner),
      total: round2(julie + owner),
      ownerFinalized: ownerMonthsPresent > 0 ? ownerFinalized : false,
      monthsWithData,
    }
  })

  const ytdJulie = quarters.reduce((s, q) => s + q.julieReserve, 0)
  const ytdOwner = quarters.reduce((s, q) => s + q.ownerReserve, 0)
  const ytdOwnerFinalized =
    ownerIncome.filter(o => o.month_key.startsWith(prefix)).length > 0 &&
    ownerIncome.filter(o => o.month_key.startsWith(prefix)).every(o => o.finalized)

  return {
    year,
    ytd: {
      julieReserve: round2(ytdJulie),
      ownerReserve: round2(ytdOwner),
      total: round2(ytdJulie + ytdOwner),
      ownerFinalized: ytdOwnerFinalized,
    },
    quarters,
  }
}

import type { CleanBusinessSettings, CleanMonthlyFinancials } from '@/types/clean'
import { EMPLOYEE_DEDUCTION_RATE } from '@/lib/pacing'

// ── Owner / extra-income breakdown ───────────────────────────────────────────
//
// Takes a flat extra-income amount and splits it using the SAME ratios as that
// month's real Julie financials (clean_monthly_financials), then applies the
// same payroll/tax formulas used in pacing.ts. Nothing here is persisted — the
// breakdown is always derived live so it stays in sync with the month's actuals.
//
// As an S-corp owner-employee, the "gross wages" portion is the owner's W-2
// reasonable compensation; the remainder is profit/distribution.

export interface OwnerIncomeBreakdown {
  hasRatio: boolean          // false when the month has no revenue to derive ratios from
  amount: number
  wageRatio: number          // gross_wages / gross_income for the month
  expenseRatio: number       // total expenses / gross_income for the month
  grossWages: number         // your W-2 wages (reasonable comp)
  employeeDeduction: number  // FICA + Medicare withheld from wages (7.65%)
  payrollDeposit: number     // your W-2 take-home (wages × 0.9235)
  employerTax: number        // employer payroll cost on top of wages
  payrollWithdrawal: number  // total payroll cost (wages × overhead factor)
  expenses: number           // phantom expenses (0 unless mirror_expenses)
  incomeAsProfit: number     // amount − payroll withdrawal − expenses
  taxReserve: number         // income as profit × tax_reserve_pct
  transferToBank: number     // tax reserve + payroll withdrawal → move to tax/bank acct
  netToYou: number           // amount − transfer to bank + payroll deposit
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function computeOwnerIncome(
  amount: number,
  fin: CleanMonthlyFinancials | null,
  settings: CleanBusinessSettings | null,
  mirrorExpenses: boolean
): OwnerIncomeBreakdown {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0
  const grossIncome = fin?.gross_income ?? 0

  // Need a real revenue figure for the month to derive ratios from.
  if (!fin || !settings || grossIncome <= 0) {
    return {
      hasRatio: false,
      amount: safeAmount,
      wageRatio: 0,
      expenseRatio: 0,
      grossWages: 0,
      employeeDeduction: 0,
      payrollDeposit: 0,
      employerTax: 0,
      payrollWithdrawal: 0,
      expenses: 0,
      incomeAsProfit: 0,
      taxReserve: 0,
      transferToBank: 0,
      netToYou: 0,
    }
  }

  const wageRatio = fin.gross_wages / grossIncome
  const monthExpenses =
    (fin.total_mileage_expense ?? 0) +
    (fin.sb_expenses_total ?? 0) +
    (fin.total_flat_expense ?? 0)
  const expenseRatio = monthExpenses / grossIncome

  const grossWages = safeAmount * wageRatio
  const payrollWithdrawal = grossWages * settings.payroll_overhead_factor
  const payrollDeposit = grossWages * (1 - EMPLOYEE_DEDUCTION_RATE)
  const employeeDeduction = grossWages * EMPLOYEE_DEDUCTION_RATE
  const employerTax = payrollWithdrawal - grossWages

  const expenses = mirrorExpenses ? safeAmount * expenseRatio : 0
  const incomeAsProfit = safeAmount - payrollWithdrawal - expenses
  const taxReserve = incomeAsProfit * settings.tax_reserve_pct
  const transferToBank = taxReserve + payrollWithdrawal
  const netToYou = safeAmount - transferToBank + payrollDeposit

  return {
    hasRatio: true,
    amount: safeAmount,
    wageRatio,
    expenseRatio,
    grossWages: round2(grossWages),
    employeeDeduction: round2(employeeDeduction),
    payrollDeposit: round2(payrollDeposit),
    employerTax: round2(employerTax),
    payrollWithdrawal: round2(payrollWithdrawal),
    expenses: round2(expenses),
    incomeAsProfit: round2(incomeAsProfit),
    taxReserve: round2(taxReserve),
    transferToBank: round2(transferToBank),
    netToYou: round2(netToYou),
  }
}

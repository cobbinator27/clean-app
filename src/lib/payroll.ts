import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CleanBusinessSettings,
  CleanMonthlyFinancials,
  CleanOwnerIncome,
} from '@/types/clean'
import { computeOwnerIncome } from '@/lib/owner-income'

// ── Unified payroll model ────────────────────────────────────────────────────
//
// One screen to reconcile BOTH people for a month. For each person you enter the
// actual total payroll WITHDRAWAL and actual NET PAY (deposit); the tax reserve
// and the single "move to bank" total are computed.
//
//   Julie's actuals  → clean_monthly_financials (payroll_withdrawal / _deposit)
//   Owner's actuals  → clean_owner_income (actual_withdrawal / actual_deposit)
//
// Tax reserve per person = their profit × tax_reserve_pct, where
//   profit = gross/amount − withdrawal − expenses.
// "Move to bank" = Σ (withdrawal + tax reserve) across both people.

export interface PersonPayroll {
  key: 'julie' | 'owner'
  label: string
  hasData: boolean          // there's income for this person this month
  // estimates (from ratios / pacing) — shown as placeholders
  estWithdrawal: number
  estDeposit: number
  estTaxReserve: number
  // actuals (null until entered)
  actualWithdrawal: number | null
  actualDeposit: number | null
  // effective values (actual if present, else estimate)
  withdrawal: number
  deposit: number
  taxReserve: number        // recomputed from the effective withdrawal
  toBank: number            // withdrawal + taxReserve for this person
}

export interface PayrollSummary {
  monthKey: string
  julie: PersonPayroll
  owner: PersonPayroll
  finalized: boolean        // both sides locked (owner finalized; Julie finalized)
  totalWithdrawal: number
  totalTaxReserve: number
  totalToBank: number       // THE number: move this to the bank
  totalNetPay: number       // combined take-home (both people)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Tax reserve for a person given their income base, an effective withdrawal,
// and their expenses, at the household tax rate.
function reserveFrom(
  incomeBase: number,
  withdrawal: number,
  expenses: number,
  taxPct: number
): number {
  const profit = incomeBase - withdrawal - expenses
  return round2(profit * taxPct)
}

export function buildPayrollSummary(
  monthKey: string,
  fin: CleanMonthlyFinancials | null,
  owner: CleanOwnerIncome | null,
  settings: CleanBusinessSettings | null
): PayrollSummary {
  const taxPct = settings?.tax_reserve_pct ?? 0.22

  // ── Julie (from clean_monthly_financials) ──
  const julieGross = fin?.gross_income ?? 0
  const julieExpenses =
    (fin?.total_mileage_expense ?? 0) +
    (fin?.sb_expenses_total ?? 0) +
    (fin?.total_flat_expense ?? 0)
  const julieEstWithdrawal = fin?.payroll_withdrawal ?? 0
  const julieEstDeposit = fin?.payroll_deposit ?? 0
  // Julie is "actual" only when her month is finalized.
  const julieActualWithdrawal = fin?.finalized ? fin?.payroll_withdrawal ?? null : null
  const julieActualDeposit = fin?.finalized ? fin?.payroll_deposit ?? null : null
  const julieWithdrawal = julieActualWithdrawal ?? julieEstWithdrawal
  const julieDeposit = julieActualDeposit ?? julieEstDeposit
  const julieReserve = reserveFrom(julieGross, julieWithdrawal, julieExpenses, taxPct)
  const julieEstReserve = reserveFrom(julieGross, julieEstWithdrawal, julieExpenses, taxPct)

  const julie: PersonPayroll = {
    key: 'julie',
    label: 'Julie (cleans)',
    hasData: julieGross > 0,
    estWithdrawal: round2(julieEstWithdrawal),
    estDeposit: round2(julieEstDeposit),
    estTaxReserve: julieEstReserve,
    actualWithdrawal: julieActualWithdrawal,
    actualDeposit: julieActualDeposit,
    withdrawal: round2(julieWithdrawal),
    deposit: round2(julieDeposit),
    taxReserve: julieReserve,
    toBank: round2(julieWithdrawal + julieReserve),
  }

  // ── Owner (from clean_owner_income + that month's ratios) ──
  const b = computeOwnerIncome(owner?.amount ?? 0, fin, settings, owner?.mirror_expenses ?? false)
  const ownerAmount = owner?.amount ?? 0
  const ownerExpenses = b.expenses
  const ownerEstWithdrawal = b.payrollWithdrawal
  const ownerEstDeposit = b.payrollDeposit
  const ownerActualWithdrawal = owner?.finalized ? owner?.actual_withdrawal ?? null : null
  const ownerActualDeposit = owner?.finalized ? owner?.actual_deposit ?? null : null
  const ownerWithdrawal = ownerActualWithdrawal ?? ownerEstWithdrawal
  const ownerDeposit = ownerActualDeposit ?? ownerEstDeposit
  const ownerReserve = reserveFrom(ownerAmount, ownerWithdrawal, ownerExpenses, taxPct)

  const owner_: PersonPayroll = {
    key: 'owner',
    label: 'You (owner income)',
    hasData: ownerAmount > 0,
    estWithdrawal: round2(ownerEstWithdrawal),
    estDeposit: round2(ownerEstDeposit),
    estTaxReserve: round2(b.taxReserve),
    actualWithdrawal: ownerActualWithdrawal,
    actualDeposit: ownerActualDeposit,
    withdrawal: round2(ownerWithdrawal),
    deposit: round2(ownerDeposit),
    taxReserve: ownerReserve,
    toBank: round2(ownerWithdrawal + ownerReserve),
  }

  const totalWithdrawal = round2(julie.withdrawal + owner_.withdrawal)
  const totalTaxReserve = round2(julie.taxReserve + owner_.taxReserve)
  const totalToBank = round2(julie.toBank + owner_.toBank)
  const totalNetPay = round2(julie.deposit + owner_.deposit)

  // "finalized" = every person WITH data is locked.
  const julieLocked = !julie.hasData || (fin?.finalized ?? false)
  const ownerLocked = !owner_.hasData || (owner?.finalized ?? false)

  return {
    monthKey,
    julie,
    owner: owner_,
    finalized: julieLocked && ownerLocked && (julie.hasData || owner_.hasData),
    totalWithdrawal,
    totalTaxReserve,
    totalToBank,
    totalNetPay,
  }
}

// Persist Julie's actuals to clean_monthly_financials (mirrors the old finalize).
export async function saveJuliePayroll(
  supabase: SupabaseClient,
  fin: CleanMonthlyFinancials,
  settings: CleanBusinessSettings,
  actualWithdrawal: number,
  actualDeposit: number,
  finalized: boolean
): Promise<{ error: string | null }> {
  const gross = fin.gross_income
  const totalExpenses =
    (fin.total_mileage_expense ?? 0) + (fin.sb_expenses_total ?? 0) + (fin.total_flat_expense ?? 0)
  const incomeAsProfit = round2(gross - actualWithdrawal - totalExpenses)
  const taxReserve = round2(incomeAsProfit * settings.tax_reserve_pct)
  const transferToBank = round2(taxReserve + actualWithdrawal)
  const netToHousehold = round2(gross - transferToBank + actualDeposit)

  const { error } = await supabase
    .from('clean_monthly_financials')
    .update({
      payroll_withdrawal: actualWithdrawal,
      payroll_deposit: actualDeposit,
      income_as_profit: incomeAsProfit,
      tax_reserve: taxReserve,
      transfer_to_bank: transferToBank,
      net_to_household: netToHousehold,
      finalized,
      finalized_at: finalized ? new Date().toISOString() : null,
    })
    .eq('id', fin.id)
  return { error: error?.message ?? null }
}

// Persist the owner's actuals to clean_owner_income.
export async function saveOwnerPayroll(
  supabase: SupabaseClient,
  owner: CleanOwnerIncome,
  actualWithdrawal: number,
  actualDeposit: number,
  taxReserve: number,
  finalized: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('clean_owner_income')
    .update({
      actual_withdrawal: actualWithdrawal,
      actual_deposit: actualDeposit,
      actual_tax_reserve: taxReserve,
      finalized,
      finalized_at: finalized ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', owner.id)
  return { error: error?.message ?? null }
}

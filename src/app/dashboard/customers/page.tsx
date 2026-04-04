'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { CleanCustomer, Recurrence } from '@/types/clean'
import AddCustomerSheet from '@/components/AddCustomerSheet'

// ── Helpers ───────────────────────────────────────────────────────────────────

const recurrenceLabels: Record<NonNullable<Recurrence>, string> = {
  weekly:    'Weekly',
  bi_weekly: 'Bi-Weekly',
  monthly:   'Monthly',
}

const recurrenceColors: Record<NonNullable<Recurrence>, string> = {
  weekly:    'bg-blue-50 text-blue-600',
  bi_weekly: 'bg-purple-50 text-purple-600',
  monthly:   'bg-indigo-50 text-indigo-600',
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomerWithNext extends CleanCustomer {
  next_date: string | null
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 animate-pulse flex items-center gap-3">
      <div className="flex-1 space-y-2">
        <div className="h-5 bg-gray-200 rounded w-40" />
        <div className="h-4 bg-gray-100 rounded w-24" />
      </div>
      <div className="h-4 bg-gray-100 rounded w-10" />
    </div>
  )
}

// ── Customer card ─────────────────────────────────────────────────────────────

function CustomerCard({ customer, onClick }: { customer: CustomerWithNext; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
    >
      {/* Avatar */}
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0"
        style={{ backgroundColor: '#2C5F8A' }}
      >
        {customer.name.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-gray-900" style={{ fontSize: 17 }}>
            {customer.name}
          </span>
          {customer.recurrence && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${recurrenceColors[customer.recurrence]}`}>
              {recurrenceLabels[customer.recurrence]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {customer.area && (
            <span className="text-sm text-gray-400">{customer.area}</span>
          )}
          {customer.primary_rate != null && (
            <span className="text-sm font-semibold text-gray-600">${customer.primary_rate.toFixed(0)}</span>
          )}
          {customer.next_date && (
            <span className="text-xs text-gray-400">Next: {formatDate(customer.next_date)}</span>
          )}
        </div>
      </div>

      {/* Chevron */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-300 shrink-0">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const supabase = createClient()
  const router = useRouter()

  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [customers, setCustomers] = useState<CustomerWithNext[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'active' | 'inactive'>('active')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    async function loadHousehold() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single()
      if (data) setHouseholdId(data.household_id)
    }
    loadHousehold()
  }, [])

  const loadCustomers = useCallback(async () => {
    if (!householdId) return
    setLoading(true)

    console.log('[customers] householdId:', householdId, 'tab:', tab)
    const { data: cxData, error: cxError } = await supabase
      .from('clean_customers')
      .select('*')
      .eq('household_id', householdId)
      .eq('status', tab)
      .order('name')
    console.log('[customers] result:', cxData, cxError)

    const cxList = (cxData ?? []) as CleanCustomer[]

    // Fetch next scheduled event per customer
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const withNext: CustomerWithNext[] = await Promise.all(
      cxList.map(async cx => {
        const { data: evData } = await supabase
          .from('clean_events')
          .select('scheduled_date')
          .eq('customer_id', cx.id)
          .in('status', ['scheduled', 'arrived'])
          .gte('scheduled_date', todayStr)
          .order('scheduled_date')
          .limit(1)
          .single()
        return { ...cx, next_date: evData?.scheduled_date ?? null }
      })
    )

    setCustomers(withNext)
    setLoading(false)
  }, [householdId, tab])

  useEffect(() => {
    if (householdId) loadCustomers()
    else setLoading(false)
  }, [householdId, loadCustomers])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm px-4 pt-4 pb-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">Clients</h1>
          <span className="text-sm text-gray-400">{customers.length} total</span>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-gray-100 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        {/* Active / Inactive tabs */}
        <div className="flex border-b border-gray-100">
          {(['active', 'inactive'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 pb-2 text-sm font-semibold capitalize border-b-2 transition-colors ${
                tab === t ? 'border-[#2C5F8A] text-[#2C5F8A]' : 'border-transparent text-gray-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {/* List */}
      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 mx-auto mb-3 text-gray-300">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <p className="text-sm font-medium">
              {search ? 'No clients match your search' : `No ${tab} clients yet`}
            </p>
          </div>
        ) : (
          filtered.map(cx => (
            <CustomerCard
              key={cx.id}
              customer={cx}
              onClick={() => router.push(`/dashboard/customers/${cx.id}`)}
            />
          ))
        )}

        <div className="h-4" />
      </div>

      {/* Floating + */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white z-30 active:scale-95 transition-transform"
        style={{ backgroundColor: '#0E9F8E' }}
        aria-label="Add client"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-7 h-7">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {showAdd && (
        <AddCustomerSheet
          householdId={householdId ?? ''}
          onClose={() => setShowAdd(false)}
          onCreated={cx => {
            setCustomers(prev => [...prev, { ...cx, next_date: null }].sort((a, b) => a.name.localeCompare(b.name)))
            setShowAdd(false)
          }}
        />
      )}
    </>
  )
}

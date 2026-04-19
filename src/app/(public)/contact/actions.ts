'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'

const HOUSEHOLD_ID = 'd77828c0-f323-46d5-bda0-cb02a5f7ee35'

export async function submitQuote(formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const phone = (formData.get('phone') as string) || null
  const address = (formData.get('address') as string) || null
  const heard_from = (formData.get('referral_source') as string) || null
  const message = (formData.get('message') as string) || null

  if (!name || !email) {
    return { error: 'Name and email are required.' }
  }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.from('clean_leads').insert({
    household_id: HOUSEHOLD_ID,
    name,
    email,
    phone,
    address,
    heard_from,
    notes: message,
    status: 'new',
  })

  if (error) {
    console.error('Lead insert error:', error)
    return { error: 'Something went wrong. Please text us at (509) 720-8067 instead.' }
  }

  return { success: true }
}

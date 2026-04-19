'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { sendEmail, escapeHtml } from '@/lib/email'

const HOUSEHOLD_ID = 'd77828c0-f323-46d5-bda0-cb02a5f7ee35'

const REFERRAL_LABELS: Record<string, string> = {
  google: 'Google Search',
  word_of_mouth: 'Word of Mouth',
  social_media: 'Social Media',
  nextdoor: 'Nextdoor',
  other: 'Other',
}

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

  const notifyEmails = (process.env.LEAD_NOTIFY_EMAILS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const referralLabel = heard_from
    ? REFERRAL_LABELS[heard_from] || heard_from
    : 'Not specified'

  const firstName = name.split(' ')[0]

  const results = await Promise.allSettled([
    notifyEmails.length > 0
      ? sendEmail({
          to: notifyEmails,
          replyTo: email,
          subject: `New quote request — ${name}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
              <h2 style="margin: 0 0 16px 0;">New quote request</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #666; width: 120px;">Name</td><td style="padding: 8px 0;">${escapeHtml(name)}</td></tr>
                <tr><td style="padding: 8px 0; color: #666;">Email</td><td style="padding: 8px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
                ${phone ? `<tr><td style="padding: 8px 0; color: #666;">Phone</td><td style="padding: 8px 0;"><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></td></tr>` : ''}
                ${address ? `<tr><td style="padding: 8px 0; color: #666;">Address</td><td style="padding: 8px 0;">${escapeHtml(address)}</td></tr>` : ''}
                <tr><td style="padding: 8px 0; color: #666;">Heard from</td><td style="padding: 8px 0;">${escapeHtml(referralLabel)}</td></tr>
              </table>
              ${message ? `<div style="margin-top: 16px; padding: 16px; background: #f6f6f6; border-radius: 8px;"><div style="color: #666; margin-bottom: 4px; font-size: 13px;">Message</div><div style="white-space: pre-wrap;">${escapeHtml(message)}</div></div>` : ''}
              <p style="margin-top: 24px; color: #666; font-size: 13px;">Reply to this email to respond directly to ${escapeHtml(firstName)}.</p>
            </div>
          `,
        })
      : Promise.resolve(null),
    sendEmail({
      to: email,
      subject: 'We got your request — clean.',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
          <h2 style="margin: 0 0 16px 0;">Thanks, ${escapeHtml(firstName)}!</h2>
          <p style="line-height: 1.6;">We got your request and will get back to you within 24 hours with a free estimate.</p>
          <p style="line-height: 1.6;">If you need to reach us sooner, text or call <a href="tel:+15097208067">(509) 720-8067</a>.</p>
          <p style="margin-top: 32px; color: #666; font-size: 13px;">— The clean. team</p>
        </div>
      `,
    }),
  ])

  for (const r of results) {
    if (r.status === 'rejected') {
      console.error('Email send failed:', r.reason)
    }
  }

  return { success: true }
}

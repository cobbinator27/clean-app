import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

type SendEmailOpts = {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
}

export async function sendEmail(opts: SendEmailOpts) {
  return resend.emails.send({
    from: 'clean. <info@spokane-clean.com>',
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    replyTo: opts.replyTo,
  })
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

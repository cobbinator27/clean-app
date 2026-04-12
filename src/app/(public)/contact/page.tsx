import type { Metadata } from 'next'
import QuoteForm from '@/components/public/QuoteForm'

export const metadata: Metadata = {
  title: 'Get a Free Estimate',
  description:
    'Request a free, no-obligation cleaning estimate from clean. in Spokane, WA. We\'ll get back to you within 24 hours.',
}

export default function ContactPage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="bg-[var(--color-foreground)] py-16 sm:py-24 px-4 text-center">
        <p className="text-xs uppercase tracking-widest text-[var(--color-primary)] font-medium">
          Free Estimate
        </p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-serif text-white">
          Get a Free Estimate
        </h1>
        <p className="mt-4 text-white/70 max-w-lg mx-auto">
          No cost, no obligation. We&apos;ll get back to you within 24 hours.
        </p>
      </section>

      {/* ── Form Section ── */}
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-12">
          {/* Form */}
          <div className="md:col-span-3">
            <QuoteForm />
          </div>

          {/* Sidebar */}
          <div className="md:col-span-2">
            <div className="bg-[var(--color-warm-bg)] rounded-2xl p-6 sm:p-8">
              <h3 className="font-semibold text-lg">Have questions?</h3>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Shoot us a text or send an email. We&apos;d love to hear from
                you.
              </p>
              <div className="mt-6 space-y-4">
                <a
                  href="sms:+15097208067"
                  className="flex items-center gap-3 text-sm font-medium text-[var(--color-foreground)] hover:text-[var(--color-primary)] transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-[var(--color-primary)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                    />
                  </svg>
                  Text us: (509) 720-8067
                </a>
                <a
                  href="mailto:info@spokane-clean.com"
                  className="flex items-center gap-3 text-sm font-medium text-[var(--color-foreground)] hover:text-[var(--color-primary)] transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-[var(--color-primary)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                    />
                  </svg>
                  info@spokane-clean.com
                </a>
              </div>

              <hr className="my-6 border-gray-200" />

              <h3 className="font-semibold text-lg">Service Areas</h3>
              <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
                Spokane, Deer Park, Spokane Valley, North Spokane, South Hill,
                Suncrest, Colbert, and Millwood.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

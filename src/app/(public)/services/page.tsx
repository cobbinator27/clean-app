import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Residential cleaning services in Spokane, WA — recurring cleaning, move-out/move-in cleans, and deep clean projects. Flexible scheduling, safe products.',
}

export default function ServicesPage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="bg-[var(--color-foreground)] py-16 sm:py-24 px-4 text-center">
        <p className="text-xs uppercase tracking-widest text-[var(--color-primary)] font-medium">
          Our Services
        </p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-serif text-white">
          Cleaning Services
        </h1>
        <p className="mt-4 text-white/70 max-w-lg mx-auto">
          Customizable. Flexible. Consistent.
        </p>
      </section>

      {/* ── Recurring Cleaning ── */}
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden">
            <Image
              src="/photos/real/clean_experienced.webp"
              alt="Clean modern living room"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div>
            <h2 className="text-3xl font-serif">Scheduled Residential Cleaning</h2>
            <p className="mt-4 text-[var(--color-muted)] leading-relaxed">
              This is our core service. We work together to set a schedule that
              fits your life — weekly or bi-weekly — and then Julie shows up
              like clockwork.
            </p>
            <p className="mt-4 text-[var(--color-muted)] leading-relaxed">
              Every clean is customized to your home and your priorities. Some
              clients want extra attention on kitchens and bathrooms. Others
              care most about floors and dusting. We adjust to what matters to
              you.
            </p>
            <p className="mt-4 text-[var(--color-muted)] leading-relaxed">
              For most new clients, we start with an initial deep clean to get
              everything sparkling, then maintain that standard with each
              recurring visit.
            </p>
            <Link
              href="/contact"
              className="mt-6 inline-block px-6 py-3 rounded-full text-white font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors text-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>

      {/* ── Move-Out / Move-In ── */}
      <section className="bg-[var(--color-warm-bg)] py-16 sm:py-24 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="order-2 md:order-1">
            <h2 className="text-3xl font-serif">Move-Out / Move-In Cleans</h2>
            <p className="mt-4 text-[var(--color-muted)] leading-relaxed">
              Whether you&apos;re getting a home ready to list, preparing for
              open houses, or settling into a new place — we&apos;ll make sure
              it&apos;s spotless.
            </p>
            <p className="mt-4 text-[var(--color-muted)] leading-relaxed">
              We work with homeowners and realtors on:
            </p>
            <ul className="mt-3 space-y-2 text-[var(--color-muted)]">
              {[
                'Move-out cleans',
                'Deep cleans for picture day',
                'Prep for open houses and showings',
                'Move-in cleans',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <svg
                    className="w-4 h-4 text-[var(--color-primary)] mt-0.5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/contact"
              className="mt-6 inline-block px-6 py-3 rounded-full text-white font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors text-sm"
            >
              Request a Quote
            </Link>
          </div>
          <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden order-1 md:order-2">
            <Image
              src="/photos/real/clean_move-out.png"
              alt="Pristine modern kitchen"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* ── Deep Clean ── */}
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden">
            <Image
              src="/photos/real/clean.-hero.webp"
              alt="Sparkling clean bathroom"
              fill
              className="object-cover"
            />
          </div>
          <div>
            <h2 className="text-3xl font-serif">Deep Clean Projects</h2>
            <p className="mt-4 text-[var(--color-muted)] leading-relaxed">
              Whether you&apos;re a new client signing up for recurring service
              or you just need a one-time reset, a deep clean gets your home to
              a baseline that feels amazing.
            </p>
            <p className="mt-4 text-[var(--color-muted)] leading-relaxed">
              We go beyond surface-level cleaning — inside cabinets, behind
              appliances, baseboards, light fixtures, and all the spots that
              get overlooked in day-to-day life.
            </p>
            <p className="mt-4 text-sm text-[var(--color-muted)]">
              We use safe, pet-friendly, and eco-conscious cleaning products
              that are effective without being harsh.
            </p>
            <Link
              href="/contact"
              className="mt-6 inline-block px-6 py-3 rounded-full text-white font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors text-sm"
            >
              Get a Free Estimate
            </Link>
          </div>
        </div>
      </section>

      {/* ── How to Get Started ── */}
      <section className="bg-[var(--color-warm-bg)] py-16 sm:py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs uppercase tracking-widest text-[var(--color-primary)] font-medium text-center">
            Getting Started
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-serif text-center">
            How It Works
          </h2>
          <div className="mt-12 space-y-0">
            {[
              {
                step: '01',
                title: 'Request an Estimate',
                desc: 'Fill out our quick form — it takes about a minute.',
                time: '~1 min',
              },
              {
                step: '02',
                title: 'Discuss Your Needs',
                desc: "We'll chat about your home, your priorities, and scheduling.",
                time: '3–5 min',
              },
              {
                step: '03',
                title: 'Get Your Estimate',
                desc: "We'll send you a personalized quote within 24 hours.",
                time: 'Within 24 hrs',
              },
              {
                step: '04',
                title: 'In-Home Visit',
                desc: 'Julie comes to see your space and finalize the plan.',
                time: 'Within 7 days',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex items-start gap-5 py-5 border-b border-gray-200 last:border-b-0"
              >
                <span className="text-2xl font-serif text-[var(--color-primary)] shrink-0 w-10">
                  {item.step}
                </span>
                <div className="flex-1">
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    {item.desc}
                  </p>
                </div>
                <span className="text-xs text-[var(--color-muted)] shrink-0 hidden sm:block">
                  {item.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-[var(--color-primary)] py-16 sm:py-20 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-serif text-white">
            Ready to Get Started?
          </h2>
          <p className="mt-4 text-white/80">
            Get a free, no-obligation estimate for your home.
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-block px-8 py-3.5 rounded-full font-semibold bg-white text-[var(--color-primary)] hover:bg-gray-100 transition-colors text-sm sm:text-base"
          >
            Get a Free Estimate
          </Link>
        </div>
      </section>
    </>
  )
}

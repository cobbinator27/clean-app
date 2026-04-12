import Image from 'next/image'
import Link from 'next/link'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'clean.',
  description: 'Local, family-owned residential cleaning service in Spokane, WA.',
  url: 'https://spokane-clean.com',
  telephone: '(509) 720-8067',
  email: 'info@spokane-clean.com',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Spokane',
    addressRegion: 'WA',
    addressCountry: 'US',
  },
  areaServed: [
    'Spokane',
    'Deer Park',
    'Spokane Valley',
    'North Spokane',
    'South Hill',
    'Suncrest',
    'Colbert',
    'Millwood',
  ],
  priceRange: '$$',
  image: 'https://spokane-clean.com/photos/real/clean_move-out.png',
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Hero ── */}
      <section className="relative h-[55vh] sm:h-[75vh] min-h-[360px] max-h-[800px] flex items-center justify-center">
        <Image
          src="/photos/real/clean_move-out.png"
          alt="Bright, spotless modern kitchen"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 text-center px-4">
          <h1 className="font-serif text-5xl sm:text-7xl text-white tracking-tight">
            clean.
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-white max-w-md mx-auto">
            Cleaning that feels like family.
          </p>
          <p className="mt-2 text-sm sm:text-base text-white/80">
            Residential cleaning in Spokane, WA
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-block px-8 py-3.5 rounded-full text-white font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors text-sm sm:text-base"
          >
            Get a Free Estimate
          </Link>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section className="bg-[var(--color-warm-bg)] py-8 sm:py-10">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 text-center">
          <div>
            <p className="text-2xl font-serif text-[var(--color-primary)]">10+</p>
            <p className="text-xs uppercase tracking-wider text-[var(--color-muted)] mt-1">
              Years of Experience
            </p>
          </div>
          <div className="hidden sm:block w-px h-10 bg-gray-300" />
          <div>
            <p className="text-2xl font-serif text-[var(--color-primary)]">Spokane</p>
            <p className="text-xs uppercase tracking-wider text-[var(--color-muted)] mt-1">
              Owned &amp; Operated
            </p>
          </div>
          <div className="hidden sm:block w-px h-10 bg-gray-300" />
          <div>
            <p className="text-2xl font-serif text-[var(--color-primary)]">Word of Mouth</p>
            <p className="text-xs uppercase tracking-wider text-[var(--color-muted)] mt-1">
              Built by Referrals Since 2016
            </p>
          </div>
        </div>
      </section>

      {/* ── The clean. Difference ── */}
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs uppercase tracking-widest text-[var(--color-primary)] font-medium text-center">
            Why clean.
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-serif text-center">
            The clean. Difference
          </h2>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                title: 'flexible.',
                desc: "Your home, your priorities. We customize every clean to what matters most to you — not a one-size-fits-all checklist.",
              },
              {
                title: 'stress-free.',
                desc: "The same person every time — the owner herself. You always know who's in your home, and you can trust them with a key.",
              },
              {
                title: 'family.',
                desc: 'We treat every client like family. Julie has built her business on real relationships, not transactions.',
              },
            ].map((item) => (
              <div key={item.title} className="text-center sm:text-left">
                <h3 className="text-xl font-serif text-[var(--color-primary)]">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/contact"
              className="inline-block px-8 py-3.5 rounded-full text-white font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors text-sm"
            >
              Get a Free Estimate
            </Link>
          </div>
        </div>
      </section>

      {/* ── Meet Julie ── */}
      <section className="bg-[var(--color-warm-bg)] py-16 sm:py-24 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="relative w-full max-w-sm aspect-[4/5] rounded-2xl overflow-hidden mx-auto md:mx-0">
            <Image
              src="/photos/real/clean_julie.png"
              alt="Julie Cobb, owner of clean."
              fill
              sizes="(max-width: 768px) 100vw, 384px"
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--color-primary)] font-medium">
              Meet Julie
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-serif">
              It&apos;s Always Julie
            </h2>
            <p className="mt-6 text-[var(--color-muted)] leading-relaxed">
              A clean home changes how you feel when you walk through the door.
              Julie knows that firsthand — and after 10 years of building her
              business one referral at a time, she still cleans every home
              herself.
            </p>
            <p className="mt-4 text-sm font-semibold">
              Julie Cobb{' '}
              <span className="font-normal text-[var(--color-muted)]">
                / Owner, clean.
              </span>
            </p>
            <Link
              href="/about"
              className="mt-6 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              Read Julie&apos;s story &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ── Services Preview ── */}
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs uppercase tracking-widest text-[var(--color-primary)] font-medium text-center">
            Services
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-serif text-center">
            What We Offer
          </h2>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                title: 'Recurring Cleaning',
                desc: 'Weekly or bi-weekly visits tailored to your home. Consistent, reliable, and always the same friendly face.',
                img: '/photos/real/clean_experienced.webp',
                alt: 'Clean modern living room with fireplace',
              },
              {
                title: 'Move-Out / Move-In',
                desc: "Getting ready to list, sell, or settle into a new place? We'll make sure it shines.",
                img: '/photos/real/clean.-hero.webp',
                alt: 'Sparkling clean bathroom',
              },
              {
                title: 'Deep Clean Projects',
                desc: 'A thorough top-to-bottom clean to reset your space. Perfect as a first step before recurring service.',
                img: '/photos/real/clean_scheduled.png',
                alt: 'Stylish reading nook with accent wall',
              },
            ].map((service) => (
              <Link
                key={service.title}
                href="/services"
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="relative h-48 sm:h-56">
                  <Image
                    src={service.img}
                    alt={service.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-5 sm:p-6 flex flex-col flex-1">
                  <h3 className="text-lg font-semibold">{service.title}</h3>
                  <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed flex-1">
                    {service.desc}
                  </p>
                  <p className="mt-3 text-sm font-medium text-[var(--color-primary)] group-hover:underline">
                    Learn more &rarr;
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
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
              },
              {
                step: '02',
                title: 'Chat with Julie',
                desc: "We'll discuss your home, your needs, and your schedule.",
              },
              {
                step: '03',
                title: 'Initial Deep Clean',
                desc: 'Your first visit gets everything sparkling from top to bottom.',
              },
              {
                step: '04',
                title: 'Ongoing Service',
                desc: 'Sit back and enjoy a consistently clean home, every visit.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex gap-5 py-5 border-b border-gray-200 last:border-b-0"
              >
                <span className="text-2xl font-serif text-[var(--color-primary)] shrink-0 w-10">
                  {item.step}
                </span>
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/contact"
              className="inline-block px-8 py-3.5 rounded-full text-white font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors text-sm"
            >
              Get Started Today
            </Link>
          </div>
        </div>
      </section>

      {/* ── Service Area ── */}
      <section className="py-16 sm:py-20 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-serif">
            Proudly Serving Spokane
          </h2>
          <p className="mt-4 text-[var(--color-muted)] leading-relaxed">
            We provide residential cleaning services throughout the greater
            Spokane area, including Deer Park, Spokane Valley, North Spokane,
            South Hill, Suncrest, Colbert, and Millwood.
          </p>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="bg-[var(--color-primary)] py-16 sm:py-20 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-serif text-white">
            Ready for a Cleaner Home?
          </h2>
          <p className="mt-4 text-white/80">
            Get a free, no-obligation estimate. We&apos;ll get back to you
            within 24 hours.
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

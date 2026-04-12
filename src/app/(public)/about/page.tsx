import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About',
  description:
    "Meet Julie Cobb, the owner of clean. — a family-owned residential cleaning service in Spokane, WA with over 10 years of experience.",
}

export default function AboutPage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="bg-[var(--color-foreground)] py-16 sm:py-24 px-4 text-center">
        <p className="text-xs uppercase tracking-widest text-[var(--color-primary)] font-medium">
          Our Story
        </p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-serif text-white">
          The clean. Story
        </h1>
      </section>

      {/* ── Julie Intro ── */}
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="relative w-full max-w-md aspect-[4/5] rounded-2xl overflow-hidden mx-auto md:mx-0">
            <Image
              src="/photos/real/clean_julie.png"
              alt="Julie Cobb, owner of clean."
              fill
              className="object-cover"
              priority
            />
          </div>
          <div>
            <blockquote className="text-lg sm:text-xl leading-relaxed text-[var(--color-foreground)]">
              &ldquo;I&apos;m so thankful for the opportunity I get to bless my
              clients each and every day with the gift of a clean home. As
              someone who&apos;s battled mental health issues, I know how
              impactful a dirty space can be, and I&apos;m grateful that I get
              to make the lives of my clients that much better.&rdquo;
            </blockquote>
            <div className="mt-6 flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full overflow-hidden">
                <Image
                  src="/photos/real/clean_julie.png"
                  alt="Julie Cobb"
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <p className="text-sm font-semibold">Julie Cobb</p>
                <p className="text-xs text-[var(--color-muted)]">
                  Owner, clean.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Julie's Background ── */}
      <section className="bg-[var(--color-warm-bg)] py-16 sm:py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-serif text-center">
            Julie&apos;s Background
          </h2>
          <div className="mt-8 space-y-5 text-[var(--color-muted)] leading-relaxed">
            <p>
              As a teenager, Julie learned the ropes from her parents cleaning
              commercial businesses to help pay for her private school
              education. This instilled a great work ethic and taught her the
              skills she would need.
            </p>
            <p>
              Fast forward 10 years, and Julie was a new mom who wanted to get
              out of the house more, and so she started with one client (thanks
              Sharon!), and built her business solely by word of mouth.
            </p>
            <p>
              After 10 years of hard work, Julie has built a passionate client
              base and a reputation for being the best in the business. She
              loves giving the gift of &ldquo;clean.&rdquo; As a mom of two
              kids with a busy life, she knows how amazing it is to be able to
              walk into a home and feel the sense of peace that comes from a
              clean house.
            </p>
          </div>
        </div>
      </section>

      {/* ── Family Photos ── */}
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-serif text-center mb-10">
            The Cobb Family
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {[
              {
                src: '/photos/real/family-1.jpeg',
                alt: 'The Cobb family with their dog',
              },
              {
                src: '/photos/real/family2-Large.jpeg',
                alt: 'The Cobb family outdoors',
              },
              {
                src: '/photos/real/IMG_1896-Large.jpeg',
                alt: 'Julie and Daniel at sunset',
              },
              {
                src: '/photos/real/family4.jpeg',
                alt: 'Julie and daughter',
              },
            ].map((photo) => (
              <div
                key={photo.src}
                className="relative aspect-square rounded-xl overflow-hidden"
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Experience Stats ── */}
      <section className="bg-[var(--color-warm-bg)] py-16 sm:py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-serif text-center">
            Julie&apos;s Experience
          </h2>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-4xl font-serif text-[var(--color-primary)]">
                10+
              </p>
              <p className="mt-2 text-sm font-semibold">Years of Experience</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Over the last 10 years, Julie has built an incredible
                reputation for excellence.
              </p>
            </div>
            <div>
              <p className="text-4xl font-serif text-[var(--color-primary)]">
                50+
              </p>
              <p className="mt-2 text-sm font-semibold">Satisfied Clients</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Julie&apos;s ability to build an enthusiastic client base has
                been a huge key to her success.
              </p>
            </div>
            <div>
              <p className="text-4xl font-serif text-[var(--color-primary)]">
                5,000+
              </p>
              <p className="mt-2 text-sm font-semibold">Cleaned Toilets</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                And kitchen sinks. And beds made. But the toilets are really
                what stick out. That&apos;s a lot of toilets.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-[var(--color-primary)] py-16 sm:py-20 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-serif text-white">
            Let&apos;s Chat
          </h2>
          <p className="mt-4 text-white/80">
            Ready to experience the clean. difference? Get your free estimate
            today.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-block px-8 py-3.5 rounded-full font-semibold bg-white text-[var(--color-primary)] hover:bg-gray-100 transition-colors text-sm sm:text-base"
            >
              Get a Free Estimate
            </Link>
            <a
              href="sms:+15097208067"
              className="inline-block px-8 py-3.5 rounded-full font-semibold border-2 border-white text-white hover:bg-white/10 transition-colors text-sm sm:text-base"
            >
              Text Us: (509) 720-8067
            </a>
          </div>
        </div>
      </section>
    </>
  )
}

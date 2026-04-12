import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-[var(--color-foreground)] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            <p className="font-serif text-2xl tracking-tight">clean.</p>
            <p className="mt-2 text-sm text-gray-400">
              A local, family-owned residential cleaning service based in Spokane, WA.
            </p>
          </div>

          {/* Links */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
              Quick Links
            </p>
            <ul className="space-y-2.5">
              {[
                { href: '/services', label: 'Services' },
                { href: '/about', label: 'About' },
                { href: '/contact', label: 'Get a Free Estimate' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-300 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
              Contact
            </p>
            <ul className="space-y-2.5 text-sm text-gray-300">
              <li>
                <a href="sms:+15097208067" className="hover:text-white transition-colors">
                  Call or text: (509) 720-8067
                </a>
              </li>
              <li>
                <a href="mailto:info@spokane-clean.com" className="hover:text-white transition-colors">
                  info@spokane-clean.com
                </a>
              </li>
              <li>Spokane, WA</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} clean. All rights reserved.
        </div>
      </div>
    </footer>
  )
}

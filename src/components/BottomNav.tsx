'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { navItems } from './nav-items'

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40">
      <div className="flex pb-8">
        {navItems.map(({ label, href, Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={label}
              href={href}
              className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors min-h-[56px] justify-center"
              style={{ color: active ? '#2C5F8A' : '#9CA3AF' }}
            >
              <Icon />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

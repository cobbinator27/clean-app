import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold tracking-tight" style={{ color: '#2C5F8A' }}>
          clean.
        </h1>
        <p className="mt-2 text-gray-500 text-sm uppercase tracking-widest font-medium">
          Business Management
        </p>
        <p className="mt-6 text-gray-600 text-sm max-w-xs">
          Run your residential cleaning business from anywhere.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block px-6 py-3 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#2C5F8A' }}
        >
          Sign In
        </Link>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState('')
  const [message, setMessage] = useState('')

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(tab)

    if (tab === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setMessage('Check your email for a confirmation link.')
      }
    }

    setLoading('')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1
            className="text-5xl font-bold tracking-tight"
            style={{ color: '#2C5F8A' }}
          >
            clean.
          </h1>
          <p className="mt-1 text-sm font-medium text-gray-500 uppercase tracking-widest">
            Business Management
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Tab toggle */}
          <div className="flex border-b border-gray-100">
            <button
              type="button"
              onClick={() => { setTab('signin'); setError(''); setMessage('') }}
              className="flex-1 py-3.5 text-sm font-medium transition-colors"
              style={
                tab === 'signin'
                  ? { color: '#2C5F8A', borderBottom: '2px solid #2C5F8A', marginBottom: '-1px' }
                  : { color: '#9CA3AF' }
              }
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setTab('signup'); setError(''); setMessage('') }}
              className="flex-1 py-3.5 text-sm font-medium transition-colors"
              style={
                tab === 'signup'
                  ? { color: '#2C5F8A', borderBottom: '2px solid #2C5F8A', marginBottom: '-1px' }
                  : { color: '#9CA3AF' }
              }
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
                style={{ '--tw-ring-color': '#2C5F8A' } as React.CSSProperties}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            {message && (
              <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{message}</p>
            )}

            <button
              type="submit"
              disabled={!!loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ backgroundColor: '#2C5F8A' }}
            >
              {loading
                ? 'Please wait…'
                : tab === 'signin'
                ? 'Sign In'
                : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

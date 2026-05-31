import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthPanel } from './components/AuthPanel'
import { Dashboard } from './components/Dashboard'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Landing } from './components/Landing'
import { normalizeInviteToken } from './lib/clientPortalWorkflow'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import './App.css'

function AppContent() {
  const [session, setSession] = useState<Session | null>(null)
  const [booting, setBooting] = useState(true)
  const inviteToken = normalizeInviteToken(window.location.href)

  useEffect(() => {
    if (!supabase) {
      queueMicrotask(() => setBooting(false))
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setBooting(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) {
    return <main className="page"><div className="error-box">Supabase environment is not configured.</div></main>
  }

  return (
    <main className="page">
      <Landing session={session} />
      {booting ? <section className="auth-card">Checking session…</section> : session ? <Dashboard session={session} inviteToken={inviteToken} /> : <AuthPanel inviteToken={inviteToken} />}
    </main>
  )
}

export default function App() {
  return <ErrorBoundary><AppContent /></ErrorBoundary>
}

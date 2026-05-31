import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, LockKeyhole } from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { getAuthRedirectUrl as resolveAuthRedirectUrl } from '../lib/clientPortalWorkflow'
import { toSafeErrorMessage } from '../lib/clientflowApi'
import { supabase } from '../lib/supabase'

gsap.registerPlugin(ScrollTrigger)

function getAuthRedirectUrl() {
  return resolveAuthRedirectUrl(window.location.href, import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined)
}

export function AuthPanel({ inviteToken }: { inviteToken: string | null }) {
  const panelRef = useRef<HTMLElement | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!panelRef.current) return
    gsap.fromTo(panelRef.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: panelRef.current, start: 'top 82%' } })
  }, [])

  async function signIn(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setLoading(true)
    setStatus(null)
    const redirectUrl = new URL(getAuthRedirectUrl())
    if (inviteToken) redirectUrl.searchParams.set('invite', inviteToken)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectUrl.toString(),
        data: { full_name: name.trim() || email.split('@')[0] },
      },
    })
    setLoading(false)
    setStatus(error ? toSafeErrorMessage(error) : inviteToken ? 'Check your inbox. The magic link will attach you to the invited client portal.' : 'Check your inbox for the magic link. This keeps the MVP passwordless and zero-cost.')
  }

  return (
    <section className="auth-card" id="app" ref={panelRef}>
      <div>
        <p className="eyebrow"><LockKeyhole size={16} /> {inviteToken ? 'Client invite access' : 'Founder beta access'}</p>
        <h2>{inviteToken ? 'Open your invited client portal.' : 'Start with one clean client portal.'}</h2>
        <p>{inviteToken ? 'Sign in with your email to accept the invite, review milestones, approve work, and track invoice status.' : 'Use magic-link login, create a project, track milestones, approvals, tasks, and payment status from one polished dashboard.'}</p>
      </div>
      <form onSubmit={signIn}>
        <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Afu Studio" maxLength={120} /></label>
        <label>Work email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" /></label>
        <button disabled={loading}>{loading ? 'Sending magic link…' : 'Send magic link'} <ArrowRight size={18} /></button>
        {status && <p className="form-status">{status}</p>}
      </form>
    </section>
  )
}

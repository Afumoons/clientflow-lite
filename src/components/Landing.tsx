import { useEffect, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowRight, Grid3X3, Mail, Search, Sparkles } from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const publicAssetBase = import.meta.env.BASE_URL
const clientflowIconUrl = `${publicAssetBase}clientflow-icon.png`

export function Landing({ session }: { session: Session | null }) {
  const heroRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.topbar', { y: -18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' })
      gsap.fromTo('.hero-copy > *', { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.08, ease: 'power3.out', delay: 0.12 })
      gsap.fromTo('.product-card', { y: 44, rotate: -2, opacity: 0, scale: 0.96 }, { y: 0, rotate: 1.25, opacity: 1, scale: 1, duration: 1, ease: 'expo.out', delay: 0.2 })
      gsap.to('.product-card', { y: -18, rotate: -0.25, scrollTrigger: { trigger: '.hero-shell', start: 'top top', end: 'bottom top', scrub: 1 } })
      gsap.fromTo('.feature-grid article, .price-card', { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: '#features', start: 'top 72%' } })
    }, heroRef)
    return () => ctx.revert()
  }, [])

  return (
    <>
      <section className="hero-shell" ref={heroRef}>
        <div className="ambient-orb one" /><div className="ambient-orb two" />
        <nav className="topbar">
          <a className="brand" href="#top"><span><img src={clientflowIconUrl} alt="" /></span><strong>ClientFlow</strong><small>Lite</small></a>
          <div><a href="#features">Features</a><a href="#pricing">Pricing</a><a className="nav-cta" href={session ? '#dashboard' : '#app'}>{session ? 'Open dashboard' : 'Join beta'}</a></div>
        </nav>
        <div className="hero-grid" id="top">
          <div className="hero-copy">
            <p className="eyebrow"><Sparkles size={16} /> Client ops for solo devs</p>
            <h1>Run every client sprint like a polished workspace.</h1>
            <p className="hero-lede">ClientFlow Lite turns messy freelance delivery into a shared base: projects as records, milestones as fields, approvals as status chips, and payments visible without enterprise bloat.</p>
            <div className="hero-actions"><a className="primary" href={session ? '#dashboard' : '#app'}>{session ? 'Go to dashboard' : 'Create free beta portal'} <ArrowRight size={18} /></a><a className="secondary" href="#features">See what it replaces</a></div>
            <div className="proof-row"><span>Grid-first UX</span><span>Vercel + Supabase</span><span>Freelancer-friendly portal</span></div>
          </div>
          <div className="product-card workspace-preview" aria-label="Client portal preview">
            <div className="preview-toolbar"><div className="base-icon"><img src={clientflowIconUrl} alt="" /></div><div><p className="mini-label">Client base</p><h3>Website Redesign Sprint</h3></div><button><Search size={15} /> Filter</button></div>
            <div className="view-tabs"><span className="active"><Grid3X3 size={14} /> Grid</span><span>Kanban</span><span>Timeline</span></div>
            <div className="workspace-grid"><div className="grid-head">Milestone</div><div className="grid-head">Owner</div><div className="grid-head">Status</div><div className="grid-head">Value</div><div>Homepage approved</div><div>Afu Studio</div><div><b className="chip green">Done</b></div><div>$800</div><div>Checkout QA</div><div>Client</div><div><b className="chip amber">Review</b></div><div>$450</div><div>Invoice #02</div><div>Finance</div><div><b className="chip blue">Sent</b></div><div>$500</div></div>
            <div className="client-note">“Everything I need is in one link. No more hunting through Slack.”</div>
          </div>
        </div>
      </section>
      <section className="section floating-section" id="features"><p className="eyebrow">What it replaces</p><h2>One lightweight command center for the messy middle of client work.</h2><div className="feature-grid">{[['Scope clarity', 'Turn a vague project into visible milestones and tasks clients can understand.'], ['Approval trail', 'Capture pending, approved, and revision-requested states before scope creep gets expensive.'], ['Payment visibility', 'Track manual invoice/payment status without needing Stripe on day one.'], ['Client confidence', 'Give every client a premium portal link instead of another chaotic message thread.']].map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></section>
      <section className="section pricing" id="pricing"><div><p className="eyebrow">Beta offer</p><h2>Free while we shape the product with real freelancers.</h2></div><div className="price-card"><p>Founder Beta</p><h3>$0</h3><ul><li>1 workspace</li><li>Unlimited beta projects during validation</li><li>Manual payment tracking</li><li>Future export-first policy</li></ul></div></section>
      <footer><span>ClientFlow Lite · built for freelance developers worldwide</span><a href="mailto:afumoons@gmail.com"><Mail size={16} /> Contact founder</a></footer>
    </>
  )
}

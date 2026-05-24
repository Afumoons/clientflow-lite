import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Copy, DoorOpen, Grid3X3, Link2, LockKeyhole, Mail, Plus, Search, ShieldCheck, Sparkles, Table2, Users2, XCircle } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { buildInviteUrl, canManageProjectData, createInviteToken, getAuthRedirectUrl as resolveAuthRedirectUrl, isClientMember, normalizeInviteToken, sha256Hex } from './lib/clientPortalWorkflow'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Approval, Invoice, Milestone, Project, ProjectInvite, Task, Workspace, WorkspaceMember, WorkspaceRole } from './types'
import './App.css'

gsap.registerPlugin(ScrollTrigger)

const projectStatuses: Project['status'][] = ['proposal', 'active', 'review', 'completed', 'paused']
const taskStatuses: Task['status'][] = ['todo', 'doing', 'blocked', 'done']

type AppData = {
  workspace: Workspace | null
  memberships: WorkspaceMember[]
  projects: Project[]
  milestones: Milestone[]
  tasks: Task[]
  approvals: Approval[]
  invoices: Invoice[]
  invites: ProjectInvite[]
}

const emptyData: AppData = {
  workspace: null,
  memberships: [],
  projects: [],
  milestones: [],
  tasks: [],
  approvals: [],
  invoices: [],
  invites: [],
}

const publicAssetBase = import.meta.env.BASE_URL
const clientflowIconUrl = `${publicAssetBase}clientflow-icon.png`

function getAuthRedirectUrl() {
  return resolveAuthRedirectUrl(window.location.href, import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined)
}

function currency(amount: number | null | undefined, code = 'USD') {
  if (!amount) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(amount)
}

function AuthPanel({ inviteToken }: { inviteToken: string | null }) {
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
      email,
      options: {
        emailRedirectTo: redirectUrl.toString(),
        data: { full_name: name || email.split('@')[0] },
      },
    })
    setLoading(false)
    setStatus(error ? error.message : inviteToken ? 'Check your inbox. The magic link will attach you to the invited client portal.' : 'Check your inbox for the magic link. This keeps the MVP passwordless and zero-cost.')
  }

  return (
    <section className="auth-card" id="app" ref={panelRef}>
      <div>
        <p className="eyebrow"><LockKeyhole size={16} /> {inviteToken ? 'Client invite access' : 'Founder beta access'}</p>
        <h2>{inviteToken ? 'Open your invited client portal.' : 'Start with one clean client portal.'}</h2>
        <p>{inviteToken ? 'Sign in with your email to accept the invite, review milestones, approve work, and track invoice status.' : 'Use magic-link login, create a project, track milestones, approvals, tasks, and payment status from one polished dashboard.'}</p>
      </div>
      <form onSubmit={signIn}>
        <label>
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Afu Studio" />
        </label>
        <label>
          Work email
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" />
        </label>
        <button disabled={loading}>{loading ? 'Sending magic link…' : 'Send magic link'} <ArrowRight size={18} /></button>
        {status && <p className="form-status">{status}</p>}
      </form>
    </section>
  )
}

function Landing({ session }: { session: Session | null }) {
  const heroRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.topbar', { y: -18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' })
      gsap.fromTo('.hero-copy > *', { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.08, ease: 'power3.out', delay: 0.12 })
      gsap.fromTo('.product-card', { y: 44, rotate: -2, opacity: 0, scale: 0.96 }, { y: 0, rotate: 1.25, opacity: 1, scale: 1, duration: 1, ease: 'expo.out', delay: 0.2 })
      gsap.to('.product-card', { y: -18, rotate: -0.25, scrollTrigger: { trigger: '.hero-shell', start: 'top top', end: 'bottom top', scrub: 1 } })
      gsap.fromTo('.feature-grid article, .price-card', { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: '#features', start: 'top 72%' } })
      gsap.to('.ambient-orb.one', { x: 80, y: -30, scrollTrigger: { trigger: '.hero-shell', start: 'top top', end: 'bottom top', scrub: 1.2 } })
      gsap.to('.ambient-orb.two', { x: -70, y: 48, scrollTrigger: { trigger: '.hero-shell', start: 'top top', end: 'bottom top', scrub: 1.2 } })
    }, heroRef)
    return () => ctx.revert()
  }, [])

  return (
    <>
      <section className="hero-shell" ref={heroRef}>
        <div className="ambient-orb one" />
        <div className="ambient-orb two" />
        <nav className="topbar">
          <a className="brand" href="#top"><span><img src={clientflowIconUrl} alt="" /></span><strong>ClientFlow</strong><small>Lite</small></a>
          <div>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a className="nav-cta" href={session ? '#dashboard' : '#app'}>{session ? 'Open dashboard' : 'Join beta'}</a>
          </div>
        </nav>
        <div className="hero-grid" id="top">
          <div className="hero-copy">
            <p className="eyebrow"><Sparkles size={16} /> Client ops for solo devs</p>
            <h1>Run every client sprint like a polished workspace.</h1>
            <p className="hero-lede">ClientFlow Lite turns messy freelance delivery into a shared base: projects as records, milestones as fields, approvals as status chips, and payments visible without enterprise bloat.</p>
            <div className="hero-actions">
              <a className="primary" href={session ? '#dashboard' : '#app'}>{session ? 'Go to dashboard' : 'Create free beta portal'} <ArrowRight size={18} /></a>
              <a className="secondary" href="#features">See what it replaces</a>
            </div>
            <div className="proof-row">
              <span>Grid-first UX</span>
              <span>Vercel + Supabase</span>
              <span>Freelancer-friendly portal</span>
            </div>
          </div>
          <div className="product-card workspace-preview" aria-label="Client portal preview">
            <div className="preview-toolbar">
              <div className="base-icon"><img src={clientflowIconUrl} alt="" /></div>
              <div><p className="mini-label">Client base</p><h3>Website Redesign Sprint</h3></div>
              <button><Search size={15} /> Filter</button>
            </div>
            <div className="view-tabs"><span className="active"><Grid3X3 size={14} /> Grid</span><span>Kanban</span><span>Timeline</span></div>
            <div className="workspace-grid">
              <div className="grid-head">Milestone</div><div className="grid-head">Owner</div><div className="grid-head">Status</div><div className="grid-head">Value</div>
              <div>Homepage approved</div><div>Afu Studio</div><div><b className="chip green">Done</b></div><div>$800</div>
              <div>Checkout QA</div><div>Client</div><div><b className="chip amber">Review</b></div><div>$450</div>
              <div>Invoice #02</div><div>Finance</div><div><b className="chip blue">Sent</b></div><div>$500</div>
            </div>
            <div className="client-note">“Everything I need is in one link. No more hunting through Slack.”</div>
          </div>
        </div>
      </section>

      <section className="section floating-section" id="features">
        <p className="eyebrow">What it replaces</p>
        <h2>One lightweight command center for the messy middle of client work.</h2>
        <div className="feature-grid">
          {[
            ['Scope clarity', 'Turn a vague project into visible milestones and tasks clients can understand.'],
            ['Approval trail', 'Capture pending, approved, and revision-requested states before scope creep gets expensive.'],
            ['Payment visibility', 'Track manual invoice/payment status without needing Stripe on day one.'],
            ['Client confidence', 'Give every client a premium portal link instead of another chaotic message thread.'],
          ].map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}
        </div>
      </section>

      <section className="section pricing" id="pricing">
        <div>
          <p className="eyebrow">Beta offer</p>
          <h2>Free while we shape the product with real freelancers.</h2>
        </div>
        <div className="price-card">
          <p>Founder Beta</p>
          <h3>$0</h3>
          <ul>
            <li>1 workspace</li>
            <li>Unlimited beta projects during validation</li>
            <li>Manual payment tracking</li>
            <li>Future export-first policy</li>
          </ul>
        </div>
      </section>
    </>
  )
}

function Dashboard({ session, inviteToken }: { session: Session, inviteToken: string | null }) {
  const dashboardRef = useRef<HTMLElement | null>(null)
  const [data, setData] = useState<AppData>(emptyData)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteStatus, setInviteStatus] = useState<string | null>(null)
  const [acceptingInvite, setAcceptingInvite] = useState(false)

  const selectedProject = useMemo(
    () => data.projects.find((project) => project.id === selectedProjectId) ?? data.projects[0] ?? null,
    [data.projects, selectedProjectId],
  )
  const membershipByWorkspace = useMemo(() => new Map(data.memberships.map((membership) => [membership.workspace_id, membership])), [data.memberships])
  const selectedMembership = selectedProject ? membershipByWorkspace.get(selectedProject.workspace_id) : null
  const selectedWorkspaceValue = selectedMembership?.workspaces
  const selectedWorkspace = (Array.isArray(selectedWorkspaceValue) ? selectedWorkspaceValue[0] : selectedWorkspaceValue) ?? data.workspace
  const selectedRole = selectedMembership?.role ?? null
  const canManageSelectedProject = canManageProjectData(selectedRole)
  const isSelectedClient = isClientMember(selectedRole)

  const projectMilestones = data.milestones.filter((item) => item.project_id === selectedProject?.id)
  const projectTasks = data.tasks.filter((item) => item.project_id === selectedProject?.id)
  const projectApprovals = data.approvals.filter((item) => item.project_id === selectedProject?.id)
  const projectInvoices = data.invoices.filter((item) => item.project_id === selectedProject?.id)
  const approvedCount = projectApprovals.filter((item) => item.status === 'approved').length
  const doneTaskCount = projectTasks.filter((item) => item.status === 'done').length

  async function loadData(preferredProjectId?: string) {
    if (!supabase) return
    setLoading(true)
    setError(null)
    const { data: membershipRows, error: memberError } = await supabase
      .from('workspace_members')
      .select('workspace_id, user_id, role, workspaces(*)')
      .eq('user_id', session.user.id)

    if (memberError) {
      setError(memberError.message)
      setLoading(false)
      return
    }

    const memberships = (membershipRows ?? []) as unknown as WorkspaceMember[]
    const primaryMembership = memberships.find((membership) => canManageProjectData(membership.role)) ?? memberships[0] ?? null
    const workspaceValue = primaryMembership?.workspaces
    const workspace = (Array.isArray(workspaceValue) ? workspaceValue[0] : workspaceValue) ?? null

    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (projectsError) {
      setError(projectsError.message)
      setLoading(false)
      return
    }

    const projectRows = (projects ?? []) as Project[]
    const projectIds = projectRows.map((project) => project.id)
    const emptyChildren = { data: [] }
    const [{ data: milestones }, { data: tasks }, { data: approvals }, { data: invoices }, { data: invites }] = projectIds.length ? await Promise.all([
      supabase.from('milestones').select('*').in('project_id', projectIds).order('sort_order', { ascending: true }),
      supabase.from('tasks').select('*').in('project_id', projectIds).order('created_at', { ascending: true }),
      supabase.from('approvals').select('*').in('project_id', projectIds).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').in('project_id', projectIds).order('created_at', { ascending: false }),
      supabase.from('project_invites').select('*').in('project_id', projectIds).order('created_at', { ascending: false }),
    ]) : [emptyChildren, emptyChildren, emptyChildren, emptyChildren, emptyChildren]

    setData({
      workspace,
      memberships,
      projects: projectRows,
      milestones: (milestones ?? []) as Milestone[],
      tasks: (tasks ?? []) as Task[],
      approvals: (approvals ?? []) as Approval[],
      invoices: (invoices ?? []) as Invoice[],
      invites: (invites ?? []) as ProjectInvite[],
    })
    setSelectedProjectId((current) => preferredProjectId ?? current ?? projectRows[0]?.id ?? null)
    setLoading(false)
  }

  async function acceptInviteIfPresent() {
    if (!supabase || !inviteToken || acceptingInvite) return false
    setAcceptingInvite(true)
    setError(null)
    const { data: project, error: inviteError } = await supabase.rpc('accept_project_invite', { p_invite_token: inviteToken })
    setAcceptingInvite(false)
    if (inviteError) {
      setError(inviteError.message)
      return false
    }
    const acceptedProject = project as Project | null
    setInviteStatus('Invite accepted. Your client portal is now attached to this account.')
    window.history.replaceState({}, document.title, window.location.pathname)
    await loadData(acceptedProject?.id)
    return true
  }

  useEffect(() => {
    void Promise.resolve().then(async () => {
      const accepted = await acceptInviteIfPresent()
      if (!accepted) await loadData()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (loading || !dashboardRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.dash-top, .sidebar-panel, .workspace-panel', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.08, ease: 'power3.out' })
      gsap.fromTo('.metric-grid article, .board-card', { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.05, ease: 'power2.out', delay: 0.12 })
    }, dashboardRef)
    return () => ctx.revert()
  }, [loading, selectedProjectId, data.projects.length])

  async function createProject(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !data.workspace || !projectName.trim()) return
    setSaving(true)
    setError(null)
    const { data: project, error: projectError } = await supabase.rpc('create_project_with_seed_data', {
      p_workspace_id: data.workspace.id,
      p_project_name: projectName,
      p_client_name: clientName || 'Client',
      p_client_email: clientEmail || null,
      p_currency: 'USD',
    })

    if (projectError || !project) {
      setError(projectError?.message ?? 'Could not create project')
      setSaving(false)
      return
    }

    const createdProject = project as Project
    setProjectName('')
    setClientName('')
    setClientEmail('')
    setSelectedProjectId(createdProject.id)
    setSaving(false)
    await loadData(createdProject.id)
  }

  async function updateProjectStatus(project: Project, status: Project['status']) {
    if (!supabase || !canManageProjectData(membershipByWorkspace.get(project.workspace_id)?.role)) return
    await supabase.from('projects').update({ status }).eq('id', project.id)
    await loadData(project.id)
  }

  async function createClientInvite(project: Project) {
    if (!supabase || !canManageSelectedProject) return
    setSaving(true)
    setInviteStatus(null)
    setInviteUrl(null)
    const token = createInviteToken()
    const tokenHash = await sha256Hex(token)
    const { error: inviteError } = await supabase.from('project_invites').insert({
      project_id: project.id,
      invited_email: project.client_email,
      token_hash: tokenHash,
    })
    setSaving(false)
    if (inviteError) {
      setError(inviteError.message)
      return
    }
    const url = buildInviteUrl(window.location.origin, token)
    setInviteUrl(url)
    setInviteStatus('Invite link created. Copy it now — only the hashed token is stored.')
    await loadData(project.id)
  }

  async function copyInviteUrl() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setInviteStatus('Invite link copied to clipboard.')
  }

  async function decideApproval(approval: Approval, status: Approval['status']) {
    if (!supabase || !selectedProject) return
    const { error: approvalError } = await supabase.rpc('submit_approval_decision', {
      p_approval_id: approval.id,
      p_status: status,
      p_note: null,
    })
    if (approvalError) {
      setError(approvalError.message)
      return
    }
    await loadData(selectedProject.id)
  }

  async function signOut() {
    await supabase?.auth.signOut()
    window.location.reload()
  }

  if (loading) return <section className="dashboard loading"><div className="pulse" /> Loading your portal…</section>

  return (
    <section className="dashboard" id="dashboard" ref={dashboardRef}>
      <div className="dash-top">
        <div>
          <p className="eyebrow"><Table2 size={16} /> {isSelectedClient ? 'Client portal' : 'Founder beta workspace'}</p>
          <h2>{selectedWorkspace?.studio_name || selectedWorkspace?.name || 'Your studio'} workspace</h2>
          <p>Signed in as {session.user.email}. {isSelectedClient ? 'Client-safe view: approvals, milestones, tasks, and invoices without internal edit access.' : 'A dense, readable command center for scope, approvals, tasks, client invites, and manual invoices.'}</p>
        </div>
        <button className="ghost" onClick={signOut}><DoorOpen size={18} /> Sign out</button>
      </div>

      {error && <div className="error-box">{error}</div>}
      {inviteStatus && <div className="success-box"><ShieldCheck size={18} /> {inviteStatus}</div>}
      {acceptingInvite && <div className="share-strip"><ShieldCheck size={18} /> Accepting invite and attaching your client portal…</div>}

      <div className="dash-grid">
        <aside className="sidebar-panel app-sidebar">
          {canManageProjectData((data.memberships.find((membership) => data.workspace?.id === membership.workspace_id)?.role ?? null) as WorkspaceRole | null) && (
            <>
              <h3>Create project</h3>
              <form onSubmit={createProject} className="compact-form">
                <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name" />
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" />
                <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="Client email for invite" type="email" />
                <button disabled={saving || !projectName.trim()}><Plus size={16} /> {saving ? 'Creating…' : 'Create portal'}</button>
              </form>
            </>
          )}
          <h3>Projects</h3>
          <div className="project-list">
            {data.projects.map((project) => (
              <button key={project.id} className={project.id === selectedProject?.id ? 'active' : ''} onClick={() => setSelectedProjectId(project.id)}>
                <strong>{project.name}</strong>
                <span>{project.client_name} · {project.status}</span>
              </button>
            ))}
            {!data.projects.length && <p className="empty">No projects yet. Create your first client portal.</p>}
          </div>
        </aside>

        <main className="workspace-panel table-surface">
          {selectedProject ? (
            <>
              <div className="project-header">
                <div>
                  <p className="eyebrow"><Users2 size={16} /> {selectedProject.client_name} · {selectedRole ?? 'viewer'}</p>
                  <h2>{selectedProject.name}</h2>
                </div>
                {canManageSelectedProject ? (
                  <select value={selectedProject.status} onChange={(e) => updateProjectStatus(selectedProject, e.target.value as Project['status'])}>
                    {projectStatuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                ) : <em>{selectedProject.status}</em>}
              </div>

              <div className="metric-grid">
                <article><span>Tasks done</span><strong>{doneTaskCount}/{projectTasks.length}</strong></article>
                <article><span>Approvals</span><strong>{approvedCount}/{projectApprovals.length}</strong></article>
                <article><span>Invoice value</span><strong>{currency(projectInvoices.reduce((sum, item) => sum + Number(item.amount), 0), selectedProject.currency)}</strong></article>
              </div>

              <div className="content-columns">
                <section className="board-card">
                  <h3>Milestones</h3>
                  {projectMilestones.map((item) => <div className="line-item" key={item.id}><span>{item.title}</span><em>{item.status}</em></div>)}
                </section>
                <section className="board-card">
                  <h3>Tasks</h3>
                  {taskStatuses.map((status) => <div key={status} className="task-lane"><strong>{status}</strong>{projectTasks.filter((task) => task.status === status).map((task) => <p key={task.id}>{task.title}</p>)}</div>)}
                </section>
                <section className="board-card">
                  <h3>Approvals</h3>
                  {projectApprovals.map((item) => (
                    <div className="approval-item" key={item.id}>
                      <div className="line-item"><span>{item.title}</span><em>{item.status}</em></div>
                      {isSelectedClient && item.status === 'pending' && (
                        <div className="approval-actions">
                          <button onClick={() => decideApproval(item, 'approved')}><CheckCircle2 size={15} /> Approve</button>
                          <button onClick={() => decideApproval(item, 'revision_requested')}><XCircle size={15} /> Request revision</button>
                        </div>
                      )}
                    </div>
                  ))}
                  <h3>Payments</h3>
                  {projectInvoices.map((item) => <div className="line-item" key={item.id}><span>{item.label}</span><em>{currency(Number(item.amount), item.currency)} · {item.status}</em></div>)}
                </section>
              </div>

              <div className="share-strip">
                <Link2 size={18} />
                {canManageSelectedProject ? (
                  <div className="invite-flow">
                    <strong>Client invite workflow</strong>
                    <span>{data.invites.filter((invite) => invite.project_id === selectedProject.id).length} invite record(s) for this project.</span>
                    <button onClick={() => createClientInvite(selectedProject)} disabled={saving}><Link2 size={15} /> {saving ? 'Creating…' : 'Create secure invite link'}</button>
                    {inviteUrl && <button className="secondary-button" onClick={copyInviteUrl}><Copy size={15} /> Copy invite link</button>}
                    {inviteUrl && <code>{inviteUrl}</code>}
                  </div>
                ) : 'You are viewing the client-safe portal. Internal project edits and membership management are locked.'}
              </div>
            </>
          ) : (
            <div className="empty-state"><h3>Create your first portal</h3><p>Start with a real or demo client project. The app will seed starter milestones, tasks, approval, and payment status.</p></div>
          )}
        </main>
      </div>
    </section>
  )
}

function App() {
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
      <footer>
        <span>ClientFlow Lite · built for freelance developers worldwide</span>
        <a href="mailto:afumoons@gmail.com"><Mail size={16} /> Contact founder</a>
      </footer>
    </main>
  )
}

export default App

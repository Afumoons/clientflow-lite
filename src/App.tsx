import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, CheckCircle2, CircleDollarSign, Clock3, DoorOpen, FolderKanban, Link2, LockKeyhole, Mail, Plus, Sparkles, Users2 } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Approval, Invoice, Milestone, Project, Task, Workspace } from './types'
import './App.css'

const projectStatuses: Project['status'][] = ['proposal', 'active', 'review', 'completed', 'paused']
const taskStatuses: Task['status'][] = ['todo', 'doing', 'blocked', 'done']

type AppData = {
  workspace: Workspace | null
  projects: Project[]
  milestones: Milestone[]
  tasks: Task[]
  approvals: Approval[]
  invoices: Invoice[]
}

const emptyData: AppData = {
  workspace: null,
  projects: [],
  milestones: [],
  tasks: [],
  approvals: [],
  invoices: [],
}

function currency(amount: number | null | undefined, code = 'USD') {
  if (!amount) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(amount)
}

function AuthPanel() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function signIn(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setLoading(true)
    setStatus(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: name || email.split('@')[0] },
      },
    })
    setLoading(false)
    setStatus(error ? error.message : 'Check your inbox for the magic link. This keeps the MVP passwordless and zero-cost.')
  }

  return (
    <section className="auth-card" id="app">
      <div>
        <p className="eyebrow"><LockKeyhole size={16} /> Founder beta access</p>
        <h2>Start with one clean client portal.</h2>
        <p>Use magic-link login, create a project, track milestones, approvals, tasks, and payment status from one polished dashboard.</p>
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
  return (
    <>
      <section className="hero-shell">
        <nav className="topbar">
          <a className="brand" href="#top"><span>CF</span> ClientFlow Lite</a>
          <div>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a className="nav-cta" href={session ? '#dashboard' : '#app'}>{session ? 'Open dashboard' : 'Join beta'}</a>
          </div>
        </nav>
        <div className="hero-grid" id="top">
          <div className="hero-copy">
            <p className="eyebrow"><Sparkles size={16} /> Global client portal for solo devs</p>
            <h1>Stop running client projects from scattered chats.</h1>
            <p className="hero-lede">ClientFlow Lite gives freelance developers and micro-agencies a clean link for milestones, approvals, tasks, and payment status — without adding another bloated project-management tool.</p>
            <div className="hero-actions">
              <a className="primary" href={session ? '#dashboard' : '#app'}>{session ? 'Go to dashboard' : 'Create free beta portal'} <ArrowRight size={18} /></a>
              <a className="secondary" href="#features">See what it replaces</a>
            </div>
            <div className="proof-row">
              <span>Built for $0 stack</span>
              <span>Vercel + Supabase</span>
              <span>Export-friendly MVP</span>
            </div>
          </div>
          <div className="product-card" aria-label="Client portal preview">
            <div className="card-head"><span></span><span></span><span></span></div>
            <p className="mini-label">Project portal</p>
            <h3>Website Redesign Sprint</h3>
            <div className="progress"><span style={{ width: '68%' }} /></div>
            <div className="portal-row"><CheckCircle2 /> Homepage approved <strong>Done</strong></div>
            <div className="portal-row"><Clock3 /> Checkout QA <strong>Review</strong></div>
            <div className="portal-row"><CircleDollarSign /> Invoice #02 <strong>Sent</strong></div>
            <div className="client-note">“Everything I need is in one link. No more hunting through Slack.”</div>
          </div>
        </div>
      </section>

      <section className="section" id="features">
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

function Dashboard({ session }: { session: Session }) {
  const [data, setData] = useState<AppData>(emptyData)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [clientName, setClientName] = useState('')

  const selectedProject = useMemo(
    () => data.projects.find((project) => project.id === selectedProjectId) ?? data.projects[0] ?? null,
    [data.projects, selectedProjectId],
  )

  const projectMilestones = data.milestones.filter((item) => item.project_id === selectedProject?.id)
  const projectTasks = data.tasks.filter((item) => item.project_id === selectedProject?.id)
  const projectApprovals = data.approvals.filter((item) => item.project_id === selectedProject?.id)
  const projectInvoices = data.invoices.filter((item) => item.project_id === selectedProject?.id)
  const approvedCount = projectApprovals.filter((item) => item.status === 'approved').length
  const doneTaskCount = projectTasks.filter((item) => item.status === 'done').length

  async function loadData() {
    if (!supabase) return
    setLoading(true)
    setError(null)
    const { data: membershipRows, error: memberError } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(*)')
      .eq('user_id', session.user.id)
      .limit(1)

    if (memberError) {
      setError(memberError.message)
      setLoading(false)
      return
    }

    const workspace = (membershipRows?.[0]?.workspaces as unknown as Workspace | null) ?? null
    if (!workspace) {
      setError('Workspace is still being prepared. Refresh in a moment after magic-link signup.')
      setLoading(false)
      return
    }

    const [{ data: projects }, { data: milestones }, { data: tasks }, { data: approvals }, { data: invoices }] = await Promise.all([
      supabase.from('projects').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
      supabase.from('milestones').select('*').order('sort_order', { ascending: true }),
      supabase.from('tasks').select('*').order('created_at', { ascending: true }),
      supabase.from('approvals').select('*').order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
    ])

    setData({
      workspace,
      projects: projects ?? [],
      milestones: milestones ?? [],
      tasks: tasks ?? [],
      approvals: approvals ?? [],
      invoices: invoices ?? [],
    })
    setSelectedProjectId((current) => current ?? projects?.[0]?.id ?? null)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function createProject(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !data.workspace || !projectName.trim()) return
    setSaving(true)
    setError(null)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({ workspace_id: data.workspace.id, name: projectName, client_name: clientName || 'Client', status: 'active', currency: 'USD' })
      .select('*')
      .single()

    if (projectError || !project) {
      setError(projectError?.message ?? 'Could not create project')
      setSaving(false)
      return
    }

    await Promise.all([
      supabase.from('milestones').insert([
        { project_id: project.id, title: 'Kickoff + scope lock', status: 'approved', sort_order: 1 },
        { project_id: project.id, title: 'First delivery review', status: 'in_progress', sort_order: 2 },
        { project_id: project.id, title: 'Final approval + handoff', status: 'pending', sort_order: 3 },
      ]),
      supabase.from('tasks').insert([
        { project_id: project.id, title: 'Confirm deliverables and success criteria', status: 'done', priority: 'high' },
        { project_id: project.id, title: 'Share staging preview link', status: 'doing', priority: 'normal' },
        { project_id: project.id, title: 'Collect revision notes', status: 'todo', priority: 'normal' },
      ]),
      supabase.from('approvals').insert({ project_id: project.id, title: 'Approve first delivery direction', status: 'pending' }),
      supabase.from('invoices').insert({ project_id: project.id, label: 'Deposit / Milestone 1', amount: 500, currency: 'USD', status: 'sent' }),
    ])

    setProjectName('')
    setClientName('')
    setSelectedProjectId(project.id)
    setSaving(false)
    await loadData()
  }

  async function updateProjectStatus(project: Project, status: Project['status']) {
    if (!supabase) return
    await supabase.from('projects').update({ status }).eq('id', project.id)
    await loadData()
  }

  async function signOut() {
    await supabase?.auth.signOut()
    window.location.reload()
  }

  if (loading) return <section className="dashboard loading"><div className="pulse" /> Loading your portal…</section>

  return (
    <section className="dashboard" id="dashboard">
      <div className="dash-top">
        <div>
          <p className="eyebrow"><FolderKanban size={16} /> Founder beta dashboard</p>
          <h2>{data.workspace?.studio_name || data.workspace?.name || 'Your studio'} command center</h2>
          <p>Signed in as {session.user.email}. Keep project scope, approvals, tasks, and manual invoices visible.</p>
        </div>
        <button className="ghost" onClick={signOut}><DoorOpen size={18} /> Sign out</button>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="dash-grid">
        <aside className="sidebar-panel">
          <h3>Create project</h3>
          <form onSubmit={createProject} className="compact-form">
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name" />
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" />
            <button disabled={saving || !projectName.trim()}><Plus size={16} /> {saving ? 'Creating…' : 'Create portal'}</button>
          </form>
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

        <main className="workspace-panel">
          {selectedProject ? (
            <>
              <div className="project-header">
                <div>
                  <p className="eyebrow"><Users2 size={16} /> {selectedProject.client_name}</p>
                  <h2>{selectedProject.name}</h2>
                </div>
                <select value={selectedProject.status} onChange={(e) => updateProjectStatus(selectedProject, e.target.value as Project['status'])}>
                  {projectStatuses.map((status) => <option key={status}>{status}</option>)}
                </select>
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
                  {projectApprovals.map((item) => <div className="line-item" key={item.id}><span>{item.title}</span><em>{item.status}</em></div>)}
                  <h3>Payments</h3>
                  {projectInvoices.map((item) => <div className="line-item" key={item.id}><span>{item.label}</span><em>{currency(Number(item.amount), item.currency)} · {item.status}</em></div>)}
                </section>
              </div>

              <div className="share-strip"><Link2 size={18} /> Client-share links and invite flow are next. For beta, this dashboard validates the core portal workflow.</div>
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

  useEffect(() => {
    if (!supabase) {
      setBooting(false)
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
      {booting ? <section className="auth-card">Checking session…</section> : session ? <Dashboard session={session} /> : <AuthPanel />}
      <footer>
        <span>ClientFlow Lite · built for freelance developers worldwide</span>
        <a href="mailto:afumoons@gmail.com"><Mail size={16} /> Contact founder</a>
      </footer>
    </main>
  )
}

export default App

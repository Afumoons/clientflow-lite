import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { CheckCircle2, Copy, DoorOpen, Link2, Plus, ShieldCheck, Table2, Trash2, Users2, XCircle } from 'lucide-react'
import gsap from 'gsap'
import { buildInviteUrl, canManageProjectData, createInviteToken, isClientMember, sha256Hex } from '../lib/clientPortalWorkflow'
import { emptyData, fetchClientflowData, formatInviteStatus, toSafeErrorMessage, trimOrNull } from '../lib/clientflowApi'
import { supabase } from '../lib/supabase'
import type { Approval, Invoice, Milestone, Project, ProjectInvite, Task, WorkspaceRole } from '../types'

gsap.registerPlugin()

const projectStatuses: Project['status'][] = ['proposal', 'active', 'review', 'completed', 'paused']
const milestoneStatuses: Milestone['status'][] = ['pending', 'in_progress', 'waiting_approval', 'approved', 'revision']
const taskStatuses: Task['status'][] = ['todo', 'doing', 'blocked', 'done']
const invoiceStatuses: Invoice['status'][] = ['draft', 'sent', 'paid', 'overdue']

function currency(amount: number | null | undefined, code = 'USD') {
  if (!amount) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(amount)
}

function inviteLabel(invite: ProjectInvite) {
  const status = formatInviteStatus(invite)
  const email = invite.invited_email ?? 'generic link'
  return `${email} · ${status}`
}

export function Dashboard({ session, inviteToken }: { session: Session, inviteToken: string | null }) {
  const dashboardRef = useRef<HTMLElement | null>(null)
  const [data, setData] = useState(emptyData)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [newMilestone, setNewMilestone] = useState('')
  const [newTask, setNewTask] = useState('')
  const [newApproval, setNewApproval] = useState('')
  const [newInvoiceLabel, setNewInvoiceLabel] = useState('')
  const [newInvoiceAmount, setNewInvoiceAmount] = useState('')
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({})
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [acceptingInvite, setAcceptingInvite] = useState(false)

  const selectedProject = useMemo(() => data.projects.find((project) => project.id === selectedProjectId) ?? data.projects[0] ?? null, [data.projects, selectedProjectId])
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
  const projectInvites = data.invites.filter((item) => item.project_id === selectedProject?.id)
  const approvedCount = projectApprovals.filter((item) => item.status === 'approved').length
  const doneTaskCount = projectTasks.filter((item) => item.status === 'done').length

  async function run(action: string, fn: () => Promise<void>) {
    try { setSaving(action); setError(null); setNotice(null); await fn() }
    catch (err) { setError(toSafeErrorMessage(err)) }
    finally { setSaving(null) }
  }

  async function loadData(preferredProjectId?: string) {
    if (!supabase) return
    setLoading(true)
    setError(null)
    try {
      const nextData = await fetchClientflowData(supabase, session.user.id)
      setData(nextData)
      setSelectedProjectId((current) => preferredProjectId ?? current ?? nextData.projects[0]?.id ?? null)
    } catch (err) { setError(toSafeErrorMessage(err)) }
    finally { setLoading(false) }
  }

  async function acceptInviteIfPresent() {
    if (!supabase || !inviteToken || acceptingInvite) return false
    setAcceptingInvite(true)
    setError(null)
    const { data: project, error: inviteError } = await supabase!.rpc('accept_project_invite', { p_invite_token: inviteToken })
    setAcceptingInvite(false)
    if (inviteError) { setError(toSafeErrorMessage(inviteError)); return false }
    const acceptedProject = project as Project | null
    setNotice('Invite accepted. Your client portal is now attached to this account.')
    window.history.replaceState({}, document.title, window.location.pathname)
    await loadData(acceptedProject?.id)
    return true
  }

  // Invite bootstrap intentionally runs once for the current landing URL.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void Promise.resolve().then(async () => { const accepted = await acceptInviteIfPresent(); if (!accepted) await loadData() }) }, [])
  useEffect(() => { if (loading || !dashboardRef.current) return; const ctx = gsap.context(() => { gsap.fromTo('.dash-top, .sidebar-panel, .workspace-panel', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.08, ease: 'power3.out' }) }, dashboardRef); return () => ctx.revert() }, [loading, selectedProjectId, data.projects.length])

  async function createProject(event: FormEvent) {
    event.preventDefault(); if (!supabase || !data.workspace || !projectName.trim()) return
    await run('project', async () => {
      const { data: project, error: projectError } = await supabase!.rpc('create_project_with_seed_data', { p_workspace_id: data.workspace!.id, p_project_name: projectName.trim(), p_client_name: trimOrNull(clientName) ?? 'Client', p_client_email: trimOrNull(clientEmail), p_currency: 'USD' })
      if (projectError || !project) throw projectError ?? new Error('Could not create project')
      const createdProject = project as Project
      setProjectName(''); setClientName(''); setClientEmail(''); setSelectedProjectId(createdProject.id); await loadData(createdProject.id)
    })
  }

  async function updateProjectStatus(project: Project, status: Project['status']) { if (!supabase || !canManageProjectData(membershipByWorkspace.get(project.workspace_id)?.role)) return; await run(`project-${project.id}`, async () => { const { error } = await supabase!.from('projects').update({ status }).eq('id', project.id); if (error) throw error; await loadData(project.id) }) }
  async function createMilestone(event: FormEvent) { event.preventDefault(); if (!supabase || !selectedProject || !newMilestone.trim()) return; await run('milestone', async () => { const { error } = await supabase!.from('milestones').insert({ project_id: selectedProject.id, title: newMilestone.trim(), sort_order: projectMilestones.length + 1 }); if (error) throw error; setNewMilestone(''); await loadData(selectedProject.id) }) }
  async function updateMilestone(item: Milestone, status: Milestone['status']) { if (!supabase || !selectedProject) return; await run(`milestone-${item.id}`, async () => { const { error } = await supabase!.from('milestones').update({ status }).eq('id', item.id); if (error) throw error; await loadData(selectedProject.id) }) }
  async function deleteMilestone(item: Milestone) { if (!supabase || !selectedProject || !confirm(`Delete milestone "${item.title}"?`)) return; await run(`milestone-${item.id}`, async () => { const { error } = await supabase!.from('milestones').delete().eq('id', item.id); if (error) throw error; await loadData(selectedProject.id) }) }
  async function createTask(event: FormEvent) { event.preventDefault(); if (!supabase || !selectedProject || !newTask.trim()) return; await run('task', async () => { const { error } = await supabase!.from('tasks').insert({ project_id: selectedProject.id, title: newTask.trim() }); if (error) throw error; setNewTask(''); await loadData(selectedProject.id) }) }
  async function updateTask(item: Task, status: Task['status']) { if (!supabase || !selectedProject) return; await run(`task-${item.id}`, async () => { const { error } = await supabase!.from('tasks').update({ status }).eq('id', item.id); if (error) throw error; await loadData(selectedProject.id) }) }
  async function deleteTask(item: Task) { if (!supabase || !selectedProject || !confirm(`Delete task "${item.title}"?`)) return; await run(`task-${item.id}`, async () => { const { error } = await supabase!.from('tasks').delete().eq('id', item.id); if (error) throw error; await loadData(selectedProject.id) }) }
  async function createApproval(event: FormEvent) { event.preventDefault(); if (!supabase || !selectedProject || !newApproval.trim()) return; await run('approval', async () => { const { error } = await supabase!.from('approvals').insert({ project_id: selectedProject.id, title: newApproval.trim() }); if (error) throw error; setNewApproval(''); await loadData(selectedProject.id) }) }
  async function deleteApproval(item: Approval) { if (!supabase || !selectedProject || !confirm(`Delete approval "${item.title}"?`)) return; await run(`approval-${item.id}`, async () => { const { error } = await supabase!.from('approvals').delete().eq('id', item.id); if (error) throw error; await loadData(selectedProject.id) }) }
  async function createInvoice(event: FormEvent) { event.preventDefault(); if (!supabase || !selectedProject || !newInvoiceLabel.trim()) return; await run('invoice', async () => { const amount = Number(newInvoiceAmount || 0); const { error } = await supabase!.from('invoices').insert({ project_id: selectedProject.id, label: newInvoiceLabel.trim(), amount: Number.isFinite(amount) ? amount : 0, currency: selectedProject.currency, status: 'draft' }); if (error) throw error; setNewInvoiceLabel(''); setNewInvoiceAmount(''); await loadData(selectedProject.id) }) }
  async function updateInvoice(item: Invoice, status: Invoice['status']) { if (!supabase || !selectedProject) return; await run(`invoice-${item.id}`, async () => { const { error } = await supabase!.from('invoices').update({ status }).eq('id', item.id); if (error) throw error; await loadData(selectedProject.id) }) }
  async function deleteInvoice(item: Invoice) { if (!supabase || !selectedProject || !confirm(`Delete invoice "${item.label}"?`)) return; await run(`invoice-${item.id}`, async () => { const { error } = await supabase!.from('invoices').delete().eq('id', item.id); if (error) throw error; await loadData(selectedProject.id) }) }

  async function createClientInvite(project: Project) {
    if (!supabase || !canManageSelectedProject) return
    await run('invite', async () => { const token = createInviteToken(); const tokenHash = await sha256Hex(token); const { error: inviteError } = await supabase!.from('project_invites').insert({ project_id: project.id, invited_email: trimOrNull(project.client_email), token_hash: tokenHash }); if (inviteError) throw inviteError; const url = buildInviteUrl(window.location.origin, token); setInviteUrl(url); setNotice('Invite link created. Copy it now — only the hashed token is stored.'); await loadData(project.id) })
  }
  async function revokeInvite(invite: ProjectInvite) { if (!supabase || !selectedProject || !confirm('Revoke this invite?')) return; await run(`invite-${invite.id}`, async () => { const { error: revokeError } = await supabase!.rpc('revoke_project_invite', { p_invite_id: invite.id }); if (revokeError) throw revokeError; setNotice('Invite revoked.'); await loadData(selectedProject.id) }) }
  async function copyInviteUrl() { if (!inviteUrl) return; await navigator.clipboard.writeText(inviteUrl); setNotice('Invite link copied to clipboard.') }
  async function decideApproval(approval: Approval, status: Approval['status']) { if (!supabase || !selectedProject) return; await run(`approval-${approval.id}`, async () => { const { error: approvalError } = await supabase!.rpc('submit_approval_decision', { p_approval_id: approval.id, p_status: status, p_note: trimOrNull(approvalNotes[approval.id]) }); if (approvalError) throw approvalError; setApprovalNotes((current) => ({ ...current, [approval.id]: '' })); await loadData(selectedProject.id) }) }
  async function signOut() { await supabase?.auth.signOut(); window.location.reload() }

  const rootOperator = canManageProjectData((data.memberships.find((membership) => data.workspace?.id === membership.workspace_id)?.role ?? null) as WorkspaceRole | null)
  if (loading) return <section className="dashboard loading"><div className="pulse" /> Loading your portal…</section>

  return <section className="dashboard" id="dashboard" ref={dashboardRef}><div className="dash-top"><div><p className="eyebrow"><Table2 size={16} /> {isSelectedClient ? 'Client portal' : 'Founder beta workspace'}</p><h2>{selectedWorkspace?.studio_name || selectedWorkspace?.name || 'Your studio'} workspace</h2><p>Signed in as {session.user.email}. {isSelectedClient ? 'Client-safe view with approval notes.' : 'Production-grade command center for scope, approvals, tasks, invoices, and client invites.'}</p></div><button className="ghost" onClick={signOut}><DoorOpen size={18} /> Sign out</button></div>{error && <div className="error-box">{error}</div>}{notice && <div className="success-box"><ShieldCheck size={18} /> {notice}</div>}{acceptingInvite && <div className="share-strip"><ShieldCheck size={18} /> Accepting invite and attaching your client portal…</div>}<div className="dash-grid"><aside className="sidebar-panel app-sidebar">{rootOperator && <><h3>Create project</h3><form onSubmit={createProject} className="compact-form"><input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name" maxLength={160} /><input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" maxLength={160} /><input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="Client email for invite" type="email" /><button disabled={saving === 'project' || !projectName.trim()}><Plus size={16} /> {saving === 'project' ? 'Creating…' : 'Create portal'}</button></form></>}<h3>Projects</h3><div className="project-list">{data.projects.map((project) => <button key={project.id} className={project.id === selectedProject?.id ? 'active' : ''} onClick={() => setSelectedProjectId(project.id)}><strong>{project.name}</strong><span>{project.client_name} · {project.status}</span></button>)}{!data.projects.length && <p className="empty">No projects yet. Create your first client portal.</p>}</div></aside><main className="workspace-panel table-surface">{selectedProject ? <><div className="project-header"><div><p className="eyebrow"><Users2 size={16} /> {selectedProject.client_name} · {selectedRole ?? 'viewer'}</p><h2>{selectedProject.name}</h2></div>{canManageSelectedProject ? <select value={selectedProject.status} onChange={(e) => updateProjectStatus(selectedProject, e.target.value as Project['status'])}>{projectStatuses.map((status) => <option key={status}>{status}</option>)}</select> : <em>{selectedProject.status}</em>}</div><div className="metric-grid"><article><span>Tasks done</span><strong>{doneTaskCount}/{projectTasks.length}</strong></article><article><span>Approvals</span><strong>{approvedCount}/{projectApprovals.length}</strong></article><article><span>Invoice value</span><strong>{currency(projectInvoices.reduce((sum, item) => sum + Number(item.amount), 0), selectedProject.currency)}</strong></article></div><div className="content-columns"><section className="board-card"><h3>Milestones</h3>{canManageSelectedProject && <form className="inline-create" onSubmit={createMilestone}><input value={newMilestone} onChange={(e) => setNewMilestone(e.target.value)} placeholder="New milestone" /><button disabled={saving === 'milestone' || !newMilestone.trim()}><Plus size={14} /></button></form>}{projectMilestones.map((item) => <div className="line-item editable-row" key={item.id}><span>{item.title}</span>{canManageSelectedProject ? <span className="row-actions"><select value={item.status} onChange={(e) => updateMilestone(item, e.target.value as Milestone['status'])}>{milestoneStatuses.map((status) => <option key={status}>{status}</option>)}</select><button onClick={() => deleteMilestone(item)}><Trash2 size={14} /></button></span> : <em>{item.status}</em>}</div>)}</section><section className="board-card"><h3>Tasks</h3>{canManageSelectedProject && <form className="inline-create" onSubmit={createTask}><input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="New task" /><button disabled={saving === 'task' || !newTask.trim()}><Plus size={14} /></button></form>}{taskStatuses.map((status) => <div key={status} className="task-lane"><strong>{status}</strong>{projectTasks.filter((task) => task.status === status).map((task) => <p key={task.id}>{task.title}{canManageSelectedProject && <span className="row-actions"><select value={task.status} onChange={(e) => updateTask(task, e.target.value as Task['status'])}>{taskStatuses.map((next) => <option key={next}>{next}</option>)}</select><button onClick={() => deleteTask(task)}><Trash2 size={14} /></button></span>}</p>)}</div>)}</section><section className="board-card"><h3>Approvals</h3>{canManageSelectedProject && <form className="inline-create" onSubmit={createApproval}><input value={newApproval} onChange={(e) => setNewApproval(e.target.value)} placeholder="New approval" /><button disabled={saving === 'approval' || !newApproval.trim()}><Plus size={14} /></button></form>}{projectApprovals.map((item) => <div className="approval-item" key={item.id}><div className="line-item"><span>{item.title}{item.note && <small>{item.note}</small>}</span><em>{item.status}</em></div>{canManageSelectedProject && <button className="icon-button" onClick={() => deleteApproval(item)}><Trash2 size={14} /> Delete</button>}{isSelectedClient && item.status === 'pending' && <div className="approval-actions"><textarea value={approvalNotes[item.id] ?? ''} onChange={(e) => setApprovalNotes((current) => ({ ...current, [item.id]: e.target.value }))} placeholder="Optional approval/revision note" /><button onClick={() => decideApproval(item, 'approved')}><CheckCircle2 size={15} /> Approve</button><button onClick={() => decideApproval(item, 'revision_requested')}><XCircle size={15} /> Request revision</button></div>}</div>)}<h3>Payments</h3>{canManageSelectedProject && <form className="inline-create invoice-create" onSubmit={createInvoice}><input value={newInvoiceLabel} onChange={(e) => setNewInvoiceLabel(e.target.value)} placeholder="Invoice label" /><input value={newInvoiceAmount} onChange={(e) => setNewInvoiceAmount(e.target.value)} placeholder="Amount" inputMode="decimal" /><button disabled={saving === 'invoice' || !newInvoiceLabel.trim()}><Plus size={14} /></button></form>}{projectInvoices.map((item) => <div className="line-item editable-row" key={item.id}><span>{item.label}</span>{canManageSelectedProject ? <span className="row-actions"><select value={item.status} onChange={(e) => updateInvoice(item, e.target.value as Invoice['status'])}>{invoiceStatuses.map((status) => <option key={status}>{status}</option>)}</select><button onClick={() => deleteInvoice(item)}><Trash2 size={14} /></button></span> : <em>{currency(Number(item.amount), item.currency)} · {item.status}</em>}</div>)}</section></div><div className="share-strip"><Link2 size={18} />{canManageSelectedProject ? <div className="invite-flow"><strong>Client invite workflow</strong><span>{projectInvites.length} invite record(s) for this project.</span><button onClick={() => createClientInvite(selectedProject)} disabled={saving === 'invite'}><Link2 size={15} /> {saving === 'invite' ? 'Creating…' : 'Create secure invite link'}</button>{inviteUrl && <button className="secondary-button" onClick={copyInviteUrl}><Copy size={15} /> Copy invite link</button>}{inviteUrl && <code>{inviteUrl}</code>}<div className="invite-list">{projectInvites.map((invite) => <div key={invite.id} className="invite-row"><span>{inviteLabel(invite)}</span>{formatInviteStatus(invite) === 'active' && <button onClick={() => revokeInvite(invite)}>Revoke</button>}</div>)}</div></div> : 'You are viewing the client-safe portal. Internal project edits and membership management are locked.'}</div></> : <div className="empty-state"><h3>Create your first portal</h3><p>Start with a real or demo client project. The app will seed starter milestones, tasks, approval, and payment status.</p></div>}</main></div></section>
}

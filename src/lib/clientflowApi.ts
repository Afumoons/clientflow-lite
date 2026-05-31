import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { Approval, Invoice, Milestone, Project, ProjectInvite, Task, Workspace, WorkspaceMember } from '../types'
import { canManageProjectData } from './clientPortalWorkflow'

export type AppData = {
  workspace: Workspace | null
  memberships: WorkspaceMember[]
  projects: Project[]
  milestones: Milestone[]
  tasks: Task[]
  approvals: Approval[]
  invoices: Invoice[]
  invites: ProjectInvite[]
}

export const emptyData: AppData = {
  workspace: null,
  memberships: [],
  projects: [],
  milestones: [],
  tasks: [],
  approvals: [],
  invoices: [],
  invites: [],
}

type SupabaseLike = SupabaseClient


export function trimOrNull(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function toSafeErrorMessage(error: unknown) {
  const raw = typeof error === 'string'
    ? error
    : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : undefined
  const message = raw?.toLowerCase() ?? ''

  if (!raw) return 'Something went wrong. Please try again.'
  if (message.includes('jwt') || message.includes('session')) return 'Your session expired. Please sign in again.'
  if (message.includes('permission') || message.includes('not assigned') || message.includes('42501') || message.includes('workspace operators')) return 'You do not have permission to perform this action.'
  if (message.includes('invalid or expired') || message.includes('expired')) return 'This invite is invalid or expired.'
  if (message.includes('duplicate') || message.includes('unique')) return 'That invite already exists. Please create a fresh invite link.'
  if (message.includes('network') || message.includes('fetch')) return 'Network error. Check your connection and try again.'

  return raw.length > 140 ? 'Something went wrong. Please try again.' : raw
}

export function formatInviteStatus(invite: Pick<ProjectInvite, 'accepted_at' | 'expires_at' | 'revoked_at'>) {
  if (invite.accepted_at) return 'accepted'
  if (invite.revoked_at) return 'revoked'
  if (new Date(invite.expires_at).getTime() <= Date.now()) return 'expired'
  return 'active'
}

function unwrap<T>(label: string, result: { data: T | null, error: PostgrestError | null }) {
  if (result.error) throw new Error(`${label}: ${toSafeErrorMessage(result.error)}`)
  return result.data
}

export async function fetchClientflowData(supabase: SupabaseLike, userId: string): Promise<AppData> {
  const membershipRows = unwrap('Memberships', await supabase
    .from('workspace_members')
    .select('workspace_id, user_id, role, workspaces(*)')
    .eq('user_id', userId))

  const memberships = (membershipRows ?? []) as unknown as WorkspaceMember[]
  const primaryMembership = memberships.find((membership) => canManageProjectData(membership.role)) ?? memberships[0] ?? null
  const workspaceValue = primaryMembership?.workspaces
  const workspace = (Array.isArray(workspaceValue) ? workspaceValue[0] : workspaceValue) ?? null

  const projects = unwrap('Projects', await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false }))

  const projectRows = (projects ?? []) as Project[]
  const projectIds = projectRows.map((project) => project.id)
  if (!projectIds.length) return { ...emptyData, workspace, memberships, projects: projectRows }

  const [milestones, tasks, approvals, invoices, invites] = await Promise.all([
    supabase.from('milestones').select('*').in('project_id', projectIds).order('sort_order', { ascending: true }),
    supabase.from('tasks').select('*').in('project_id', projectIds).order('created_at', { ascending: true }),
    supabase.from('approvals').select('*').in('project_id', projectIds).order('created_at', { ascending: false }),
    supabase.from('invoices').select('*').in('project_id', projectIds).order('created_at', { ascending: false }),
    supabase.from('project_invites').select('*').in('project_id', projectIds).order('created_at', { ascending: false }),
  ])

  return {
    workspace,
    memberships,
    projects: projectRows,
    milestones: (unwrap('Milestones', milestones) ?? []) as Milestone[],
    tasks: (unwrap('Tasks', tasks) ?? []) as Task[],
    approvals: (unwrap('Approvals', approvals) ?? []) as Approval[],
    invoices: (unwrap('Invoices', invoices) ?? []) as Invoice[],
    invites: (unwrap('Invites', invites) ?? []) as ProjectInvite[],
  }
}

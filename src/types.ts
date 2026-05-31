export type WorkspaceRole = 'owner' | 'member' | 'client'

export type Workspace = {
  id: string
  owner_id: string
  name: string
  studio_name: string | null
}

export type WorkspaceMember = {
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  workspaces?: Workspace | Workspace[] | null
}

export type ProjectInvite = {
  id: string
  project_id: string
  invited_email: string | null
  token_hash: string
  accepted_by: string | null
  accepted_at: string | null
  revoked_by: string | null
  revoked_at: string | null
  expires_at: string
  created_at: string
}

export type Project = {
  id: string
  workspace_id: string
  name: string
  client_name: string
  client_email: string | null
  status: 'proposal' | 'active' | 'review' | 'completed' | 'paused'
  budget_amount: number | null
  currency: string
  brief: string | null
  due_date: string | null
  created_at: string
}

export type Milestone = {
  id: string
  project_id: string
  title: string
  description: string | null
  status: 'pending' | 'in_progress' | 'waiting_approval' | 'approved' | 'revision'
  sort_order: number
  due_date: string | null
}

export type Task = {
  id: string
  project_id: string
  milestone_id: string | null
  title: string
  status: 'todo' | 'doing' | 'blocked' | 'done'
  priority: 'low' | 'normal' | 'high'
}

export type Approval = {
  id: string
  project_id: string
  milestone_id: string | null
  title: string
  status: 'pending' | 'approved' | 'revision_requested'
  note: string | null
  decided_at: string | null
}

export type Invoice = {
  id: string
  project_id: string
  label: string
  amount: number
  currency: string
  status: 'draft' | 'sent' | 'paid' | 'overdue'
  due_date: string | null
}

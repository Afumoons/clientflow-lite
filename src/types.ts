export type Workspace = {
  id: string
  owner_id: string
  name: string
  studio_name: string | null
}

export type Project = {
  id: string
  workspace_id: string
  name: string
  client_name: string
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

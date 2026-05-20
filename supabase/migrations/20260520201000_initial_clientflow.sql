create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text default 'freelancer' check (role in ('freelancer', 'client')),
  created_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  studio_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member', 'client')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid references auth.users(id) on delete set null,
  name text not null,
  client_name text not null default 'Client',
  status text not null default 'active' check (status in ('proposal', 'active', 'review', 'completed', 'paused')),
  budget_amount numeric(12,2),
  currency text not null default 'USD',
  brief text,
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'waiting_approval', 'approved', 'revision')),
  sort_order int not null default 0,
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete set null,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'doing', 'blocked', 'done')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  created_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete set null,
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'revision_requested')),
  note text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  amount numeric(12,2) not null default 0,
  currency text not null default 'USD',
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue')),
  due_date date,
  created_at timestamptz not null default now()
);

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_project_member(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    join public.workspace_members wm on wm.workspace_id = p.workspace_id
    where p.id = target_project_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.workspaces (owner_id, name, studio_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'My Studio') || '''s Workspace', coalesce(new.raw_user_meta_data->>'full_name', 'Independent Studio'))
  on conflict do nothing;

  insert into public.workspace_members (workspace_id, user_id, role)
  select w.id, new.id, 'owner'
  from public.workspaces w
  where w.owner_id = new.id
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.approvals enable row level security;
alter table public.invoices enable row level security;

drop policy if exists "profiles readable by owner" on public.profiles;
create policy "profiles readable by owner" on public.profiles for select using (id = auth.uid());
drop policy if exists "profiles writable by owner" on public.profiles;
create policy "profiles writable by owner" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "workspace members can view workspaces" on public.workspaces;
create policy "workspace members can view workspaces" on public.workspaces for select using (public.is_workspace_member(id));
drop policy if exists "workspace owners can create workspaces" on public.workspaces;
create policy "workspace owners can create workspaces" on public.workspaces for insert with check (owner_id = auth.uid());
drop policy if exists "workspace owners can update workspaces" on public.workspaces;
create policy "workspace owners can update workspaces" on public.workspaces for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "members can view their memberships" on public.workspace_members;
create policy "members can view their memberships" on public.workspace_members for select using (user_id = auth.uid() or public.is_workspace_member(workspace_id));
drop policy if exists "owners can manage memberships" on public.workspace_members;
create policy "owners can manage memberships" on public.workspace_members for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "members can view projects" on public.projects;
create policy "members can view projects" on public.projects for select using (public.is_workspace_member(workspace_id));
drop policy if exists "members can create projects" on public.projects;
create policy "members can create projects" on public.projects for insert with check (public.is_workspace_member(workspace_id));
drop policy if exists "members can update projects" on public.projects;
create policy "members can update projects" on public.projects for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "members can view milestones" on public.milestones;
create policy "members can view milestones" on public.milestones for select using (public.is_project_member(project_id));
drop policy if exists "members can manage milestones" on public.milestones;
create policy "members can manage milestones" on public.milestones for all using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));

drop policy if exists "members can view tasks" on public.tasks;
create policy "members can view tasks" on public.tasks for select using (public.is_project_member(project_id));
drop policy if exists "members can manage tasks" on public.tasks;
create policy "members can manage tasks" on public.tasks for all using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));

drop policy if exists "members can view approvals" on public.approvals;
create policy "members can view approvals" on public.approvals for select using (public.is_project_member(project_id));
drop policy if exists "members can manage approvals" on public.approvals;
create policy "members can manage approvals" on public.approvals for all using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));

drop policy if exists "members can view invoices" on public.invoices;
create policy "members can view invoices" on public.invoices for select using (public.is_project_member(project_id));
drop policy if exists "members can manage invoices" on public.invoices;
create policy "members can manage invoices" on public.invoices for all using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));

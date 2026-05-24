create extension if not exists pgcrypto;

alter table public.projects
  add column if not exists client_email text;

create table if not exists public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  invited_email text,
  role text not null default 'client' check (role = 'client'),
  token_hash text not null unique,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists project_invites_project_id_idx on public.project_invites(project_id);
create index if not exists project_invites_token_hash_idx on public.project_invites(token_hash);
create index if not exists projects_client_id_idx on public.projects(client_id);
create index if not exists workspace_members_user_id_idx on public.workspace_members(user_id);

alter table public.project_invites enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.project_invites to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.milestones to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.approvals to authenticated;
grant select, insert, update, delete on public.invoices to authenticated;

create or replace function public.workspace_role(target_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select wm.role
  from public.workspace_members wm
  where wm.workspace_id = target_workspace_id
    and wm.user_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = (select auth.uid())
    );
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role = 'owner'
    );
$$;

create or replace function public.is_workspace_operator(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role in ('owner', 'member')
    );
$$;

create or replace function public.is_project_client(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.projects p
      where p.id = target_project_id
        and p.client_id = (select auth.uid())
    );
$$;

create or replace function public.can_view_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.projects p
      left join public.workspace_members wm
        on wm.workspace_id = p.workspace_id
       and wm.user_id = (select auth.uid())
      where p.id = target_project_id
        and (
          wm.role in ('owner', 'member')
          or p.client_id = (select auth.uid())
        )
    );
$$;

create or replace function public.can_manage_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.projects p
      join public.workspace_members wm on wm.workspace_id = p.workspace_id
      where p.id = target_project_id
        and wm.user_id = (select auth.uid())
        and wm.role in ('owner', 'member')
    );
$$;

create or replace function public.is_project_member(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_view_project(target_project_id);
$$;

create or replace function public.create_project_with_seed_data(
  p_workspace_id uuid,
  p_project_name text,
  p_client_name text default 'Client',
  p_client_email text default null,
  p_currency text default 'USD'
)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  new_project public.projects;
begin
  if not public.is_workspace_operator(p_workspace_id) then
    raise exception 'Only workspace operators can create projects' using errcode = '42501';
  end if;

  insert into public.projects (workspace_id, name, client_name, client_email, status, currency)
  values (p_workspace_id, nullif(trim(p_project_name), ''), coalesce(nullif(trim(p_client_name), ''), 'Client'), nullif(trim(p_client_email), ''), 'active', coalesce(nullif(trim(p_currency), ''), 'USD'))
  returning * into new_project;

  insert into public.milestones (project_id, title, status, sort_order) values
    (new_project.id, 'Kickoff + scope lock', 'approved', 1),
    (new_project.id, 'First delivery review', 'in_progress', 2),
    (new_project.id, 'Final approval + handoff', 'pending', 3);

  insert into public.tasks (project_id, title, status, priority) values
    (new_project.id, 'Confirm deliverables and success criteria', 'done', 'high'),
    (new_project.id, 'Share staging preview link', 'doing', 'normal'),
    (new_project.id, 'Collect revision notes', 'todo', 'normal');

  insert into public.approvals (project_id, title, status)
  values (new_project.id, 'Approve first delivery direction', 'pending');

  insert into public.invoices (project_id, label, amount, currency, status)
  values (new_project.id, 'Deposit / Milestone 1', 500, new_project.currency, 'sent');

  return new_project;
end;
$$;

create or replace function public.accept_project_invite(p_invite_token text)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.project_invites;
  accepted_project public.projects;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into invite_row
  from public.project_invites pi
  where pi.token_hash = encode(digest(p_invite_token, 'sha256'), 'hex')
    and pi.accepted_at is null
    and pi.expires_at > now()
  limit 1;

  if invite_row.id is null then
    raise exception 'Invite is invalid or expired' using errcode = '22023';
  end if;

  select * into accepted_project
  from public.projects
  where id = invite_row.project_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (accepted_project.workspace_id, current_user_id, 'client')
  on conflict (workspace_id, user_id) do update
    set role = case
      when public.workspace_members.role = 'owner' then public.workspace_members.role
      when public.workspace_members.role = 'member' then public.workspace_members.role
      else 'client'
    end;

  update public.projects
  set client_id = current_user_id,
      client_email = coalesce(client_email, invite_row.invited_email)
  where id = accepted_project.id;

  update public.project_invites
  set accepted_by = current_user_id,
      accepted_at = now()
  where id = invite_row.id;

  select * into accepted_project
  from public.projects
  where id = invite_row.project_id;

  return accepted_project;
end;
$$;

create or replace function public.submit_approval_decision(
  p_approval_id uuid,
  p_status text,
  p_note text default null
)
returns public.approvals
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_approval public.approvals;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_status not in ('approved', 'revision_requested') then
    raise exception 'Approval status must be approved or revision_requested' using errcode = '22023';
  end if;

  update public.approvals a
  set status = p_status,
      note = coalesce(nullif(trim(p_note), ''), a.note),
      decided_at = now()
  where a.id = p_approval_id
    and a.status = 'pending'
    and public.is_project_client(a.project_id)
  returning * into updated_approval;

  if updated_approval.id is null then
    raise exception 'Approval is not pending or not assigned to this client' using errcode = '42501';
  end if;

  return updated_approval;
end;
$$;

revoke all on function public.workspace_role(uuid) from public;
revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_owner(uuid) from public;
revoke all on function public.is_workspace_operator(uuid) from public;
revoke all on function public.is_project_client(uuid) from public;
revoke all on function public.can_view_project(uuid) from public;
revoke all on function public.can_manage_project(uuid) from public;
revoke all on function public.is_project_member(uuid) from public;
revoke all on function public.create_project_with_seed_data(uuid, text, text, text, text) from public;
revoke all on function public.accept_project_invite(text) from public;
revoke all on function public.submit_approval_decision(uuid, text, text) from public;

grant execute on function public.workspace_role(uuid) to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
grant execute on function public.is_workspace_operator(uuid) to authenticated;
grant execute on function public.is_project_client(uuid) to authenticated;
grant execute on function public.can_view_project(uuid) to authenticated;
grant execute on function public.can_manage_project(uuid) to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.create_project_with_seed_data(uuid, text, text, text, text) to authenticated;
grant execute on function public.accept_project_invite(text) to authenticated;
grant execute on function public.submit_approval_decision(uuid, text, text) to authenticated;

drop policy if exists "workspace members can view workspaces" on public.workspaces;
create policy "workspace members can view workspaces" on public.workspaces
for select to authenticated
using (public.is_workspace_member(id));

drop policy if exists "workspace owners can create workspaces" on public.workspaces;
create policy "workspace owners can create workspaces" on public.workspaces
for insert to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists "workspace owners can update workspaces" on public.workspaces;
create policy "workspace owners can update workspaces" on public.workspaces
for update to authenticated
using (public.is_workspace_owner(id))
with check (public.is_workspace_owner(id));

drop policy if exists "members can view their memberships" on public.workspace_members;
create policy "members can view their memberships" on public.workspace_members
for select to authenticated
using (user_id = (select auth.uid()) or public.is_workspace_owner(workspace_id));

drop policy if exists "owners can manage memberships" on public.workspace_members;
create policy "owners can manage memberships" on public.workspace_members
for all to authenticated
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

drop policy if exists "members can view projects" on public.projects;
create policy "operators and assigned clients can view projects" on public.projects
for select to authenticated
using (public.can_view_project(id));

drop policy if exists "members can create projects" on public.projects;
create policy "operators can create projects" on public.projects
for insert to authenticated
with check (public.is_workspace_operator(workspace_id));

drop policy if exists "members can update projects" on public.projects;
create policy "operators can update projects" on public.projects
for update to authenticated
using (public.is_workspace_operator(workspace_id))
with check (public.is_workspace_operator(workspace_id));

drop policy if exists "operators can manage project invites" on public.project_invites;
create policy "operators can manage project invites" on public.project_invites
for all to authenticated
using (public.can_manage_project(project_id))
with check (public.can_manage_project(project_id));

drop policy if exists "accepted clients can view their project invites" on public.project_invites;
create policy "accepted clients can view their project invites" on public.project_invites
for select to authenticated
using (accepted_by = (select auth.uid()));

drop policy if exists "members can view milestones" on public.milestones;
create policy "project viewers can view milestones" on public.milestones
for select to authenticated
using (public.can_view_project(project_id));

drop policy if exists "members can manage milestones" on public.milestones;
create policy "operators can manage milestones" on public.milestones
for all to authenticated
using (public.can_manage_project(project_id))
with check (public.can_manage_project(project_id));

drop policy if exists "members can view tasks" on public.tasks;
create policy "project viewers can view tasks" on public.tasks
for select to authenticated
using (public.can_view_project(project_id));

drop policy if exists "members can manage tasks" on public.tasks;
create policy "operators can manage tasks" on public.tasks
for all to authenticated
using (public.can_manage_project(project_id))
with check (public.can_manage_project(project_id));

drop policy if exists "members can view approvals" on public.approvals;
create policy "project viewers can view approvals" on public.approvals
for select to authenticated
using (public.can_view_project(project_id));

drop policy if exists "members can manage approvals" on public.approvals;
create policy "operators can manage approvals" on public.approvals
for all to authenticated
using (public.can_manage_project(project_id))
with check (public.can_manage_project(project_id));

drop policy if exists "clients can update approval decisions" on public.approvals;

drop policy if exists "members can view invoices" on public.invoices;
create policy "project viewers can view invoices" on public.invoices
for select to authenticated
using (public.can_view_project(project_id));

drop policy if exists "members can manage invoices" on public.invoices;
create policy "operators can manage invoices" on public.invoices
for all to authenticated
using (public.can_manage_project(project_id))
with check (public.can_manage_project(project_id));

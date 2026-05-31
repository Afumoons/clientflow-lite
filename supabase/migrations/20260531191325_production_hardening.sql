create table if not exists public.clientflow_activity_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null default auth.uid(),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.clientflow_activity_log enable row level security;

grant select, insert on public.clientflow_activity_log to authenticated;

create index if not exists projects_workspace_id_idx on public.projects(workspace_id);
create index if not exists milestones_project_id_idx on public.milestones(project_id);
create index if not exists tasks_project_id_idx on public.tasks(project_id);
create index if not exists approvals_project_id_idx on public.approvals(project_id);
create index if not exists invoices_project_id_idx on public.invoices(project_id);
create index if not exists clientflow_activity_log_project_id_idx on public.clientflow_activity_log(project_id);
create index if not exists clientflow_activity_log_workspace_id_idx on public.clientflow_activity_log(workspace_id);
create index if not exists clientflow_activity_log_created_at_idx on public.clientflow_activity_log(created_at desc);

alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.workspaces add column if not exists updated_at timestamptz not null default now();
alter table public.workspace_members add column if not exists updated_at timestamptz not null default now();
alter table public.projects add column if not exists updated_at timestamptz not null default now();
alter table public.milestones add column if not exists updated_at timestamptz not null default now();
alter table public.tasks add column if not exists updated_at timestamptz not null default now();
alter table public.approvals add column if not exists updated_at timestamptz not null default now();
alter table public.invoices add column if not exists updated_at timestamptz not null default now();
alter table public.project_invites add column if not exists revoked_at timestamptz;
alter table public.project_invites add column if not exists revoked_by uuid references auth.users(id) on delete set null;
alter table public.project_invites add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.log_project_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid;
  target_workspace_id uuid;
  event_action text;
begin
  if tg_table_name = 'projects' then
    target_project_id := coalesce(new.id, old.id);
    target_workspace_id := coalesce(new.workspace_id, old.workspace_id);
  else
    target_project_id := coalesce(new.project_id, old.project_id);
    select p.workspace_id into target_workspace_id from public.projects p where p.id = target_project_id;
  end if;

  event_action := lower(tg_op) || '_' || tg_table_name;

  insert into public.clientflow_activity_log (workspace_id, project_id, action, entity_type, entity_id)
  values (target_workspace_id, target_project_id, event_action, tg_table_name, coalesce(new.id, old.id));

  return coalesce(new, old);
end;
$$;

create or replace function public.revoke_project_invite(p_invite_id uuid)
returns public.project_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_invite public.project_invites;
begin
  update public.project_invites pi
  set revoked_at = now(),
      revoked_by = (select auth.uid()),
      expires_at = least(pi.expires_at, now())
  where pi.id = p_invite_id
    and pi.accepted_at is null
    and pi.revoked_at is null
    and pi.expires_at > now()
    and public.can_manage_project(pi.project_id)
  returning * into updated_invite;

  if updated_invite.id is null then
    raise exception 'Invite is already accepted, expired, revoked, or not manageable' using errcode = '42501';
  end if;

  return updated_invite;
end;
$$;

revoke all on function public.set_updated_at() from public;
revoke all on function public.log_project_activity() from public;
revoke all on function public.revoke_project_invite(uuid) from public;
grant execute on function public.revoke_project_invite(uuid) to authenticated;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
drop trigger if exists set_workspace_members_updated_at on public.workspace_members;
create trigger set_workspace_members_updated_at before update on public.workspace_members for each row execute function public.set_updated_at();
drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
drop trigger if exists set_milestones_updated_at on public.milestones;
create trigger set_milestones_updated_at before update on public.milestones for each row execute function public.set_updated_at();
drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
drop trigger if exists set_approvals_updated_at on public.approvals;
create trigger set_approvals_updated_at before update on public.approvals for each row execute function public.set_updated_at();
drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at before update on public.invoices for each row execute function public.set_updated_at();
drop trigger if exists set_project_invites_updated_at on public.project_invites;
create trigger set_project_invites_updated_at before update on public.project_invites for each row execute function public.set_updated_at();

drop trigger if exists log_projects_activity on public.projects;
create trigger log_projects_activity after insert or update or delete on public.projects for each row execute function public.log_project_activity();
drop trigger if exists log_milestones_activity on public.milestones;
create trigger log_milestones_activity after insert or update or delete on public.milestones for each row execute function public.log_project_activity();
drop trigger if exists log_tasks_activity on public.tasks;
create trigger log_tasks_activity after insert or update or delete on public.tasks for each row execute function public.log_project_activity();
drop trigger if exists log_approvals_activity on public.approvals;
create trigger log_approvals_activity after insert or update or delete on public.approvals for each row execute function public.log_project_activity();
drop trigger if exists log_invoices_activity on public.invoices;
create trigger log_invoices_activity after insert or update or delete on public.invoices for each row execute function public.log_project_activity();

drop policy if exists "project viewers can view activity" on public.clientflow_activity_log;
create policy "project viewers can view activity" on public.clientflow_activity_log
for select to authenticated
using (public.can_view_project(project_id));

drop policy if exists "operators can create activity" on public.clientflow_activity_log;
create policy "operators can create activity" on public.clientflow_activity_log
for insert to authenticated
with check (public.can_manage_project(project_id));

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
    and pi.revoked_at is null
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

revoke all on function public.accept_project_invite(text) from public;
grant execute on function public.accept_project_invite(text) to authenticated;

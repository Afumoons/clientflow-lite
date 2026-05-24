-- Harden browser-callable SECURITY DEFINER functions after Supabase advisors.
-- PostgreSQL grants EXECUTE on new functions broadly unless explicitly revoked.
-- Keep intended authenticated RPC access, but remove anonymous/public execution.

revoke execute on function public.workspace_role(uuid) from anon, public;
revoke execute on function public.is_workspace_member(uuid) from anon, public;
revoke execute on function public.is_workspace_owner(uuid) from anon, public;
revoke execute on function public.is_workspace_operator(uuid) from anon, public;
revoke execute on function public.is_project_client(uuid) from anon, public;
revoke execute on function public.can_view_project(uuid) from anon, public;
revoke execute on function public.can_manage_project(uuid) from anon, public;
revoke execute on function public.is_project_member(uuid) from anon, public;
revoke execute on function public.create_project_with_seed_data(uuid, text, text, text, text) from anon, public;
revoke execute on function public.accept_project_invite(text) from anon, public;
revoke execute on function public.submit_approval_decision(uuid, text, text) from anon, public;

-- Trigger-only function: never expose it as an RPC endpoint.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

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

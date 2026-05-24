import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationsDir = join(process.cwd(), 'supabase', 'migrations')

function readClientPortalMigration() {
  const filename = readdirSync(migrationsDir).find((file) => file.includes('client_portal_permissions'))
  expect(filename, 'client portal permission migration should exist').toBeDefined()
  return readFileSync(join(migrationsDir, filename!), 'utf8')
}

describe('client portal permission migration', () => {
  it('adds explicit owner/client helpers and invite acceptance workflow', () => {
    const sql = readClientPortalMigration()

    expect(sql).toContain('public.is_workspace_owner')
    expect(sql).toContain('public.is_project_client')
    expect(sql).toContain('public.accept_project_invite')
    expect(sql).toContain('public.project_invites')
    expect(sql).toContain('token_hash')
  })

  it('does not allow every workspace member to manage memberships', () => {
    const sql = readClientPortalMigration()

    expect(sql).not.toContain('for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id))')
    expect(sql).toMatch(/owners can manage memberships[\s\S]+public\.is_workspace_owner\(workspace_id\)/)
  })

  it('grants authenticated API access explicitly for newly added public tables', () => {
    const sql = readClientPortalMigration()

    expect(sql).toMatch(/grant\s+select,\s*insert,\s*update,\s*delete\s+on\s+public\.project_invites\s+to\s+authenticated/i)
  })

  it('routes client approval decisions through a narrow RPC instead of broad direct updates', () => {
    const sql = readClientPortalMigration()

    expect(sql).toContain('public.submit_approval_decision')
    expect(sql).not.toContain('create policy "clients can update approval decisions"')
  })
})

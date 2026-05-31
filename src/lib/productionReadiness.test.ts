import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatInviteStatus, toSafeErrorMessage, trimOrNull } from './clientflowApi'

const root = process.cwd()
const migrationsDir = join(root, 'supabase', 'migrations')

function readMigration(fragment: string) {
  const filename = readdirSync(migrationsDir).find((file) => file.includes(fragment))
  expect(filename, `${fragment} migration should exist`).toBeDefined()
  return readFileSync(join(migrationsDir, filename!), 'utf8')
}

describe('production readiness helpers', () => {
  it('maps raw database errors into safe user-facing messages', () => {
    expect(toSafeErrorMessage(null)).toBe('Something went wrong. Please try again.')
    expect(toSafeErrorMessage({ message: 'duplicate key value violates unique constraint "project_invites_token_hash_key"' })).toBe('That invite already exists. Please create a fresh invite link.')
    expect(toSafeErrorMessage({ message: 'JWT expired' })).toBe('Your session expired. Please sign in again.')
    expect(toSafeErrorMessage({ message: 'Only workspace operators can create projects' })).toBe('You do not have permission to perform this action.')
  })

  it('normalizes optional form inputs before persistence', () => {
    expect(trimOrNull('  Afu Studio  ')).toBe('Afu Studio')
    expect(trimOrNull('   ')).toBeNull()
    expect(trimOrNull(undefined)).toBeNull()
  })

  it('formats invite lifecycle states for operators', () => {
    expect(formatInviteStatus({ accepted_at: '2026-01-01T00:00:00Z', revoked_at: null, expires_at: '2026-02-01T00:00:00Z' })).toBe('accepted')
    expect(formatInviteStatus({ accepted_at: null, revoked_at: '2026-01-02T00:00:00Z', expires_at: '2999-01-01T00:00:00Z' })).toBe('revoked')
    expect(formatInviteStatus({ accepted_at: null, revoked_at: null, expires_at: '2000-01-01T00:00:00Z' })).toBe('expired')
    expect(formatInviteStatus({ accepted_at: null, revoked_at: null, expires_at: '2999-01-01T00:00:00Z' })).toBe('active')
  })
})

describe('production hardening files', () => {
  it('adds Vercel security headers and reproducible installs', () => {
    const vercel = readFileSync(join(root, 'vercel.json'), 'utf8')
    expect(vercel).toContain('"installCommand": "npm ci"')
    expect(vercel).toContain('Content-Security-Policy')
    expect(vercel).toContain('X-Content-Type-Options')
    expect(vercel).toContain('Permissions-Policy')
  })

  it('adds a CI quality gate for pull requests and main', () => {
    const ci = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8')
    expect(ci).toContain('npm ci')
    expect(ci).toContain('npm run lint')
    expect(ci).toContain('npm test')
    expect(ci).toContain('npm run build')
  })

  it('keeps disposable temp files out of the repo root', () => {
    const gitignore = readFileSync(join(root, '.gitignore'), 'utf8')
    expect(gitignore).toMatch(/(^|\n)tmp\//)
  })
})

describe('database production hardening migration', () => {
  it('adds indexes, updated_at automation, audit trail, and invite revocation RPC', () => {
    const sql = readMigration('production_hardening')
    expect(sql).toContain('clientflow_activity_log')
    expect(sql).toContain('set_updated_at')
    expect(sql).toContain('revoke_project_invite')
    expect(sql).toContain('and pi.revoked_at is null')
    expect(sql).toContain('and pi.expires_at > now()')
    expect(sql).toContain('create index if not exists milestones_project_id_idx')
    expect(sql).toContain('create index if not exists tasks_project_id_idx')
    expect(sql).toContain('create index if not exists approvals_project_id_idx')
    expect(sql).toContain('create index if not exists invoices_project_id_idx')
    expect(sql).toContain('create index if not exists projects_workspace_id_idx')
    expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+public\.revoke_project_invite\(uuid\)\s+to\s+authenticated/i)
    expect(sql).toMatch(/revoke\s+all\s+on\s+function\s+public\.accept_project_invite\(text\)\s+from\s+public/i)
    expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+public\.accept_project_invite\(text\)\s+to\s+authenticated/i)
  })
})

describe('app decomposition', () => {
  it('keeps the root App component thin by delegating to extracted modules', () => {
    const app = readFileSync(join(root, 'src', 'App.tsx'), 'utf8')
    expect(app).toContain("from './components/Landing'")
    expect(app).toContain("from './components/Dashboard'")
    expect(app).toContain("from './components/AuthPanel'")
    expect(app).toContain("from './components/ErrorBoundary'")
    expect(app.split('\n').length).toBeLessThan(130)
  })
})

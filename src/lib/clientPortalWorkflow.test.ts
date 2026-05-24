import { describe, expect, it } from 'vitest'
import {
  buildInviteUrl,
  canManageProjectData,
  getAuthRedirectUrl,
  isClientMember,
  normalizeInviteToken,
} from './clientPortalWorkflow'

describe('client portal workflow helpers', () => {
  it('normalizes invite tokens from messy pasted URLs', () => {
    expect(normalizeInviteToken('  https://app.example.com/?invite=ABC-123&utm=ignored  ')).toBe('ABC-123')
    expect(normalizeInviteToken('clientflow_INVITE_42')).toBe('clientflow_INVITE_42')
    expect(normalizeInviteToken('')).toBeNull()
  })

  it('builds stable invite URLs without leaking extra query params', () => {
    const url = buildInviteUrl('https://clientflow-lite.vercel.app/dashboard?debug=1', 'abc token')
    expect(url).toBe('https://clientflow-lite.vercel.app/?invite=abc+token')
  })

  it('keeps local auth redirects local unless an env override is provided', () => {
    expect(getAuthRedirectUrl('http://localhost:5173/app', undefined)).toBe('http://localhost:5173')
    expect(getAuthRedirectUrl('https://clientflow-lite.vercel.app/app', undefined)).toBe('https://clientflow-lite.vercel.app')
    expect(getAuthRedirectUrl('http://localhost:5173/app', 'https://custom.example.com/auth')).toBe('https://custom.example.com/auth')
  })

  it('separates client members from operators for write permissions', () => {
    expect(isClientMember('client')).toBe(true)
    expect(canManageProjectData('owner')).toBe(true)
    expect(canManageProjectData('member')).toBe(true)
    expect(canManageProjectData('client')).toBe(false)
  })
})

export type WorkspaceRole = 'owner' | 'member' | 'client'

export function normalizeInviteToken(input: string | null | undefined) {
  const value = input?.trim()
  if (!value) return null

  try {
    const parsed = new URL(value)
    return parsed.searchParams.get('invite')?.trim() || null
  } catch {
    return value
  }
}

export function buildInviteUrl(currentUrl: string, token: string) {
  const url = new URL(currentUrl)
  url.pathname = '/'
  url.search = ''
  url.hash = ''
  url.searchParams.set('invite', token)
  return url.toString()
}

export function getAuthRedirectUrl(currentUrl: string, configured?: string) {
  if (configured?.trim()) return configured.trim()
  return new URL(currentUrl).origin
}

export function isClientMember(role: WorkspaceRole | null | undefined) {
  return role === 'client'
}

export function canManageProjectData(role: WorkspaceRole | null | undefined) {
  return role === 'owner' || role === 'member'
}

export function createInviteToken(byteLength = 24) {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function sha256Hex(value: string) {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

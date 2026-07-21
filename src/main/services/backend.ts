import { BACKEND_BASE_URL } from '../config'
import * as store from './store'

// Client for the Notely backend (~/notely-web): user accounts + metered note generation. The app
// no longer talks to Anthropic directly — it authenticates here with a Bearer token and generates
// through /api/app/generate, which holds the operator's key and enforces the free / Pro / Jots
// limits server-side. The token is stored encrypted in electron-store (see store.getAuthToken).

export interface AuthUser {
  id: string
  email: string
}

export interface AccountSummary {
  email: string
  plan: 'free' | 'pro'
  jotsBalance: number
  freeNotesUsed: number
  freeFiguresUsed: number
  limits: { freeNotes: number; freeFigures: number }
  unlocked: {
    detailed: boolean
    custom: boolean
    opus: boolean
    batch: boolean
    figures: boolean
    notes: boolean
  }
}

export interface PaywallInfo {
  code: 'pro_required' | 'quota_exhausted' | 'figures_exhausted'
  reasons: string[]
}

// Thrown when the backend blocks a generation on entitlement grounds (HTTP 402). Carries the
// structured reason so the renderer can show the right upgrade / top-up prompt.
export class PaywallError extends Error {
  paywall: PaywallInfo
  constructor(paywall: PaywallInfo) {
    super(paywall.code)
    this.name = 'PaywallError'
    this.paywall = paywall
  }
}

// Thrown when there's no valid session (no token, or the backend returned 401). The renderer opens
// the sign-in modal in response.
export class AuthRequiredError extends Error {
  constructor(message = 'Please sign in to continue.') {
    super(message)
    this.name = 'AuthRequiredError'
  }
}

type AuthResult = { ok: true; user: AuthUser } | { ok: false; error: string }

async function authRequest(path: string, email: string, password: string): Promise<AuthResult> {
  let resp: Response
  try {
    resp = await fetch(`${BACKEND_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
  } catch (e) {
    return { ok: false, error: `Couldn't reach the Notely server (${(e as Error).message}).` }
  }
  const data = (await resp.json().catch(() => ({}))) as {
    token?: string
    user?: AuthUser
    error?: string
  }
  if (!resp.ok || !data.token || !data.user) {
    return { ok: false, error: data.error || `Request failed (${resp.status}).` }
  }
  store.setAuthToken(data.token)
  // Pull this account's Notion connection into the local cache so it reflects who just signed in.
  await syncNotion()
  return { ok: true, user: data.user }
}

export function register(email: string, password: string): Promise<AuthResult> {
  return authRequest('/api/auth/register', email, password)
}

export function login(email: string, password: string): Promise<AuthResult> {
  return authRequest('/api/auth/login', email, password)
}

export function logout(): void {
  store.clearAuthToken()
  // Drop the local Notion cache so a signed-out machine shows no Notion and the next account that
  // signs in doesn't inherit this one's connection. (The token stays saved on the backend.)
  store.clearNotionToken()
  store.setNotionWorkspaceName('')
}

export function isAuthed(): boolean {
  return !!store.getAuthToken()
}

// Fetches the current account (plan, Jots, free-tier usage, unlocked flags). Returns null if not
// signed in or the token is no longer valid (in which case the stale token is cleared).
export async function me(): Promise<AccountSummary | null> {
  const token = store.getAuthToken()
  if (!token) return null
  let resp: Response
  try {
    resp = await fetch(`${BACKEND_BASE_URL}/api/auth/me`, {
      headers: { authorization: `Bearer ${token}` }
    })
  } catch {
    return null
  }
  if (resp.status === 401) {
    store.clearAuthToken()
    return null
  }
  if (!resp.ok) return null
  return (await resp.json()) as AccountSummary
}

// --- Notion (account-based) -----------------------------------------------------------------
// The backend is the source of truth for each user's Notion token + workspace; the desktop keeps a
// synced local cache (store.getNotionToken) that all the existing notion:* handlers read.

export interface NotionState {
  configured: boolean
  workspaceName: string
  token: string | null
}

export async function getNotion(): Promise<NotionState | null> {
  const token = store.getAuthToken()
  if (!token) return null
  try {
    const resp = await fetch(`${BACKEND_BASE_URL}/api/app/notion`, {
      headers: { authorization: `Bearer ${token}` }
    })
    if (!resp.ok) return null
    return (await resp.json()) as NotionState
  } catch {
    return null
  }
}

// Persists the account's Notion connection to the backend (best-effort — the local cache still works
// this session if the write fails).
export async function saveNotion(notionToken: string, workspaceName: string): Promise<void> {
  const token = store.getAuthToken()
  if (!token) return
  try {
    await fetch(`${BACKEND_BASE_URL}/api/app/notion`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ token: notionToken, workspaceName })
    })
  } catch {
    /* best-effort */
  }
}

export async function clearNotion(): Promise<void> {
  const token = store.getAuthToken()
  if (!token) return
  try {
    await fetch(`${BACKEND_BASE_URL}/api/app/notion`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` }
    })
  } catch {
    /* best-effort */
  }
}

// Mirrors the account's Notion connection from the backend into the local electron-store cache, so
// the existing notion:* handlers (which read store.getNotionToken()) reflect the signed-in account.
export async function syncNotion(): Promise<void> {
  const state = await getNotion()
  if (state && state.configured && state.token) {
    store.setNotionToken(state.token)
    store.setNotionWorkspaceName(state.workspaceName || '')
  } else {
    store.clearNotionToken()
    store.setNotionWorkspaceName('')
  }
}

export type SourceBlock =
  { type: 'text'; text: string } | { type: 'image'; data: string; mediaType: string }

export interface GeneratePayload {
  unit: string
  topic: string
  options: {
    depth: 'concise' | 'standard' | 'detailed'
    mode: 'notes' | 'math' | 'examples'
    custom: string
  }
  sourceBlocks: SourceBlock[]
  hasFigures?: boolean
  isBatch?: boolean
}

export interface GeneratedNotes {
  title: string
  notes: string
  verified: boolean
}

// The wire shape sent to /api/app/generate — images go as Vercel Blob URLs (see uploadImage), not
// inline base64, so the request body stays small (clears Vercel's 4.5MB limit in production).
type WireBlock = { type: 'text'; text: string } | { type: 'image'; url: string; mediaType: string }

// Uploads one image straight to Vercel Blob via the bearer-authed /api/app/blob-upload endpoint and
// returns its public URL. The bytes never pass through a serverless function, so there's no size cap.
async function uploadImage(dataB64: string, mediaType: string): Promise<string> {
  const token = store.getAuthToken()
  if (!token) throw new AuthRequiredError()
  const ext = (mediaType.split('/')[1] || 'png').replace('+xml', '')
  const filename = `slides/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const blob = new Blob([Buffer.from(dataB64, 'base64')], { type: mediaType })
  // Lazy-loaded so @vercel/blob only runs when an image is actually uploaded — never at app
  // startup, so nothing in its module init can ever block the app from opening.
  const { upload } = await import('@vercel/blob/client')
  const result = await upload(filename, blob, {
    access: 'public',
    handleUploadUrl: `${BACKEND_BASE_URL}/api/app/blob-upload`,
    headers: { authorization: `Bearer ${token}` }
  })
  return result.url
}

// Runs a metered generation on the backend. Streams NDJSON progress; the backend sends per-pass
// deltas plus a `phase` marker when the accuracy pass restarts the text, so we accumulate here and
// hand the renderer the full text-so-far it expects. Throws PaywallError (402) / AuthRequiredError
// (401) so callers can branch to an upgrade prompt or the sign-in modal.
export async function generate(
  payload: GeneratePayload,
  onProgress: (fullText: string) => void
): Promise<GeneratedNotes> {
  const token = store.getAuthToken()
  if (!token) throw new AuthRequiredError()

  // Upload image blocks to Blob and replace them with URLs; text blocks pass through unchanged.
  const wireBlocks: WireBlock[] = await Promise.all(
    payload.sourceBlocks.map(async (b): Promise<WireBlock> => {
      if (b.type === 'text') return b
      const url = await uploadImage(b.data, b.mediaType)
      return { type: 'image', url, mediaType: b.mediaType }
    })
  )

  let resp: Response
  try {
    resp = await fetch(`${BACKEND_BASE_URL}/api/app/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ...payload,
        sourceBlocks: wireBlocks,
        model: store.getAnthropicModelId()
      })
    })
  } catch (e) {
    throw new Error(
      `Couldn't reach the Notely server (${(e as Error).message}). Check your connection.`
    )
  }

  if (resp.status === 401) {
    store.clearAuthToken()
    throw new AuthRequiredError('Your session expired — sign in again.')
  }
  if (resp.status === 402) {
    const data = (await resp.json().catch(() => ({}))) as Partial<PaywallInfo>
    throw new PaywallError({ code: data.code || 'quota_exhausted', reasons: data.reasons || [] })
  }
  if (!resp.ok || !resp.body) {
    const data = (await resp.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || `Generation failed (${resp.status}).`)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let accumulated = ''
  let result: GeneratedNotes | null = null
  let errorMessage: string | null = null

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line) continue
      const obj = JSON.parse(line)
      if (obj.type === 'progress') {
        accumulated += obj.text
        onProgress(accumulated)
      } else if (obj.type === 'phase') {
        // The accuracy pass rewrites the notes from scratch — clear and rebuild.
        accumulated = ''
      } else if (obj.type === 'done') {
        result = obj.result
      } else if (obj.type === 'error') {
        errorMessage = obj.message
      }
    }
  }

  if (errorMessage) throw new Error(errorMessage)
  if (!result) throw new Error('Generation ended without a result.')
  return result
}

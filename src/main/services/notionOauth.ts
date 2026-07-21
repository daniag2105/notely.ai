import http from 'http'
import { AddressInfo } from 'net'
import { randomBytes } from 'crypto'
import { shell } from 'electron'
import * as store from './store'
import * as backend from './backend'
import { NOTION_CLIENT_ID, NOTION_OAUTH_CALLBACK_URL, isNotionOAuthConfigured } from '../config'

// Desktop OAuth for Notion (RFC 8252 loopback). The app opens the system browser to Notion's
// authorize page, the user picks which pages to share in Notion's own UI, and the operator's tiny
// backend (server/notion-oauth) exchanges the code for a long-lived token — the secret it needs
// can't live in the app. The backend redirects back to a temporary localhost server we run here,
// carrying the token, which we then store encrypted. `state` carries our loopback port + a random
// nonce so the backend knows where to return to and we can reject anything that doesn't match.

const AUTHORIZE_URL = 'https://api.notion.com/v1/oauth/authorize'
const TIMEOUT_MS = 5 * 60 * 1000

export interface ConnectResult {
  ok: boolean
  workspaceName?: string
  error?: string
}

let inFlight = false

export function connectNotion(): Promise<ConnectResult> {
  if (!isNotionOAuthConfigured()) {
    return Promise.resolve({
      ok: false,
      error:
        'This build has no Notion connection configured. Use "paste a token instead", or set up the OAuth backend (see server/notion-oauth).'
    })
  }
  if (inFlight) {
    return Promise.resolve({
      ok: false,
      error: 'A Notion connection is already in progress — finish it in your browser.'
    })
  }
  inFlight = true

  return new Promise<ConnectResult>((resolve) => {
    const nonce = randomBytes(16).toString('hex')
    let settled = false
    let timer: NodeJS.Timeout

    const finish = (result: ConnectResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      server.close()
      inFlight = false
      resolve(result)
    }

    const server = http.createServer(async (req, res) => {
      const reqUrl = new URL(req.url || '/', 'http://127.0.0.1')
      if (reqUrl.pathname !== '/notion-callback') {
        res.writeHead(404).end('Not found')
        return
      }

      const done = (statusCode: number, message: string, result: ConnectResult): void => {
        res.writeHead(statusCode, { 'content-type': 'text/html; charset=utf-8' }).end(page(message))
        finish(result)
      }

      if (reqUrl.searchParams.get('state') !== nonce) {
        done(400, 'Something went wrong (state mismatch). Please try connecting again.', {
          ok: false,
          error: 'State mismatch — please try connecting again.'
        })
        return
      }
      const err = reqUrl.searchParams.get('error')
      if (err) {
        done(400, 'Notion connection was cancelled or failed. You can close this tab.', {
          ok: false,
          error: humanizeError(err)
        })
        return
      }
      const token = reqUrl.searchParams.get('access_token')
      if (!token) {
        done(400, 'No access token was received. Please try again.', {
          ok: false,
          error: 'No access token received from Notion.'
        })
        return
      }

      const workspaceName = reqUrl.searchParams.get('workspace_name') || ''
      store.setNotionToken(token)
      store.setNotionWorkspaceName(workspaceName)
      // Persist to the signed-in account so this Notion connection follows the user, not the device.
      await backend.saveNotion(token, workspaceName)
      done(200, '✓ Connected! You can close this tab and return to Notely.ai.', {
        ok: true,
        workspaceName
      })
    })

    server.on('error', (e) =>
      finish({
        ok: false,
        error: `Couldn't start the local callback server (${(e as Error).message}).`
      })
    )

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo | null
      if (!addr || typeof addr === 'string') {
        finish({ ok: false, error: 'Could not determine a local callback port.' })
        return
      }
      const state = Buffer.from(JSON.stringify({ port: addr.port, nonce })).toString('base64url')
      const authUrl = new URL(AUTHORIZE_URL)
      authUrl.searchParams.set('client_id', NOTION_CLIENT_ID)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('owner', 'user')
      authUrl.searchParams.set('redirect_uri', NOTION_OAUTH_CALLBACK_URL)
      authUrl.searchParams.set('state', state)
      shell.openExternal(authUrl.toString())
      timer = setTimeout(
        () => finish({ ok: false, error: 'Timed out waiting for Notion. Please try again.' }),
        TIMEOUT_MS
      )
    })
  })
}

export function disconnectNotion(): void {
  store.clearNotionToken()
  store.setNotionWorkspaceName('')
}

function humanizeError(code: string): string {
  if (code === 'access_denied') return 'You cancelled the Notion connection.'
  return `Notion connection failed (${code}).`
}

function page(message: string): string {
  return `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:48px;max-width:520px;margin:auto;text-align:center"><h2 style="font-family:Georgia,serif;margin-bottom:8px">Notely.ai</h2><p style="font-size:16px;color:#333">${message}</p></body>`
}

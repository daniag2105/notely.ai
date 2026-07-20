// Stateless Notion OAuth token-exchange endpoint for Notely.ai.
//
// Notion requires a client SECRET to exchange the authorization code for a token (it has no PKCE),
// so that secret can't live inside the downloaded desktop app. This tiny endpoint holds the secret
// server-side, does the exchange, and hands the resulting long-lived access token back to the app
// via a loopback redirect (http://127.0.0.1:<port>, which only exists on the user's own machine).
//
// It stores nothing and never logs tokens. Config comes from two secrets set by the operator:
//   npx wrangler secret put NOTION_CLIENT_ID
//   npx wrangler secret put NOTION_CLIENT_SECRET

const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token'
const CALLBACK_PATH = '/notion/callback'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname !== CALLBACK_PATH) {
      return html('Not found.', 404)
    }

    // state carries where to hand the token back to: { port, nonce } for the app's loopback server.
    // Decode it first and refuse anything malformed, so we can only ever redirect to 127.0.0.1.
    const target = decodeState(url.searchParams.get('state'))
    if (!target) {
      return html('Invalid or missing state. Please start again from Notely.ai.', 400)
    }

    const back = (params) => {
      const u = new URL(`http://127.0.0.1:${target.port}/notion-callback`)
      u.searchParams.set('state', target.nonce)
      for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
      return Response.redirect(u.toString(), 302)
    }

    const oauthError = url.searchParams.get('error')
    if (oauthError) return back({ error: oauthError })

    const code = url.searchParams.get('code')
    if (!code) return back({ error: 'missing_code' })

    if (!env.NOTION_CLIENT_ID || !env.NOTION_CLIENT_SECRET) {
      return html('Server is not configured (missing NOTION_CLIENT_ID / NOTION_CLIENT_SECRET).', 500)
    }

    let data
    try {
      const resp = await fetch(NOTION_TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`)}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: `${url.origin}${CALLBACK_PATH}`
        })
      })
      data = await resp.json()
      if (!resp.ok) return back({ error: data.error || `notion_${resp.status}` })
    } catch {
      return back({ error: 'exchange_failed' })
    }

    if (!data.access_token) return back({ error: 'no_access_token' })
    return back({ access_token: data.access_token, workspace_name: data.workspace_name || '' })
  }
}

// state is base64url(JSON({ port, nonce })) produced by the app. Restore padding for atob.
function decodeState(state) {
  if (!state) return null
  try {
    let b64 = state.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const obj = JSON.parse(atob(b64))
    const port = Number(obj.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null
    if (typeof obj.nonce !== 'string' || !obj.nonce) return null
    return { port, nonce: obj.nonce }
  } catch {
    return null
  }
}

function html(message, status) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:48px;max-width:520px;margin:auto;text-align:center"><h2 style="font-family:Georgia,serif">Notely.ai — Notion</h2><p style="font-size:16px">${message}</p></body>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } }
  )
}

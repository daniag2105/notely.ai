import { is } from '@electron-toolkit/utils'

// Public, non-secret configuration for the "Connect Notion" OAuth flow.
//
// These two values are safe to commit and to ship inside the app — they are NOT secrets. The
// Notion *client secret* never appears in the app; it lives only in the operator's backend (see
// server/notion-oauth/). To enable "Connect Notion" in your own build, deploy that backend and
// fill both values in below with your own Notion client id + deployed callback URL.
//
// Left as placeholders, the app falls back to the manual "paste a token" flow and the Connect
// button explains that this build has no Notion client configured.

export const NOTION_CLIENT_ID = '3a2d872b-594c-81b5-8ab4-00373fe16336'
export const NOTION_OAUTH_CALLBACK_URL =
  'https://notely-notion-oauth.daniag2105.workers.dev/notion/callback'

export function isNotionOAuthConfigured(): boolean {
  return (
    !NOTION_CLIENT_ID.startsWith('YOUR_') &&
    !NOTION_OAUTH_CALLBACK_URL.includes('YOUR-BACKEND-HOST')
  )
}

// Base URL of the Notely backend — user accounts + metered note generation live here (the
// ~/notely-web project). The app signs in against it and generates through it (it holds the
// operator's Anthropic key and enforces the free/Pro/Jots limits).
//
// Dev (`npm run dev`) → the local Next.js server. A packaged/distributed build → production.
// This is the project's stable Vercel production alias (team notelyai / project notely.ai) — it
// always points at the latest production deploy. If you later add a custom domain (e.g. notely.ai),
// change this one line and rebuild the app. Override either at launch with NOTELY_BACKEND_URL.
const PROD_BACKEND_URL = 'https://notelyai-pearl.vercel.app'
export const BACKEND_BASE_URL =
  process.env.NOTELY_BACKEND_URL || (is.dev ? 'http://localhost:3000' : PROD_BACKEND_URL)

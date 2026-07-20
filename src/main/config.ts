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
export const NOTION_OAUTH_CALLBACK_URL = 'https://notely-notion-oauth.daniag2105.workers.dev/notion/callback'

export function isNotionOAuthConfigured(): boolean {
  return !NOTION_CLIENT_ID.startsWith('YOUR_') && !NOTION_OAUTH_CALLBACK_URL.includes('YOUR-BACKEND-HOST')
}

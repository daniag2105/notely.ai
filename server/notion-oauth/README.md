# Notely.ai — Notion OAuth backend

A tiny, stateless endpoint that lets Notely.ai offer a one-click **Connect Notion** button instead
of asking every user to copy an integration token and share pages by hand.

Notion requires a **client secret** to turn the login into an access token (it has no PKCE), and a
secret can't safely ship inside a downloaded app. So this endpoint holds the secret, does the
exchange, and hands the resulting token back to the app over a loopback redirect. It **stores
nothing** and **never logs tokens**.

You deploy this **once**. After that, everyone using the app connects Notion through it.

---

## 1. Create a Notion public integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) → **New integration**.
2. Set the type to **Public** and fill in the basic info (name "Notely.ai", etc.).
3. You'll get a **Client ID** and **Client Secret** — keep these handy.
4. Under **OAuth Domain & URIs**, add a **Redirect URI**. You'll set this to your deployed backend
   URL + `/notion/callback` (you'll have the URL after step 2 below), e.g.
   `https://notely-notion-oauth.<your-subdomain>.workers.dev/notion/callback`.

## 2. Deploy this backend (Cloudflare Workers — free)

From this folder:

```bash
npx wrangler login          # opens the browser to authorize (one time)
npx wrangler deploy         # deploys and prints your Worker URL
```

Then set the two secrets (you paste the values yourself when prompted — they never go in a file):

```bash
npx wrangler secret put NOTION_CLIENT_ID
npx wrangler secret put NOTION_CLIENT_SECRET
```

Your callback URL is the printed Worker URL + `/notion/callback`. Go back to the Notion integration
(step 1.4) and make sure that exact URL is registered as the Redirect URI.

> **Prefer Vercel?** This is a single tiny endpoint and isn't affected by Vercel's body/duration
> limits. You can port `src/index.js` to a Vercel Function at `api/notion/callback` and set
> `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` as project env vars instead. The logic is identical.

## 3. Point the app at your backend

In the app, edit [`src/main/config.ts`](../../src/main/config.ts):

```ts
export const NOTION_CLIENT_ID = '<your Notion client id>'
export const NOTION_OAUTH_CALLBACK_URL = 'https://<your worker url>/notion/callback'
```

Rebuild the app (`npm run build:mac` / `build:win`). Done — **Connect Notion** now works for anyone
running that build.

## How it works (for reference)

1. The app opens the system browser to Notion's authorize URL, passing a `state` that encodes the
   app's temporary loopback port + a random nonce.
2. The user picks which pages to share in Notion's own UI and authorizes.
3. Notion redirects here (`/notion/callback`) with a `code`. This endpoint exchanges it for a
   long-lived access token using the client secret.
4. It 302-redirects the browser to `http://127.0.0.1:<port>/notion-callback?access_token=…`, which
   the app is listening on. The app verifies the nonce and stores the token encrypted (macOS
   Keychain / Windows DPAPI).

No database, no sessions, no per-use cost — each user's token only ever touches their own Notion
workspace.

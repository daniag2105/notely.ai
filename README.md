# Notely.ai

Turn lecture slides + a transcript into clean, **Notion-ready notes** — routed straight to the
right unit and topic page. Notely.ai is a Mac app: you drop a slide deck and paste the transcript,
Claude writes structured study notes, and (optionally) files them into your Notion workspace.

Notely.ai uses **Claude** to write the notes. You bring your own Anthropic API key — it's stored
encrypted on your Mac (macOS Keychain) and only ever used to call Anthropic directly.

---

## What you'll need

- **macOS**
- **Node.js** (LTS) — install from [nodejs.org](https://nodejs.org) if you don't have it
- **An Anthropic API key** — from [console.anthropic.com](https://console.anthropic.com) (billed
  by Anthropic per usage; you control the spend)
- **A Notion integration token** *(optional)* — only needed for "Send to Notion"

## Install

```bash
git clone https://github.com/daniag2105/notely.ai.git
cd notely.ai
npm run setup
```

`npm run setup` installs everything and builds the app. When it finishes, open the `.dmg` it
created in the `dist/` folder and drag **Notely.ai** into Applications.

> First launch: because the app is unsigned (you built it yourself), macOS shows an "unidentified
> developer" warning. Right-click the app ▸ **Open** once to get past it.

## First use

1. Open Notely.ai and click **Settings**.
2. Paste your **Anthropic API key** (`sk-ant-…`). That's all you need to start generating.
3. *(Optional)* Paste your **Notion integration token** to enable "Send to Notion" — see below.
4. Close Settings, pick a **unit** and **topic**, drop your slides + transcript, and hit
   **Generate**.

## Getting the keys

### Anthropic API key (required)
1. Go to [console.anthropic.com](https://console.anthropic.com) → **API Keys** → create a key.
2. Copy it and paste it into Notely.ai's Settings. It's stored encrypted locally and only ever
   sent to Anthropic's API over HTTPS.

### Notion integration token (optional — for "Send to Notion")
1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) → **New integration** →
   copy the **Internal Integration Secret** (`ntn_…`).
2. Paste it into Notely.ai's Settings.
3. **Important:** in Notion, open the page(s) you want notes filed under, click the **•••** menu →
   **Connections** → add your integration. Without this sharing step, Notion won't let the app
   write to your pages (this is the most common setup snag).

## Everyday use

Slides + transcript → **Generate** → review the notes → **Send to Notion** (or copy the markdown).
Notes are routed to the unit/topic you selected, creating the pages if needed.

## Troubleshooting

- **"unidentified developer"** on launch → right-click the app ▸ **Open** (once).
- **Notion says it can't find / write the page** → re-check that you shared the page with your
  integration (the ••• ▸ Connections step above).
- **Generation errors about the API key** → confirm the key is pasted in Settings and still active
  in the Anthropic console.

## Developing

```bash
npm install        # install dependencies
npm run dev        # run the app in development
npm run build:mac  # build the macOS app + .dmg into dist/
npm run typecheck  # type-check main + renderer
```

Built with Electron + React + TypeScript.

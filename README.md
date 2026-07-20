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
- **A Notion account** *(optional)* — to file notes into Notion; you link it in-app with one click,
  no token to copy

## Install

> **On Windows?** Follow **[README-windows.md](README-windows.md)** instead.

### Easiest — no commands
1. Install **Node.js** (LTS) from [nodejs.org](https://nodejs.org) if you don't have it.
2. On the [repo page](https://github.com/daniag2105/notely.ai), click the green **Code** button →
   **Download ZIP**, then unzip it.
3. Open the unzipped folder and **double-click `setup.command`**. It installs everything, builds
   the app, and opens the installer for you — just wait for it to finish, then drag **Notely.ai**
   into Applications.

> First time you double-click `setup.command`, macOS may say it "can't be opened." Right-click it ▸
> **Open** ▸ **Open** once, and it'll run.

### With a terminal
```bash
git clone https://github.com/daniag2105/notely.ai.git
cd notely.ai
npm run setup
```
`npm run setup` installs everything and builds the app; then open the `.dmg` in the `dist/` folder
and drag **Notely.ai** into Applications.

> First launch: because the app is unsigned (you built it yourself), macOS shows an "unidentified
> developer" warning. Right-click the app ▸ **Open** once to get past it.

## First use

1. Open Notely.ai and click **Settings**.
2. Paste your **Anthropic API key** (`sk-ant-…`). That's all you need to start generating.
3. *(Optional)* Click **Connect Notion** to link your workspace and enable "Send to Notion" — see
   below.
4. Close Settings, pick a **unit** and **topic**, drop your slides + transcript, and hit
   **Generate**.

## Getting set up

### Anthropic API key (required)
1. Go to [console.anthropic.com](https://console.anthropic.com) → **API Keys** → create a key.
2. Copy it and paste it into Notely.ai's Settings. It's stored encrypted locally and only ever
   sent to Anthropic's API over HTTPS.

### Connecting Notion (optional — for "Send to Notion")
In Settings, click **Connect Notion**. Your browser opens, you choose which pages Notely.ai may
write to — right inside Notion's own picker — and you're done. No token to copy, and no hunting
through the ••• → Connections menu to share pages one by one.

Prefer to do it by hand? Click **"paste a token instead"** in Settings and use an internal
integration token from [notion.so/my-integrations](https://www.notion.so/my-integrations) (then
share your pages with it via the ••• → **Connections** menu).

> **Maintainer note:** the one-click **Connect Notion** button requires a small OAuth backend to be
> deployed once — see [`server/notion-oauth/README.md`](server/notion-oauth/README.md). Until that's
> set up, use the "paste a token instead" option.

## Everyday use

Slides + transcript → **Generate** → review the notes → **Send to Notion** (or copy the markdown).
Notes are routed to the unit/topic you selected, creating the pages if needed.

## Troubleshooting

- **"unidentified developer"** on launch → right-click the app ▸ **Open** (once).
- **Notion says it can't find / write the page** → make sure that page (or one of its parents) was
  selected when you clicked **Connect Notion**. You can re-run Connect and pick more pages.
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

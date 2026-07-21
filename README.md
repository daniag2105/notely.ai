# Notely.ai

Turn lecture slides + a transcript into clean, **Notion-ready notes** — routed straight to the
right unit and topic page. Drop a slide deck, paste the transcript, and Claude writes structured
study notes you can send into your Notion workspace.

**No API key needed.** Notes are generated on Notely.ai's servers. You just make a free account in
the app — your first **5 notes are free**, then you can upgrade to Pro or top up with Jots.

> 📖 **New here?** Read **[HOW-TO-USE.md](HOW-TO-USE.md)** — a plain-English, step-by-step guide to
> using the app.

---

## What you'll need

- **macOS**
- **Node.js (LTS)** — only needed to *build* the app. Install from [nodejs.org](https://nodejs.org)
  if you don't have it. *(Once a ready-made installer is published, you won't need this.)*
- **A Notely.ai account** — you make it inside the app in a few seconds (email + password). Free.
- **A Notion account** *(optional)* — only if you want to send notes into Notion. You link it with
  one click, no token to copy.

## Install

> **On Windows?** Follow **[README-windows.md](README-windows.md)** instead.

### Easiest — no commands
1. Install **Node.js (LTS)** from [nodejs.org](https://nodejs.org) if you don't have it.
2. On the [repo page](https://github.com/daniag2105/notely.ai), click the green **Code** button →
   **Download ZIP**, then unzip it.
3. Open the unzipped folder and **double-click `setup.command`**. It installs everything and builds
   the app, then opens the installer — wait for it to finish, then drag **Notely.ai** into
   Applications.

> First time you double-click `setup.command`, macOS may say it "can't be opened." Right-click it ▸
> **Open** ▸ **Open** once, and it'll run.

### With a terminal
```bash
git clone https://github.com/daniag2105/notely.ai.git
cd notely.ai
npm run setup
```
`npm run setup` installs everything and builds the app; then open the `.dmg` in `dist/` and drag
**Notely.ai** into Applications.

> First launch: because the app is unsigned (you built it yourself), macOS shows an "unidentified
> developer" warning. Right-click the app ▸ **Open** once to get past it.

## First use

1. Open Notely.ai. A sign-in box appears — click **Create an account**, enter an email + password
   (8+ characters). Your first **5 notes are free**.
2. *(Optional)* Open **Settings ▸ Connect Notion** to link your workspace and turn on "Send to
   Notion".
3. Pick a **unit**, type a **topic**, add your slides + transcript, and hit **Generate**.

👉 Full walkthrough: **[HOW-TO-USE.md](HOW-TO-USE.md)**.

## Sending notes to Notion (optional)

Open **Settings ▸ Connect Notion**. Your browser opens, you tick which pages Notely.ai may write to —
in Notion's own screen — and you're done. No token to copy, no sharing pages one by one.

**This already works in the official build** — the one-time Notion login backend is deployed and
wired in, so there's nothing for you to set up. *(The [`server/notion-oauth`](server/notion-oauth)
folder is only relevant if you fork the project and want your **own** Notion integration.)*

Prefer to do it by hand? Click **"paste a token instead"** in Settings and use an internal
integration token from [notion.so/my-integrations](https://www.notion.so/my-integrations).

## Running out of free notes

Your first 5 notes are free. After that, open **Settings** to **upgrade to Pro** (unlimited) or buy
**Jots** (pay-as-you-go top-ups). A few extras — batch import, the Opus model, and slide-figure
extraction — are Pro features.

## Appearance

**Settings ▸ Appearance** lets you switch between **System / Light / Dark**, and drag the **accent
colour** slider to re-theme the whole app (the pink is just the default).

## Troubleshooting

- **"unidentified developer"** on launch → right-click the app ▸ **Open** (once).
- **Can't sign in / "something went wrong"** → check your email + password (8+ characters) and that
  you're online.
- **"You've used all 5 free notes"** → upgrade to Pro or add Jots in **Settings**.
- **Notion says it can't find / write the page** → make sure that page (or one of its parents) was
  ticked when you clicked **Connect Notion**. You can re-run Connect and add more pages.

## Developing

```bash
npm install        # install dependencies
npm run dev        # run the app in development (signs in against a local backend on :3000)
npm run build:mac  # build the macOS app + .dmg into dist/
npm run typecheck  # type-check main + renderer
```

Built with Electron + React + TypeScript. The app talks to two backends that are **already deployed**
(one-time operator infrastructure, not built by `setup.command`): the Notely.ai backend for accounts
+ note generation, and a tiny Notion-login worker ([`server/notion-oauth`](server/notion-oauth)).

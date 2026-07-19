# Notely.ai — Windows setup

Notely.ai is built with Electron, so it runs on Windows too — the app code is fully
cross-platform (key encryption uses Windows' built-in DPAPI, same idea as the Mac Keychain).

The one difference from the Mac instructions: the `npm run setup` shortcut is Mac-only, so on
Windows you run the steps below directly. They all work in **Command Prompt** or **PowerShell** —
no bash or WSL needed.

> You have to do this **on the Windows machine itself** — a Windows app can't be built from a Mac.

---

## What you'll need

- **Windows 10 or 11**
- **Node.js** (LTS) — from [nodejs.org](https://nodejs.org)
- **An Anthropic API key** — from [console.anthropic.com](https://console.anthropic.com) (billed
  by Anthropic per usage; you control the spend)
- **A Notion integration token** *(optional)* — only needed for "Send to Notion"

## Easiest — no commands

1. Install **Node.js** (LTS) from [nodejs.org](https://nodejs.org) if you don't have it.
2. On the [repo page](https://github.com/daniag2105/notely.ai), click the green **Code** button →
   **Download ZIP**, then unzip it.
3. Open the unzipped folder and **double-click `setup.bat`**. It installs everything, builds the
   app, and opens the `dist` folder with the installer — just wait for it to finish, then run the
   installer (`notely-…-setup.exe`) inside.

> Windows may show a blue **"Windows protected your PC"** box (for the script and again for the
> installer, since the app isn't code-signed). Click **More info → Run anyway** — it's expected for
> an app you built yourself.

Then skip to [step 6 (add your keys)](#6-add-your-keys). Prefer to do it manually with a terminal?
Use the steps below instead.

---

## 1. Install Node.js

Download the **LTS** installer from [nodejs.org](https://nodejs.org) and run it, clicking through
the defaults. This installs `node` and `npm`.

## 2. Get the code

**With Git:**
```
git clone https://github.com/daniag2105/notely.ai.git
cd notely.ai
```

**Without Git:** open the [repo on GitHub](https://github.com/daniag2105/notely.ai) → green
**Code** button → **Download ZIP** → extract it → open that folder in a terminal.

## 3. Install dependencies

```
npm install
```

## 4. Run it — pick one

**Option A — build a real installer (recommended):**
```
npm run build:win
```
This creates an installer in the `dist\` folder (e.g. `notely-1.0.0-setup.exe`). Double-click it to
install Notely.ai like a normal Windows program.

**Option B — just launch it (no install):**
```
npm run dev
```
Opens the app directly. Simpler, but it only runs while that terminal window stays open.

## 5. First launch

Windows may show a blue **"Windows protected your PC"** SmartScreen warning, because the app isn't
code-signed. Click **More info → Run anyway**. (This is the Windows equivalent of the Mac
right-click ▸ Open step — it's expected for an app you built yourself.)

## 6. Add your keys

Open the app → **Settings** → paste your **Anthropic API key** (`sk-ant-…`, required). Optionally
add your **Notion integration token** (`ntn_…`) to enable "Send to Notion".

For how to get each token (including the Notion "share the page with your integration" step), see
the [main README](README.md#getting-the-keys) — that part is identical to macOS.

## Troubleshooting

- **"Windows protected your PC"** on launch → **More info → Run anyway** (once).
- **`npm install` fails** → make sure Node.js installed correctly; close and reopen your terminal
  so it picks up `node`/`npm`, then try again.
- **Notion says it can't find / write the page** → re-check that you shared the target page with
  your integration in Notion (••• menu → **Connections**).
- **Generation errors about the API key** → confirm the key is pasted in Settings and still active
  in the Anthropic console.

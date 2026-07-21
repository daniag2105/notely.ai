# Notely.ai — Windows setup

Notely.ai is built with Electron, so it runs on Windows too — the app code is fully cross-platform
(key encryption uses Windows' built-in DPAPI, same idea as the Mac Keychain).

The one difference from the Mac instructions: the `npm run setup` shortcut is Mac-only, so on
Windows you run the steps below directly. They all work in **Command Prompt** or **PowerShell** — no
bash or WSL needed.

> You have to do this **on the Windows machine itself** — a Windows app can't be built from a Mac.

> 📖 **New here?** Once it's installed, read **[HOW-TO-USE.md](HOW-TO-USE.md)** — a plain-English,
> step-by-step guide to using the app.

---

## What you'll need

- **Windows 10 or 11**
- **Node.js (LTS)** — from [nodejs.org](https://nodejs.org). Only needed to *build* the app.
- **A Notely.ai account** — you make it inside the app in a few seconds (email + password). Free,
  and gives you your first **5 notes free**. *No API key needed — notes are generated on Notely.ai's
  servers.*
- **A Notion account** *(optional)* — only if you want to send notes into Notion. Linked with one
  click in the app.

## Easiest — no commands

1. Install **Node.js (LTS)** from [nodejs.org](https://nodejs.org) if you don't have it.
2. On the [repo page](https://github.com/daniag2105/notely.ai), click the green **Code** button →
   **Download ZIP**, then unzip it.
3. Open the unzipped folder and **double-click `setup.bat`**. It installs everything, builds the
   app, and opens the `dist` folder with the installer — wait for it to finish, then run the
   installer (`notely-…-setup.exe`) inside.

> Windows may show a blue **"Windows protected your PC"** box (for the script, and again for the
> installer, since the app isn't code-signed). Click **More info → Run anyway** — it's expected for
> an app you built yourself.

Then open the app and **[create your account](#5-first-run)**. Prefer to do it manually with a
terminal? Use the steps below.

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

## 5. First run

Windows may show a blue **"Windows protected your PC"** SmartScreen warning, because the app isn't
code-signed. Click **More info → Run anyway**. (This is the Windows equivalent of the Mac
right-click ▸ Open step — it's expected for an app you built yourself.)

Then, in the app:

1. A sign-in box appears — click **Create an account** and enter an email + password (8+
   characters). Your first **5 notes are free**.
2. *(Optional)* Open **Settings ▸ Connect Notion** to link your workspace and turn on "Send to
   Notion". This already works — nothing to set up.
3. Pick a **unit**, type a **topic**, add your slides + transcript, and hit **Generate**.

👉 Full walkthrough: **[HOW-TO-USE.md](HOW-TO-USE.md)**.

## Running out of free notes

Your first 5 notes are free. After that, open **Settings** to **upgrade to Pro** (unlimited) or buy
**Jots** (pay-as-you-go top-ups).

## Troubleshooting

- **"Windows protected your PC"** on launch → **More info → Run anyway** (once).
- **`npm install` fails** → make sure Node.js installed correctly; close and reopen your terminal so
  it picks up `node`/`npm`, then try again.
- **Can't sign in / "something went wrong"** → check your email + password (8+ characters) and that
  you're online.
- **"You've used all 5 free notes"** → upgrade to Pro or add Jots in **Settings**.
- **Notion says it can't find / write the page** → re-run **Connect Notion** in Settings and make
  sure you tick the target page (or one of its parents).

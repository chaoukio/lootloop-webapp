# LootLoop — from web app to real Android app

This folder is a complete, real website project (not a demo/preview) for
LootLoop. Follow these steps in order.

## Part A — Put the project on GitHub

1. Go to https://github.com/new
2. Repository name: `lootloop-webapp`
3. Public, don't add a README (we already have files)
4. Create it
5. On the empty repo page, tap **"uploading an existing file"**
6. Upload ALL of these files, keeping the folder structure:
   - `index.html`
   - `package.json`
   - `vite.config.js`
   - `src/App.jsx`
   - `src/main.jsx`
   - `public/manifest.json`
   - `public/sw.js`
   - `public/icon-192.png`
   - `public/icon-512.png`

   Tip: GitHub's upload page lets you drag a whole folder, or upload the
   `src` files together and `public` files together — as long as the
   final repo shows `src/App.jsx` and `public/manifest.json` etc. in the
   right folders, it's fine.
7. Commit changes.

## Part B — Deploy it as a real website on Vercel

1. Go to https://vercel.com and sign up with GitHub
2. Click **"Add New..." → "Project"**
3. Import your `lootloop-webapp` repository
4. Vercel auto-detects it's a Vite project — leave all settings default
5. Click **Deploy**

After a minute you'll get a real live URL like:
`https://lootloop-webapp.vercel.app`

Open it — you should see the full LootLoop app working, installable, and
saving your balance in the browser (this uses real `localStorage` now,
not the temporary Claude preview storage).

## Part C — Turn it into a real Android app (APK)

1. Go to https://www.pwabuilder.com
2. Paste your Vercel URL (e.g. `https://lootloop-webapp.vercel.app`)
3. Click **Start**
4. PWABuilder will scan the site and confirm it's installable (green
   checks for Manifest and Service Worker — we've already set both up)
5. Click **Package for stores** → choose **Android**
6. Leave default settings (package ID will look like
   `com.lootloop.twa` — you can rename it) → **Generate**
7. Download the generated `.zip` — inside it you'll find a **signed
   APK** you can install directly on any Android phone (enable "install
   from unknown sources" if prompted), plus an **.aab** file, which is
   what you'd upload to Google Play if you want to publish it there
   later (requires a one-time $25 Google Play Developer account).

## What still needs real accounts before this makes real money
- The `POSTBACK_SERVER_URL` in `App.jsx` already points at your live
  Render server, so real CPX Research earnings will show up correctly
  even in the Android app.
- The demo offers (`SEED_OFFERS`) and the cash-out flow are still mock —
  those are separate upgrades we can tackle next.

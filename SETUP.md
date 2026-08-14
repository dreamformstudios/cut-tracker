# Setup

Four steps. Step 1 is the only one that matters — after it you have a working app on
your phone and your Mac. Steps 2–4 add cloud sync, the big food database, and the
app icon. Nothing here costs money.

Total time: about 25 minutes, most of it waiting.

---

## Step 1 — Put it on the web (10 min)

You need a free GitHub account. This gives you a permanent web address for the app.

1. Go to **github.com** and sign up (free). Pick a username you don't mind seeing in
   the address — it becomes part of your URL.

2. Click the **+** in the top-right corner → **New repository**.
   - **Repository name:** `cut-tracker`
   - **Public** (required — GitHub Pages needs public on the free plan; nobody will
     find it, and none of your food data lives here)
   - Click **Create repository**

3. On the next page, click the link **uploading an existing file**.

4. Drag in **everything from the `cut-tracker` folder** — all the files *and* the
   `icons` folder. Drop them all at once so the folder structure is preserved.
   You should see: `index.html`, `app.js`, `styles.css`, `foods.js`, `config.js`,
   `sw.js`, `manifest.webmanifest`, `icons/`, plus the docs.

5. Scroll down, click **Commit changes**.

6. Click **Settings** (top of the repo) → **Pages** in the left sidebar.
   - **Source:** Deploy from a branch
   - **Branch:** `main`, folder `/ (root)`
   - Click **Save**

7. Wait 1–2 minutes, then reload that Settings → Pages screen. It will show your
   address near the top:

   ```
   https://YOUR-USERNAME.github.io/cut-tracker/
   ```

**Open that address. The tracker works right now** — food logging, macros, weight,
projections, offline. Everything below is optional.

> Bookmark that URL and text it to yourself. It is the app.

---

## Step 2 — Cloud sync (10 min)

This is what lets you log lunch on your phone and see it on your Mac.

1. Go to **supabase.com** → **Start your project** → sign in with your GitHub account.

2. **New project.**
   - Name: `cut-tracker`
   - Database password: click Generate, then save it in your password manager.
     (You won't need it for the app, but you'll want it later.)
   - Region: pick the one nearest you.
   - Click **Create new project** and wait ~2 minutes while it provisions.

3. In the left sidebar click **SQL Editor** → **New query**. Open the file
   `supabase-schema.sql`, copy the whole thing, paste it in, and click **Run**.
   You should see "Success. No rows returned." That created your two tables and
   locked them down so only you can read your own rows.

4. **Turn off email confirmation** so you can sign in immediately.
   In the left sidebar: **Authentication** → **Sign In / Providers** → **Email**.
   Find **Confirm email** and switch it **off**. Save.

   *(Supabase moves this setting around between versions. If you don't see it there,
   look under Authentication → Providers → Email, or Authentication → Settings. You're
   looking for a toggle with "Confirm email" in the name.)*

5. Get your two keys: **Project Settings** (gear icon) → **API Keys**.
   Copy the **Project URL** and the **anon / public** key.

   > The anon key is *designed* to be public and sits in browser code — that is normal
   > and safe. The row-level security you set up in step 3 is what protects your data:
   > without your password, that key can't read a single row.

6. Put them in the app. Back on GitHub, open your repo, click **config.js**, click the
   **pencil icon** to edit, and replace the two placeholder values:

   ```js
   SUPABASE_URL:      "https://abcdefgh.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi....(long string)",
   ```

   Click **Commit changes**. Wait ~1 minute for GitHub to republish.

7. Reload the app → **Settings** tab → **Account & sync** → enter your email and a
   password (6+ characters) → **Create account**. Do the same on your phone with the
   *same* email and password, and the two stay in step automatically.

---

## Step 3 — The big food database (2 min)

Without this you get the ~200 built-in foods, which covers most home cooking. With it
you get several hundred thousand, including brand-name packaged products.

1. Go to **fdc.nal.usda.gov/api-key-signup** and fill in the short form.
2. The key arrives by email within a minute or two.
3. On GitHub, edit `config.js` again and paste it in:

   ```js
   USDA_API_KEY: "your-key-here"
   ```

4. Commit, wait a minute, reload. Search results now show USDA matches in blue
   underneath the built-in ones.

---

## Step 4 — Install it as an app (2 min)

**iPhone:** open the URL in **Safari** (not Chrome — only Safari can install apps on
iOS). Tap the Share button → **Add to Home Screen**. You get an icon and a full-screen
app with no browser bar.

**Mac, Safari:** open the URL → **File** → **Add to Dock**.

**Mac, Chrome:** open the URL → look for an install icon in the right side of the
address bar, or **⋮** → **Cast, save and share** → **Install page as app**.

---

## When you change something later

Every time you edit a file on GitHub, it takes about a minute to go live. If the app
looks unchanged after that, force a fresh load: **Cmd-Shift-R** on Mac. On an installed
iPhone app, close it from the app switcher and reopen.

---

## Troubleshooting

**"Sync error" in the corner.**
Open Settings → Account & sync → Sync now, and read the message. Most often it's
step 2.3 — the SQL never ran, so the tables don't exist.

**"No session returned" when creating an account.**
Email confirmation is still on. Go back to step 2.4.

**Signed in on both devices but nothing appears.**
Check both are using the *same* email. Then hit Sync now on each. Sync also fires
automatically whenever you switch back to the app.

**USDA search says "unavailable".**
Either the key is wrong, or you've hit the free rate limit (1,000 searches an hour —
you will not hit this). The built-in foods keep working regardless.

**I lost my log.**
If you set up sync, sign in again and it comes straight back from the server. If you
didn't, check Settings → Data for a backup file you downloaded earlier. This is the
reason step 2 is worth the ten minutes.

**Everything is broken and I want to start over.**
Settings → Data → Erase all data wipes this device. Your account keeps its copy, so
sign out first if you truly want a clean slate.

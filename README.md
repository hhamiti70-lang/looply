# LOOPLY · CONNECT • DISCOVER • GROW

LOOPLY is a social networking Progressive Web App (PWA). It works in Chrome on Android and in desktop browsers, and it can be installed to your home screen like an app.

This README is written for a complete beginner who has **only an Android phone**. No laptop is needed.

---

## 1. What is in this project

| File or folder | What it does |
|---|---|
| `index.html` | The app screens: login, feed, discover, profile, navigation |
| `css/styles.css` | The LOOPLY look and layout (dark theme, violet-to-teal brand) |
| `js/config.js` | **Your** Supabase address and key. You edit this once. |
| `js/app.js` | All app logic |
| `sw.js` | Service worker: lets LOOPLY open offline and install on Android |
| `manifest.webmanifest` | App name, colours and icons for installation |
| `icons/` | App icons |
| `supabase/schema.sql` | Database tables and security rules. You run this once in Supabase. |
| `.nojekyll` | Tells GitHub Pages to serve every file as-is (keep this file) |

---

## 2. Stage status

**Completed in Stage 1 (working now):**

- Sign up with username, display name, email and password
- Log in and log out
- Automatic profile creation at sign-up
- Edit your profile: name, bio, location, interests, skills you can teach, skills you want to learn
- Public profile pages with your posts
- Publish posts (up to 500 characters), like posts, delete your own posts
- Feed of the latest posts from all members
- Discover people: suggestions based on shared interests, and search by name or username
- Installable on Android (Add to Home screen) and works on desktop browsers
- Database security (Row Level Security) on every table

**Not built yet (planned for Stage 2):**

- Groups and communities: the screen exists and is labelled "not built yet". The database tables are ready.
- Private messages: the screen exists and is labelled "not built yet". The database tables and the function to start a conversation are ready. Real-time delivery is set up in the schema but must be switched on when the feature is built.
- Skill exchange: the screen exists and is labelled "not built yet". The database table for requests is ready.

Nothing in the app pretends to work when it does not.

---

## 3. Free-plan limits (please read)

LOOPLY is designed to cost nothing to run as a prototype. These are the limits you should know about. Limits can change, so check the pricing pages linked below.

**Supabase Free plan** (https://supabase.com/pricing)
- Up to 2 active free projects.
- A free project is **paused after about 7 days without activity**. You can restore it from the dashboard. Opening the app regularly prevents this.
- 500 MB database storage and 50,000 monthly active users for sign-in.
- The built-in email sender allows only a few confirmation emails per hour. This is fine for testing. For real users you would need your own email service (SMTP).
- Free projects do not include automatic daily backups.

**GitHub Pages** (https://pages.github.com)
- Free for **public** repositories.
- Soft limits of about 1 GB per site and about 100 GB of bandwidth per month.
- Intended for small static sites, not heavy commercial traffic.

**Honest note:** this prototype has not been run against a live Supabase project inside this build. Test it yourself by following the steps below before you show it to anyone.

---

## 4. Setup on Android (step by step)

You will use four free websites in your phone's browser: **GitHub**, **Supabase**, the **Files** app, and **Chrome**.

### Step A: Create a GitHub account

1. Open Chrome and go to https://github.com.
2. Tap **Sign up**, then follow the steps. Choose a username, for example `yourname`. Remember it.
3. Confirm your email address.

### Step B: Create a Supabase account and project

1. Go to https://supabase.com and tap **Start your project**. Sign in with GitHub (easiest) or email.
2. Tap **New project**.
3. Name it `looply`. Choose a database password and **save it** in a notes app. Choose a region close to you.
4. Tap **Create new project**. Wait 1–2 minutes for setup to finish.

### Step C: Copy your two Supabase keys

1. In the Supabase dashboard, tap the **Project Settings** icon (gear, usually at the bottom left). If you cannot see it, open the menu (≡) first.
2. Tap **API** (in the settings list, under *Configuration*).
3. Copy and save somewhere safe:
   - **Project URL**, looks like `https://abcd1234.supabase.co`
   - **anon public** key, a long text starting with `eyJ...`
4. **Do not** copy the key named `service_role`. Never share it and never put it in the app.

### Step D: Create the database tables and security rules

1. In the Supabase dashboard, open **SQL Editor** (the icon looks like `>_`, in the left menu).
2. Tap **+ New query**.
3. Open `supabase/schema.sql` from the unzipped project (see Step E for how to open files on Android). Tap the text, select all, copy.
4. Paste it into the SQL editor and tap **Run**.
5. You should see **Success**. If you see an error, copy the message and read the Troubleshooting section below.

### Step E: Unzip the project on your phone

1. Download `LOOPLY.zip` (you received it from Claude).
2. Open the **Files** app (or **My Files**), find the ZIP and tap it.
3. Choose **Extract** or **Unzip**. You now have a normal folder named `LOOPLY`.

### Step F: Turn off email confirmation for testing (optional but recommended)

Email confirmation sends a link to each new user. The free email sender is slow, so for testing:

1. In Supabase, open **Authentication** → **Sign In / Providers** (or **Providers**) → **Email**.
2. Turn **off** *Confirm email*. Tap **Save**.

You can turn it back on later for real users.

### Step G: Put your keys into LOOPLY

1. Open the `js` folder in the Files app and open `config.js` in a text editor app (Google Keep, a notes app, or any editor that opens `.js` files as text).
2. Replace `https://YOUR-PROJECT-ID.supabase.co` with your **Project URL** (keep the quotes).
3. Replace `YOUR-ANON-PUBLIC-KEY` with your **anon public** key (keep the quotes).
4. Save the file.

### Step H: Create a GitHub repository and upload the files

1. In GitHub (Chrome), tap your profile picture → **Your repositories** → **New**.
2. Repository name: `looply`. Choose **Public**. Tap **Create repository**.
3. You will see an *"uploading an existing file"* link. Tap it, or tap **Add file** → **Upload files**.
4. Tap **choose your files**, go to the extracted `LOOPLY` folder, and select the files at the top level: `index.html`, `sw.js`, `manifest.webmanifest`, `README.md`, and `.nojekyll`. (`.nojekyll` may be hidden in the picker. If you cannot see it, see the note below.)
5. Tap **Commit changes** at the bottom.

**Uploading the folders (`css`, `js`, `icons`, `supabase`):**

GitHub keeps folders when you upload *into* them:

1. Once the top-level files are uploaded, tap the folder name in the repository list (for example `css`). The folder opens.
2. Tap **Add file** → **Upload files** while you are **inside** that folder.
3. Upload the matching files (`styles.css` into `css`, `config.js` and `app.js` into `js`, the two PNG files into `icons`, `schema.sql` into `supabase`). Tap **Commit changes**.

Note on `.nojekyll`: it is an empty file that starts with a dot. If the Android picker hides it, create it instead: tap **Add file** → **Create new file**, type `.nojekyll` as the name, leave the content empty, and commit.

### Step I: Turn on GitHub Pages (free hosting)

1. In your repository, tap **Settings** (top menu; if you do not see it, tap the ⋯ menu first).
2. In the left list, tap **Pages**.
3. Under *Build and deployment*, choose **Deploy from a branch**.
4. Branch: **main**. Folder: **/ (root)**. Tap **Save**.
5. Wait 1–2 minutes, then refresh the page. Your address will be shown at the top, like:
   `https://yourname.github.io/looply/`

### Step J: Tell Supabase your website address

Required for password resets and email links to work correctly:

1. In Supabase, open **Authentication** → **URL Configuration**.
2. Set **Site URL** to your GitHub Pages address, for example `https://yourname.github.io/looply/`.
3. Tap **Save**.

### Step K: Open LOOPLY and test it

1. Open your GitHub Pages address in Chrome.
2. Tap **Sign up**, create an account, then log in.
3. Write a post. Edit your profile and add some interests (for example `photography, coding`).
4. Create a second account (use a different email, or log out first) and check that Discover shows the other person.

### Step L: Install LOOPLY on your Android home screen

1. Open LOOPLY in Chrome.
2. Tap the **⋮** menu (top right).
3. Tap **Install app** or **Add to Home screen**. Confirm.
4. LOOPLY now opens like an app, full screen.

### Step M: Updating the app later

1. In GitHub, open a file (for example `css/styles.css`).
2. Tap the **pencil** icon, make your change, and tap **Commit changes**.
3. GitHub Pages updates in about a minute. Close and reopen LOOPLY to see it.

---

## 5. Troubleshooting

| What you see | What to do |
|---|---|
| *"One setup step left"* screen | You have not filled in `js/config.js` yet, or the values still contain `YOUR-`. Repeat Step G. |
| *"Couldn't create your profile. That username may already be taken."* | Choose another username. Usernames are letters, numbers and underscores only. |
| *"Email or password is incorrect."* | Check spelling. Passwords must be at least 8 characters. |
| *"Please confirm your email first."* | Follow Step F, or click the link in your email. |
| The schema gives an error | Copy the exact message. Often it means you ran part of the file earlier. Running the whole file again is safe on a new project. |
| Posts or profiles do not appear | Check that schema.sql ran with *Success*, and that `config.js` has the right URL and key. |
| The page is blank after an update | Close the app fully and reopen it. On Chrome, go to Settings → Site settings → Storage, then clear data for your LOOPLY address. |
| Supabase says the project is paused | Open the Supabase dashboard and tap **Restore project**. |

---

## 6. Security notes (plain English)

- The **anon public** key in `config.js` is meant to be public. Security comes from the Row Level Security rules in `schema.sql`, which stop people from reading or changing data they should not.
- Never put the **service_role** key anywhere in this project.
- Passwords are handled by Supabase Auth. LOOPLY never stores or sees them after you log in.
- Email addresses are kept in Supabase's private authentication area. They are never copied into the public profiles table.
- Only signed-in members can see posts and profiles.

---

## 7. Roadmap

- **Stage 1 (done):** accounts, profiles, posts, likes, discovery, installable app, security rules.
- **Stage 2 (next):** communities, real-time private messages, skill exchange requests.
- **Stage 3 (later):** profile photos, notifications, reporting and moderation tools, follow system.

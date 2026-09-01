# Ghusl Scheduling App

A small, deliberately plain web app for scheduling Ghusl volunteers at a masjid.

- People sign in with **just their email** — a link is mailed to them, there is
  no password to remember.
- An admin posts the dates that need volunteers.
- For the first **4 hours** after a date is posted, only people who have **not
  done Ghusl yet that month** may claim a spot.
- After 4 hours, the date opens to **everyone**.

The interface is built for readers of every age: 18px base type, 56px buttons,
high contrast, visible borders, pinch-zoom left enabled, and status shown with
words and symbols rather than colour alone.

---

## Deploying it (free) — about 15 minutes

You need three free accounts: **Neon** (database), **Vercel** (hosting), and
**Resend** (sign-in emails). No credit card for any of them.

### 1. Put the code on GitHub

```bash
cd masjid_scheduling_app
git init
git add .
git commit -m "Ghusl scheduling app"
gh repo create ghusl-schedule --private --source=. --push
```

(No `gh`? Create an empty repo at github.com, then `git remote add origin <url>
&& git push -u origin main`.)

### 2. Create the database — neon.tech

1. Sign up, create a project (any name, pick the region closest to you).
2. Copy the **connection string**. It looks like
   `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`.

### 3. Create the tables

```bash
cp .env.example .env
# paste your Neon string into DATABASE_URL, then:
npm install
npm run db:setup
```

### 4. Deploy — vercel.com

1. Sign up with GitHub, click **Add New → Project**, import the repo.
2. Before clicking Deploy, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | your Neon connection string |
   | `APP_URL` | `https://your-project.vercel.app` |
   | `APP_TIMEZONE` | e.g. `America/New_York` |
   | `MASJID_NAME` | e.g. `Masjid Al-Noor Ghusl Schedule` |
   | `ADMIN_EMAILS` | your email — this makes you the admin |
   | `EMAIL_FROM` | `Ghusl Schedule <onboarding@resend.dev>` |
   | `RESEND_API_KEY` | from step 5 (add it now or later) |

3. Click **Deploy**. You get a live URL in about a minute.

> You will not know the final URL until the first deploy finishes. After it
> does, set `APP_URL` to the real URL and redeploy — sign-in links are built
> from it.

### 5. Sign-in emails — resend.com

1. Sign up, go to **API Keys**, create one, paste it into `RESEND_API_KEY` on
   Vercel, and redeploy.
2. **Important limitation:** with the default `onboarding@resend.dev` sender,
   Resend will only deliver to **the address you signed up with**. That is fine
   for showing a friend. To email the whole community, add your domain under
   **Domains** in Resend, verify it, and set
   `EMAIL_FROM="Ghusl Schedule <ghusl@yourmasjid.org>"`.

If `RESEND_API_KEY` is left blank the app still works — sign-in links are
printed to the server log instead of emailed. Useful for local testing, not for
real use.

### 6. Make yourself the admin

Whatever address you put in `ADMIN_EMAILS` becomes an admin the first time it
signs in. Sign in with it and an **Admin** link appears in the header.

To add more admins later, either add them to `ADMIN_EMAILS` and redeploy, or run
this once in Neon's SQL editor:

```sql
update users set is_admin = true where email = 'someone@example.com';
```

---

## Running it on your own Mac

Works against a local Postgres — no internet database needed.

```bash
brew install postgresql@17
brew services start postgresql@17
createdb ghusl_dev

cp .env.example .env
# set DATABASE_URL="postgresql://YOUR_MAC_USERNAME@localhost:5432/ghusl_dev"
# set ADMIN_EMAILS to your own email

npm install
npm run db:setup
npm run db:seed     # optional: sample days, so the screen is not empty
npm run dev
```

Open http://localhost:3000. Sign in with the email you put in `ADMIN_EMAILS`;
because `RESEND_API_KEY` is blank, **the sign-in link is printed in the terminal**
— copy and paste it into your browser.

`npm run db:seed` creates three sample days: one full, one inside its priority
window, one open to everyone. Sample accounts use `…@example.com` addresses and
are removed and recreated each time you re-seed.

---

## How the 4-hour rule actually works

The window is measured from the moment the admin **posts** the date, not from
midnight, because a Ghusl need is not predictable.

```
Admin posts "Thursday Sep 4" at 10:00am
  10:00am – 2:00pm   only people with no Ghusl in September may sign up
  2:00pm  onward     anyone may sign up
```

Details worth knowing:

- "That month" means the month the **Ghusl falls in**, not the month it was
  posted. Days for October posted in September count toward October.
- Cancelling your own spot restores your first-timer status for that month.
- Days an admin cancels count for nobody.
- The admin can set a different window per day (0, 2, 4, 8, 12, or 24 hours),
  and can **restart** the window on a day that was posted at an awkward hour.

Every rule is enforced in the database in a single statement, not just hidden in
the interface — posting the form directly cannot get around it.

---

## Layout

| Path | What lives there |
|---|---|
| `src/app/schedule/` | the main list, and the volunteer / cancel actions |
| `src/app/admin/` | posting days, rosters with contact details, monthly counts |
| `src/app/welcome/` | name and phone, asked once after first sign-in |
| `src/lib/schedule.ts` | the priority-window rules that the pages read |
| `src/lib/auth.ts` | magic-link tokens and sessions |
| `src/lib/db.ts` | Neon in production, local Postgres in development |
| `db/schema.sql` | the tables |

`src/lib/dates.ts` keeps service dates as plain `YYYY-MM-DD` strings all the way
through, so "September 4" never drifts to "September 3" for someone in another
timezone.

---

## Cost

Everything here fits in the free tiers: Vercel Hobby, Neon free (0.5 GB), and
Resend free (3,000 emails/month, 100/day). A masjid sending a few sign-in links
a week will not come close to any limit.

Note that Neon's free tier suspends an idle database after a few minutes; the
first page load after a quiet spell takes a second or two longer while it wakes.

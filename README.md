# Ghusl Scheduling App

A small, deliberately plain web app for scheduling Ghusl volunteers at a masjid.

- People sign in with **just their email** — a link is mailed to them, there is
  no password to remember.
- An admin posts the dates that need volunteers.
- For the first **4 hours** after a date is posted, only people who have **not
  done Ghusl yet that month** may claim a spot.
- After 4 hours, the date opens to **everyone**.
- Posting a date **emails everyone**, and gives the admin a one-tap
  **Share to WhatsApp** button for the masjid group.

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

### 2. Create the database — neon.com

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

## Telling people a day was posted

There are two ways, and they are very different in what they cost you to set up.

### Share to WhatsApp — works immediately, free, nothing to configure

Every posted day has a **Share to WhatsApp** button. It opens WhatsApp with the
announcement already written, so the admin picks the masjid group and sends. On
a phone it opens the app; on a computer, WhatsApp Web. There is also a **Copy
message** button for pasting anywhere else.

This is not the WhatsApp API — it is a plain `wa.me` link. It cannot be blocked,
costs nothing, needs no approval, and will keep working. For most masjids, which
already run a WhatsApp group, this is the whole answer.

### Email everyone — works as soon as Resend is configured

Everyone's email is already verified by signing in, so there is nothing to opt
into. Ticking **Tell everyone straight away** when posting a day emails every
member; individual messages via Resend's batch endpoint, so nobody sees anyone
else's address. Members can turn it off under *Change my name or phone number*.

> Resend's free tier is **3,000 emails a month and 100 a day**. An announcement
> to 80 members uses 80 of that day's 100. If your community is larger than
> that, raise the Resend plan or rely on the WhatsApp share button.

### Automated WhatsApp messages — real setup required

Sending WhatsApp to each member automatically is **not** like sending email, and
it is worth knowing why before you promise it to anyone:

- Since **July 2025** Meta bills **per message** — roughly **$0.01–0.03** each in
  the US, varying by country.
- Any business-initiated message outside a 24-hour window must use a
  **pre-approved template**. You cannot send free text. Template approval takes
  hours to days.
- You need a **verified Meta Business account** and a dedicated sender number.

The code is written and waiting behind configuration. Set these to switch it on:

**For testing (Twilio sandbox — not for real use):**

```bash
WHATSAPP_PROVIDER="twilio"
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_WHATSAPP_FROM="whatsapp:+14155238886"
```

Each person must first send `join <your-sandbox-code>` to `+1 415 523 8886`.
Twilio's sandbox is explicitly documented as testing-only.

**For production (Meta Cloud API):**

```bash
WHATSAPP_PROVIDER="meta"
WHATSAPP_TOKEN="..."
WHATSAPP_PHONE_NUMBER_ID="..."
WHATSAPP_TEMPLATE_NAME="ghusl_day_posted"
```

Your approved template must take four variables in this order:

```
{{1}} date        e.g. "Thursday, September 4, 2026"
{{2}} volunteers  e.g. "3"
{{3}} note        e.g. "After Dhuhr, at the masjid"
{{4}} link        e.g. "https://your-app.vercel.app/schedule"
```

A suitable **Utility** template body:

> Ghusl volunteers are needed on {{1}}. {{2}} volunteers needed. {{3}}. Sign up
> here: {{4}}

Members opt in by ticking *Message me on WhatsApp* and giving a phone number.
The tickbox stays disabled until `WHATSAPP_PROVIDER` is set, so nobody signs up
for messages that cannot arrive.

### Knowing whether it actually worked

Every attempt is written to `notification_log` and shown under the day on the
admin page — how many were sent, how many failed, and the provider's own error
text. If nothing was delivered the confirmation is **red** and says so plainly,
because an admin must never read a green banner and wrongly assume the community
was told. A day is only marked as announced when something actually went out.

Announcements can never cost you the posting itself: the day is saved first, and
a mail or WhatsApp outage is caught and reported rather than thrown.

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
| `src/lib/notify.ts` | composes one announcement for every channel |
| `src/lib/whatsapp.ts` | the Twilio and Meta senders |
| `src/lib/phone.ts` | turns what people type into E.164 |
| `db/schema.sql` | the tables |

`src/lib/dates.ts` keeps service dates as plain `YYYY-MM-DD` strings all the way
through, so "September 4" never drifts to "September 3" for someone in another
timezone.

---

## Cost

Everything here fits in the free tiers: Vercel Hobby, Neon free (0.5 GB storage
and 100 compute-hours per project per month), and Resend free (3,000
emails/month, 100/day). A masjid sending a few sign-in links a week will not
come close to any limit.

Note that Neon's free tier suspends an idle database after 5 minutes; the
first page load after a quiet spell takes a second or two longer while it wakes.

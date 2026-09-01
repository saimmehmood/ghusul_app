#!/usr/bin/env node
/**
 * Fills the schedule with realistic sample data so the app looks alive when you
 * demo it. Safe to run repeatedly — it clears sample rows first.
 *
 *   npm run db:seed
 *
 * Sample accounts are real accounts: you can sign in as any of them with the
 * magic link if you own the address. They exist only to populate rosters.
 */
import { sql } from "./db.mjs";

const PEOPLE = [
  ["Ahmed Khan", "ahmed.sample@example.com", "555-0101"],
  ["Yusuf Malik", "yusuf.sample@example.com", "555-0102"],
  ["Bilal Rahman", "bilal.sample@example.com", "555-0103"],
  ["Omar Siddiqui", "omar.sample@example.com", "555-0104"],
  ["Tariq Aziz", "tariq.sample@example.com", "555-0105"],
];

function isoDate(offsetDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

console.log("Removing previous sample data…");
await sql`delete from users where email like '%.sample@example.com'`;
await sql`delete from ghusl_days where note like '[sample]%'`;

console.log("Creating sample volunteers…");
const users = [];
for (const [name, email, phone] of PEOPLE) {
  const rows = await sql`
    insert into users (email, name, phone)
    values (${email}, ${name}, ${phone})
    on conflict (email) do update set name = excluded.name
    returning id, name
  `;
  users.push(rows[0]);
}

console.log("Posting sample days…");

// A day posted 20 minutes ago — still inside its 4-hour priority window, so you
// can see the "new volunteers first" state.
const [fresh] = await sql`
  insert into ghusl_days (service_date, slots_needed, note, priority_hours, posted_at)
  values (${isoDate(3)}, 3, '[sample] After Dhuhr, at the masjid',
          4, now() - interval '20 minutes')
  returning id
`;

// A day posted two days ago — priority window long over, open to everyone.
const [open] = await sql`
  insert into ghusl_days (service_date, slots_needed, note, priority_hours, posted_at)
  values (${isoDate(6)}, 3, '[sample] Morning, Greenlawn funeral home',
          4, now() - interval '2 days')
  returning id
`;

// A day that already filled up.
const [full] = await sql`
  insert into ghusl_days (service_date, slots_needed, note, priority_hours, posted_at)
  values (${isoDate(1)}, 3, '[sample] Tomorrow, after Asr',
          4, now() - interval '1 day')
  returning id
`;

async function signUp(dayId, user) {
  await sql`
    insert into signups (day_id, user_id) values (${dayId}, ${user.id})
    on conflict do nothing
  `;
}

await signUp(fresh.id, users[0]);
await signUp(open.id, users[1]);
await signUp(open.id, users[2]);
await signUp(full.id, users[2]);
await signUp(full.id, users[3]);
await signUp(full.id, users[4]);

console.log(`
Sample data is ready:

  ${isoDate(1)}  full        (3 of 3)
  ${isoDate(3)}  posted 20 min ago — priority window is OPEN
  ${isoDate(6)}  open to everyone (2 of 3)

Sign in with your own email to try volunteering.
`);

process.exit(0);

-- Ghusl Scheduling App — database schema
-- Safe to run more than once.

create extension if not exists "pgcrypto";

create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  name        text not null default '',
  phone       text not null default '',
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Short-lived, single-use tokens emailed to people so they can sign in
-- without a password.
create table if not exists login_tokens (
  token       text primary key,
  email       text not null,
  expires_at  timestamptz not null,
  used_at     timestamptz
);

create index if not exists login_tokens_email_idx on login_tokens (email);

create table if not exists sessions (
  id          text primary key,
  user_id     uuid not null references users (id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists sessions_user_idx on sessions (user_id);

-- A date on which Ghusl volunteers are needed.
-- posted_at is the moment an admin opened it up: the 4-hour priority window
-- for first-time-this-month volunteers is measured from here.
create table if not exists ghusl_days (
  id             uuid primary key default gen_random_uuid(),
  service_date   date not null,
  slots_needed   int not null default 3 check (slots_needed between 1 and 12),
  note           text not null default '',
  posted_at      timestamptz not null default now(),
  priority_hours int not null default 4 check (priority_hours >= 0),
  created_by     uuid references users (id) on delete set null,
  cancelled_at   timestamptz
);

create index if not exists ghusl_days_date_idx on ghusl_days (service_date);

create table if not exists signups (
  id          uuid primary key default gen_random_uuid(),
  day_id      uuid not null references ghusl_days (id) on delete cascade,
  user_id     uuid not null references users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (day_id, user_id)
);

create index if not exists signups_day_idx on signups (day_id);
create index if not exists signups_user_idx on signups (user_id);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

-- Who wants to hear about newly posted days, and where.
-- Email is on by default: the address is already verified by signing in, so
-- there is no extra step for the member. WhatsApp is strictly opt-in, because
-- it needs a phone number the member has chosen to give us.
alter table users add column if not exists notify_email boolean not null default true;
alter table users add column if not exists notify_whatsapp boolean not null default false;

-- Phone in E.164 ("+15555550123"), which is the only form the WhatsApp API takes.
alter table users add column if not exists phone_e164 text not null default '';

-- Stamped when an announcement for this day was last sent, so the admin can see
-- whether people were told and does not blast the same day twice by accident.
alter table ghusl_days add column if not exists notified_at timestamptz;

-- One row per announcement attempt, for a delivery record the admin can trust.
create table if not exists notification_log (
  id          uuid primary key default gen_random_uuid(),
  day_id      uuid references ghusl_days (id) on delete cascade,
  channel     text not null,
  recipients  int  not null default 0,
  failures    int  not null default 0,
  detail      text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists notification_log_day_idx on notification_log (day_id);

import "server-only";

import { sql } from "./db";
import type { User } from "./auth";
import { todayInTimezone, formatTime } from "./dates";

export type Volunteer = {
  user_id: string;
  name: string;
  email: string;
  phone: string;
};

type DayRow = {
  id: string;
  service_date: string; // YYYY-MM-DD
  slots_needed: number;
  note: string;
  posted_at: Date;
  priority_hours: number;
  cancelled_at: Date | null;
  notified_at: Date | null;
};

export type DayView = DayRow & {
  volunteers: Volunteer[];
  filled: number;
  spotsLeft: number;
  isFull: boolean;
  isPast: boolean;

  /** Moment the day stops being reserved for first-time-this-month volunteers. */
  priorityEndsAt: Date;
  inPriorityWindow: boolean;

  viewerSignedUp: boolean;
  /** True when the viewer has no other signup in this day's calendar month. */
  viewerIsNewThisMonth: boolean;
  viewerCanSignUp: boolean;
  /** Plain-language explanation when the viewer cannot sign up. */
  viewerBlockedReason: string | null;
};

/** "2026-09-04" -> "2026-09" */
function monthKey(ymd: string): string {
  return ymd.slice(0, 7);
}

function priorityEnd(day: DayRow): Date {
  return new Date(day.posted_at.getTime() + day.priority_hours * 3_600_000);
}

/**
 * How many Ghusls this person has already signed up for, per calendar month.
 * Cancelled days do not count against anyone.
 */
async function monthlyCountsFor(userId: string): Promise<Map<string, number>> {
  const rows = (await sql`
    select to_char(d.service_date, 'YYYY-MM') as month_key,
           count(*)::int                      as total
      from signups s
      join ghusl_days d on d.id = s.day_id
     where s.user_id = ${userId}
       and d.cancelled_at is null
     group by 1
  `) as { month_key: string; total: number }[];

  return new Map(rows.map((r) => [r.month_key, r.total]));
}

async function volunteersByDay(
  dayIds: string[],
): Promise<Map<string, Volunteer[]>> {
  const byDay = new Map<string, Volunteer[]>();
  if (dayIds.length === 0) return byDay;

  const rows = (await sql`
    select s.day_id,
           u.id    as user_id,
           u.name,
           u.email,
           u.phone
      from signups s
      join users u on u.id = s.user_id
     where s.day_id = any(${dayIds}::uuid[])
     order by s.created_at asc
  `) as (Volunteer & { day_id: string })[];

  for (const row of rows) {
    const list = byDay.get(row.day_id) ?? [];
    list.push({
      user_id: row.user_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
    });
    byDay.set(row.day_id, list);
  }
  return byDay;
}

/**
 * Decorates raw day rows with everything the UI needs, including whether this
 * particular viewer is allowed to claim a spot right now.
 */
async function decorate(days: DayRow[], viewer: User | null): Promise<DayView[]> {
  const [volunteers, monthCounts] = await Promise.all([
    volunteersByDay(days.map((d) => d.id)),
    viewer ? monthlyCountsFor(viewer.id) : Promise.resolve(new Map<string, number>()),
  ]);

  const today = todayInTimezone();
  const now = Date.now();

  return days.map((day) => {
    const list = volunteers.get(day.id) ?? [];
    const filled = list.length;
    const spotsLeft = Math.max(0, day.slots_needed - filled);
    const isFull = spotsLeft === 0;
    const isPast = day.service_date < today;
    const isCancelled = day.cancelled_at !== null;

    const priorityEndsAt = priorityEnd(day);
    const inPriorityWindow = now < priorityEndsAt.getTime();

    const viewerSignedUp = viewer
      ? list.some((v) => v.user_id === viewer.id)
      : false;

    // Signups this viewer already holds in this day's month, not counting this
    // day itself — so the day they are looking at never disqualifies them.
    const otherThisMonth =
      (monthCounts.get(monthKey(day.service_date)) ?? 0) -
      (viewerSignedUp ? 1 : 0);
    const viewerIsNewThisMonth = otherThisMonth === 0;

    let viewerBlockedReason: string | null = null;
    if (!viewer) viewerBlockedReason = "Sign in to volunteer.";
    else if (viewerSignedUp) viewerBlockedReason = null;
    else if (isCancelled) viewerBlockedReason = "This day was cancelled.";
    else if (isPast) viewerBlockedReason = "This date has already passed.";
    else if (isFull) viewerBlockedReason = "All spots are taken.";
    else if (inPriorityWindow && !viewerIsNewThisMonth) {
      viewerBlockedReason =
        `Right now this day is saved for people who have not done Ghusl yet ` +
        `this month. It opens to everyone at ${formatTime(priorityEndsAt)}.`;
    }

    return {
      ...day,
      volunteers: list,
      filled,
      spotsLeft,
      isFull,
      isPast,
      priorityEndsAt,
      inPriorityWindow,
      viewerSignedUp,
      viewerIsNewThisMonth,
      viewerCanSignUp:
        viewer !== null && !viewerSignedUp && viewerBlockedReason === null,
      viewerBlockedReason,
    };
  });
}

/** Days from today onward that are still open for volunteers. */
export async function getUpcomingDays(viewer: User | null): Promise<DayView[]> {
  const today = todayInTimezone();
  const rows = (await sql`
    select id,
           to_char(service_date, 'YYYY-MM-DD') as service_date,
           slots_needed, note, posted_at, priority_hours, cancelled_at,
           notified_at
      from ghusl_days
     where service_date >= ${today}::date
       and cancelled_at is null
     order by service_date asc
  `) as DayRow[];
  return decorate(rows, viewer);
}

/** Every day, newest first — the admin's management view. */
export async function getAllDays(viewer: User | null): Promise<DayView[]> {
  const rows = (await sql`
    select id,
           to_char(service_date, 'YYYY-MM-DD') as service_date,
           slots_needed, note, posted_at, priority_hours, cancelled_at,
           notified_at
      from ghusl_days
     order by service_date desc
     limit 200
  `) as DayRow[];
  return decorate(rows, viewer);
}

/** Days this person has volunteered for, soonest first. */
export async function getMyDays(viewer: User): Promise<DayView[]> {
  const rows = (await sql`
    select d.id,
           to_char(d.service_date, 'YYYY-MM-DD') as service_date,
           d.slots_needed, d.note, d.posted_at, d.priority_hours, d.cancelled_at,
           d.notified_at
      from ghusl_days d
     where exists (
             select 1 from signups s
              where s.day_id = d.id and s.user_id = ${viewer.id}
           )
       and d.cancelled_at is null
     order by d.service_date asc
  `) as DayRow[];
  return decorate(rows, viewer);
}

export async function getDay(
  id: string,
  viewer: User | null,
): Promise<DayView | null> {
  const rows = (await sql`
    select id,
           to_char(service_date, 'YYYY-MM-DD') as service_date,
           slots_needed, note, posted_at, priority_hours, cancelled_at,
           notified_at
      from ghusl_days
     where id = ${id}
  `) as DayRow[];
  if (rows.length === 0) return null;
  return (await decorate(rows, viewer))[0];
}

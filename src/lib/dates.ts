import { APP_TIMEZONE } from "./config";

/**
 * Service dates are stored as plain SQL `date` values and always travel through
 * this app as "YYYY-MM-DD" strings. Treating them as UTC midnight when
 * formatting keeps "September 4" from drifting to "September 3" for anyone.
 */
function plainDateToUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "Thursday, September 4, 2026" */
export function formatServiceDate(ymd: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(plainDateToUtc(ymd));
}

/** "Thursday" */
export function formatWeekday(ymd: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(plainDateToUtc(ymd));
}

/** "Sep 4" */
export function formatShortDate(ymd: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(plainDateToUtc(ymd));
}

/** "September 2026" — the month a service date belongs to. */
export function formatMonthName(ymd: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(plainDateToUtc(ymd));
}

/** "2:30 PM" in the masjid's timezone. */
export function formatTime(when: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(when);
}

/** "Sep 4 at 2:30 PM" in the masjid's timezone. */
export function formatDateTime(when: Date): string {
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: APP_TIMEZONE,
  }).format(when);
  return `${date} at ${formatTime(when)}`;
}

/** Today's date in the masjid's timezone, as "YYYY-MM-DD". */
export function todayInTimezone(): string {
  // en-CA formats as YYYY-MM-DD, which is exactly the shape we store.
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(new Date());
}

/**
 * "3 hours 12 minutes", "45 minutes", "2 minutes". Rounds down, and never
 * returns an empty string so it always reads as a sentence.
 */
export function humanDuration(ms: number): string {
  if (ms <= 0) return "0 minutes";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  if (parts.length === 0) return "less than a minute";
  return parts.join(" ");
}

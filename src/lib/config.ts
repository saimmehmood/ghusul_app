export const MASJID_NAME = process.env.MASJID_NAME || "Masjid Ghusl Schedule";

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/New_York";

/** Emails listed here are granted admin rights the first time they sign in. */
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Public base URL, used to build sign-in links. On Vercel, VERCEL_URL is set
 * automatically for preview deploys so links keep working there too.
 */
export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

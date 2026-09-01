import "server-only";

import { sql } from "./db";
import { appUrl, MASJID_NAME } from "./config";
import { formatServiceDate, formatTime } from "./dates";
import { sendDayAnnouncementEmails } from "./email";
import {
  sendWhatsAppBlast,
  whatsappProvider,
  type Announcement,
  type BlastResult,
  type WhatsAppRecipient,
} from "./whatsapp";

export type AnnounceableDay = {
  id: string;
  service_date: string;
  slots_needed: number;
  note: string;
  posted_at: Date;
  priority_hours: number;
};

/**
 * One announcement, rendered for every channel it might travel through, so the
 * wording people see in WhatsApp matches the wording in their inbox.
 */
export function composeAnnouncement(day: AnnounceableDay) {
  const dateLine = formatServiceDate(day.service_date);
  const link = `${appUrl()}/schedule`;

  const opensAtDate = new Date(
    day.posted_at.getTime() + day.priority_hours * 3_600_000,
  );
  // A reminder can be sent long after the window has closed, so the wording has
  // to be decided against the clock rather than assuming this is a fresh post.
  const windowStillOpen =
    day.priority_hours > 0 && Date.now() < opensAtDate.getTime();

  const priorityLine = windowStillOpen
    ? `Until ${formatTime(opensAtDate)}, spots are saved for those who have ` +
      `not done Ghusl yet this month. After that, anyone may sign up.`
    : `This day is open to everyone.`;

  const subject = `Ghusl volunteers needed — ${dateLine}`;

  const text = [
    `Assalamu alaikum,`,
    ``,
    `Volunteers are needed for Ghusl.`,
    ``,
    `${dateLine}`,
    day.note ? `${day.note}` : null,
    `${day.slots_needed} ${day.slots_needed === 1 ? "volunteer" : "volunteers"} needed.`,
    ``,
    priorityLine,
    ``,
    `Sign up here: ${link}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  // WhatsApp renders *asterisks* as bold; keep it short so it reads well on a
  // phone without needing "read more".
  const whatsappText = [
    `*Ghusl volunteers needed*`,
    ``,
    `${dateLine}`,
    day.note ? day.note : null,
    `${day.slots_needed} ${day.slots_needed === 1 ? "volunteer" : "volunteers"} needed.`,
    ``,
    priorityLine,
    ``,
    `Sign up: ${link}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    subject,
    text,
    whatsappText,
    link,
    dateLine,
    priorityLine,
    /** Ordered to match the approved Meta template's {{1}}…{{4}} placeholders. */
    templateParams: [
      dateLine,
      String(day.slots_needed),
      day.note || "At the masjid",
      link,
    ],
  };
}

/** A wa.me link that opens WhatsApp with the announcement already typed out. */
export function whatsappShareLink(day: AnnounceableDay): string {
  const { whatsappText } = composeAnnouncement(day);
  return `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
}

export type AnnounceOutcome = {
  email: BlastResult;
  whatsapp: BlastResult;
};

/**
 * Tells the community a day has been posted.
 *
 * Never throws: an announcement failing must not undo the posting of the day
 * itself, which is the part that actually matters. Whatever happened is written
 * to notification_log and shown back to the admin.
 */
export async function announceDay(
  day: AnnounceableDay,
): Promise<AnnounceOutcome> {
  const announcement = composeAnnouncement(day);

  const emailRecipients = (await sql`
    select email, name
      from users
     where notify_email = true
       and email <> ''
  `) as { email: string; name: string }[];

  const whatsappRecipients = (await sql`
    select phone_e164, name
      from users
     where notify_whatsapp = true
       and phone_e164 <> ''
  `) as WhatsAppRecipient[];

  const payload: Announcement = {
    freeText: announcement.whatsappText,
    templateParams: announcement.templateParams,
  };

  const [email, whatsapp] = await Promise.all([
    safely(() =>
      sendDayAnnouncementEmails(emailRecipients, announcement.subject, {
        text: announcement.text,
        dateLine: announcement.dateLine,
        note: day.note,
        slots: day.slots_needed,
        priorityLine: announcement.priorityLine,
        link: announcement.link,
      }),
    ),
    safely(() => sendWhatsAppBlast(whatsappRecipients, payload)),
  ]);

  // The channel name is the stable key the delivery record groups by, so the
  // provider goes in the detail rather than into the name itself.
  await recordAttempt(day.id, "email", email);
  await recordAttempt(day.id, "whatsapp", {
    ...whatsapp,
    detail: `[${whatsappProvider()}] ${whatsapp.detail}`.trim(),
  });

  if (email.sent > 0 || whatsapp.sent > 0) {
    await sql`
      update ghusl_days set notified_at = now() where id = ${day.id}::uuid
    `;
  }

  return { email, whatsapp };
}

async function safely(run: () => Promise<BlastResult>): Promise<BlastResult> {
  try {
    return await run();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("Announcement channel failed:", reason);
    return { sent: 0, failed: 0, detail: reason.slice(0, 300) };
  }
}

async function recordAttempt(
  dayId: string,
  channel: string,
  result: BlastResult,
): Promise<void> {
  try {
    await sql`
      insert into notification_log (day_id, channel, recipients, failures, detail)
      values (${dayId}::uuid, ${channel}, ${result.sent}, ${result.failed},
              ${result.detail.slice(0, 500)})
    `;
  } catch (err) {
    console.error("Could not write notification_log:", err);
  }
}

export type NotificationRecord = {
  day_id: string;
  channel: string;
  recipients: number;
  failures: number;
  detail: string;
  created_at: Date;
};

/**
 * The latest announcement attempt per channel, for every day shown on the admin
 * page — fetched in one query rather than one per day.
 */
export async function notificationsForDays(
  dayIds: string[],
): Promise<Map<string, NotificationRecord[]>> {
  const byDay = new Map<string, NotificationRecord[]>();
  if (dayIds.length === 0) return byDay;

  const rows = (await sql`
    select distinct on (day_id, channel)
           day_id, channel, recipients, failures, detail, created_at
      from notification_log
     where day_id = any(${dayIds}::uuid[])
     order by day_id, channel, created_at desc
  `) as NotificationRecord[];

  for (const row of rows) {
    const list = byDay.get(row.day_id) ?? [];
    list.push(row);
    byDay.set(row.day_id, list);
  }
  return byDay;
}

export { MASJID_NAME };

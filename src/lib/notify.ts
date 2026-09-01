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

  await recordAttempt(day.id, "email", email);
  await recordAttempt(day.id, `whatsapp:${whatsappProvider()}`, whatsapp);

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

/** The most recent announcement attempts, for the admin's delivery record. */
export async function recentNotifications(dayId: string) {
  return (await sql`
    select channel, recipients, failures, detail, created_at
      from notification_log
     where day_id = ${dayId}::uuid
     order by created_at desc
     limit 4
  `) as {
    channel: string;
    recipients: number;
    failures: number;
    detail: string;
    created_at: Date;
  }[];
}

export { MASJID_NAME };

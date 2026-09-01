import "server-only";

import { Resend } from "resend";

import { MASJID_NAME } from "./config";

const FROM =
  process.env.EMAIL_FROM || "Masjid Ghusl Schedule <onboarding@resend.dev>";

/**
 * Sends the sign-in link. When RESEND_API_KEY is not configured the link is
 * printed to the server console instead — so the app is fully usable locally
 * before any email service is set up.
 */
export async function sendSignInEmail(to: string, link: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    console.log(
      `\n────────────────────────────────────────────────────────\n` +
        `  SIGN-IN LINK for ${to}\n` +
        `  (no RESEND_API_KEY set, so nothing was emailed)\n\n` +
        `  ${link}\n` +
        `────────────────────────────────────────────────────────\n`,
    );
    return;
  }

  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Your sign-in link for ${MASJID_NAME}`,
    text: [
      `Assalamu alaikum,`,
      ``,
      `Tap the link below to sign in to ${MASJID_NAME}.`,
      ``,
      link,
      ``,
      `This link works once and expires in 30 minutes.`,
      `If you did not ask to sign in, you can ignore this email.`,
    ].join("\n"),
    html: signInHtml(link),
  });

  if (error) {
    console.error("Resend failed to send sign-in email:", error);
    throw new Error("We could not send the email. Please try again.");
  }
}

function signInHtml(link: string): string {
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:17px;line-height:1.6;color:#1a1a1a;max-width:520px;margin:0 auto;padding:24px">
  <p style="margin:0 0 20px">Assalamu alaikum,</p>
  <p style="margin:0 0 28px">Tap the button below to sign in to <strong>${escapeHtml(MASJID_NAME)}</strong>.</p>
  <p style="margin:0 0 28px">
    <a href="${escapeHtml(link)}"
       style="display:inline-block;background:#0b6b5b;color:#ffffff;text-decoration:none;font-size:19px;font-weight:600;padding:16px 32px;border-radius:10px">
      Sign in
    </a>
  </p>
  <p style="margin:0 0 8px;color:#555;font-size:15px">
    This link works once and expires in 30 minutes.
  </p>
  <p style="margin:0;color:#555;font-size:15px">
    If you did not ask to sign in, you can ignore this email.
  </p>
</div>`.trim();
}

type AnnouncementBody = {
  text: string;
  dateLine: string;
  note: string;
  slots: number;
  priorityLine: string;
  link: string;
};

/** Resend accepts at most 100 messages per batch call. */
const BATCH_SIZE = 100;

/**
 * Emails everyone who has not turned announcements off. Sent as individual
 * messages via Resend's batch endpoint rather than one BCC blast, so nobody
 * sees the rest of the congregation's addresses.
 */
export async function sendDayAnnouncementEmails(
  recipients: { email: string; name: string }[],
  subject: string,
  body: AnnouncementBody,
): Promise<{ sent: number; failed: number; detail: string }> {
  if (recipients.length === 0) {
    return { sent: 0, failed: 0, detail: "Nobody is set to receive emails." };
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(
      `\n──────────────────────────────────────────────\n` +
        `  ANNOUNCEMENT (no RESEND_API_KEY, not emailed)\n` +
        `  would go to ${recipients.length} people\n\n` +
        `  ${subject}\n\n${body.text}\n` +
        `──────────────────────────────────────────────\n`,
    );
    return {
      sent: 0,
      failed: 0,
      detail: `No email key set — the announcement for ${recipients.length} people was printed to the server log instead.`,
    };
  }

  const resend = new Resend(key);
  const html = announcementHtml(body);

  let sent = 0;
  const errors: string[] = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    try {
      const { error } = await resend.batch.send(
        chunk.map((person) => ({
          from: FROM,
          to: person.email,
          subject,
          text: body.text,
          html,
        })),
      );
      if (error) {
        errors.push(String(error.message ?? error));
      } else {
        sent += chunk.length;
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return {
    sent,
    failed: recipients.length - sent,
    detail: errors.slice(0, 3).join(" | "),
  };
}

function announcementHtml(body: AnnouncementBody): string {
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:17px;line-height:1.6;color:#1a1a1a;max-width:520px;margin:0 auto;padding:24px">
  <p style="margin:0 0 20px">Assalamu alaikum,</p>
  <p style="margin:0 0 8px">Volunteers are needed for Ghusl.</p>
  <div style="border:2px solid #d6d1c7;border-radius:12px;padding:18px 20px;margin:0 0 24px">
    <p style="margin:0 0 6px;font-size:21px;font-weight:700">${escapeHtml(body.dateLine)}</p>
    ${body.note ? `<p style="margin:0 0 6px;color:#55514a">${escapeHtml(body.note)}</p>` : ""}
    <p style="margin:0;color:#55514a">${body.slots} ${body.slots === 1 ? "volunteer" : "volunteers"} needed.</p>
  </div>
  <p style="margin:0 0 24px;background:#fbf2dd;border:2px solid #e0c688;border-radius:10px;padding:14px 16px">
    ${escapeHtml(body.priorityLine)}
  </p>
  <p style="margin:0 0 28px">
    <a href="${escapeHtml(body.link)}"
       style="display:inline-block;background:#0b6b5b;color:#ffffff;text-decoration:none;font-size:19px;font-weight:600;padding:16px 32px;border-radius:10px">
      See the day and sign up
    </a>
  </p>
  <p style="margin:0;color:#555;font-size:15px">
    To stop these emails, open the app and use
    &ldquo;Change my name or phone number&rdquo;.
  </p>
</div>`.trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

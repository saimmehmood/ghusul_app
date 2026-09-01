"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { announceDay, type AnnounceableDay } from "@/lib/notify";

/** Everything composeAnnouncement needs, for one day. */
async function loadForAnnouncement(
  dayId: string,
): Promise<AnnounceableDay | null> {
  const rows = (await sql`
    select id,
           to_char(service_date, 'YYYY-MM-DD') as service_date,
           slots_needed, note, posted_at, priority_hours
      from ghusl_days
     where id = ${dayId}::uuid
       and cancelled_at is null
  `) as AnnounceableDay[];
  return rows[0] ?? null;
}

/**
 * Turns a send result into the query string the admin page reads back, so the
 * confirmation says what actually happened rather than a hopeful "sent!".
 */
function announcementSummary(
  email: { sent: number; failed: number },
  whatsapp: { sent: number; failed: number },
): string {
  const parts = [`e=${email.sent}`, `ef=${email.failed}`];
  parts.push(`w=${whatsapp.sent}`, `wf=${whatsapp.failed}`);
  return parts.join("&");
}

function refresh() {
  revalidatePath("/admin");
  revalidatePath("/schedule");
  revalidatePath("/mine");
}

/**
 * Opens a date for volunteers. posted_at defaults to now(), which starts the
 * priority window — so the 4 hours are measured from this moment.
 */
export async function postDayAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const serviceDate = String(formData.get("service_date") || "").trim();
  const note = String(formData.get("note") || "").trim().slice(0, 300);

  const slots = Number(formData.get("slots_needed"));
  const hours = Number(formData.get("priority_hours"));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    redirect("/admin?msg=bad-date");
  }

  const slotsNeeded = Number.isFinite(slots)
    ? Math.min(12, Math.max(1, Math.round(slots)))
    : 3;
  const priorityHours = Number.isFinite(hours)
    ? Math.min(72, Math.max(0, Math.round(hours)))
    : 4;

  const created = (await sql`
    insert into ghusl_days (service_date, slots_needed, note, priority_hours, created_by)
    values (${serviceDate}::date, ${slotsNeeded}, ${note}, ${priorityHours}, ${admin.id})
    returning id
  `) as { id: string }[];

  refresh();

  // Announce straight away when asked. The day is already saved by this point,
  // and announceDay never throws, so a mail or WhatsApp outage cannot cost the
  // admin the posting they just made.
  if (formData.get("announce") === "on") {
    const day = await loadForAnnouncement(created[0].id);
    if (day) {
      const { email, whatsapp } = await announceDay(day);
      refresh();
      redirect(
        `/admin?msg=posted-announced&${announcementSummary(email, whatsapp)}`,
      );
    }
  }

  redirect("/admin?msg=posted");
}

/**
 * Sends the announcement for a day that is already posted — for when the admin
 * unticked the box, or wants to nudge the community again because spots are
 * still open.
 */
export async function announceDayAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const dayId = String(formData.get("dayId") || "");
  if (!dayId) redirect("/admin");

  const day = await loadForAnnouncement(dayId);
  if (!day) redirect("/admin?msg=announce-missing");

  const { email, whatsapp } = await announceDay(day);

  refresh();
  redirect(`/admin?msg=announced&${announcementSummary(email, whatsapp)}`);
}

/** Hides a day from the schedule. Existing signups stop counting toward limits. */
export async function cancelDayAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const dayId = String(formData.get("dayId") || "");
  if (!dayId) redirect("/admin");

  await sql`
    update ghusl_days set cancelled_at = now()
     where id = ${dayId}::uuid and cancelled_at is null
  `;

  refresh();
  redirect("/admin?msg=cancelled");
}

export async function restoreDayAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const dayId = String(formData.get("dayId") || "");
  if (!dayId) redirect("/admin");

  await sql`
    update ghusl_days set cancelled_at = null where id = ${dayId}::uuid
  `;

  refresh();
  redirect("/admin?msg=restored");
}

/**
 * Restarts the 4-hour priority window on a day — useful when a day was posted
 * at 2am and nobody saw it.
 */
export async function repostDayAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const dayId = String(formData.get("dayId") || "");
  if (!dayId) redirect("/admin");

  await sql`
    update ghusl_days set posted_at = now() where id = ${dayId}::uuid
  `;

  refresh();
  redirect("/admin?msg=reposted");
}

export async function removeVolunteerAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const dayId = String(formData.get("dayId") || "");
  const userId = String(formData.get("userId") || "");
  if (!dayId || !userId) redirect("/admin");

  await sql`
    delete from signups
     where day_id = ${dayId}::uuid and user_id = ${userId}::uuid
  `;

  refresh();
  redirect("/admin?msg=removed");
}

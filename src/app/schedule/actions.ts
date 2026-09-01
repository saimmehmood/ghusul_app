"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { todayInTimezone } from "@/lib/dates";

/**
 * Claim a spot.
 *
 * The whole rule set is re-checked here in a single INSERT ... SELECT, because
 * the button being visible is not authorization — someone can leave a stale tab
 * open across the end of a priority window, or post the form directly. The
 * statement inserts only if, at this instant: the day is live, not in the past,
 * still has a free spot, and either the priority window has passed or this
 * person has no other Ghusl in that day's calendar month.
 */
export async function volunteerAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const dayId = String(formData.get("dayId") || "");
  const back = String(formData.get("back") || "/schedule");
  if (!dayId) redirect(back);

  const today = todayInTimezone();

  const rows = (await sql`
    insert into signups (day_id, user_id)
    select ${dayId}::uuid, ${user.id}::uuid
     where exists (
       select 1
         from ghusl_days d
        where d.id = ${dayId}::uuid
          and d.cancelled_at is null
          and d.service_date >= ${today}::date
          and (select count(*) from signups s where s.day_id = d.id) < d.slots_needed
          and (
            now() >= d.posted_at + make_interval(hours => d.priority_hours)
            or not exists (
              select 1
                from signups s2
                join ghusl_days d2 on d2.id = s2.day_id
               where s2.user_id = ${user.id}::uuid
                 and d2.cancelled_at is null
                 and to_char(d2.service_date, 'YYYY-MM')
                   = to_char(d.service_date, 'YYYY-MM')
            )
          )
     )
    on conflict (day_id, user_id) do nothing
    returning id
  `) as { id: string }[];

  revalidatePath("/schedule");
  revalidatePath("/mine");

  if (rows.length === 0) {
    // Either it filled up while they were deciding, the window closed, or they
    // were already on the list. The refreshed card will explain which.
    redirect(`${back}?msg=could-not-sign-up`);
  }

  redirect(`${back}?msg=signed-up`);
}

/** Give up a spot you claimed. Only for days that have not happened yet. */
export async function cancelSignupAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const dayId = String(formData.get("dayId") || "");
  const back = String(formData.get("back") || "/schedule");
  if (!dayId) redirect(back);

  const today = todayInTimezone();

  await sql`
    delete from signups s
     using ghusl_days d
     where s.day_id = d.id
       and s.day_id = ${dayId}::uuid
       and s.user_id = ${user.id}::uuid
       and d.service_date >= ${today}::date
  `;

  revalidatePath("/schedule");
  revalidatePath("/mine");
  redirect(`${back}?msg=cancelled`);
}

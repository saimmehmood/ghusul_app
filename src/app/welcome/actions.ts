"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { toE164 } from "@/lib/phone";

export async function saveProfile(formData: FormData): Promise<void> {
  const user = await requireUser();

  const name = String(formData.get("name") || "").trim().slice(0, 80);
  const phone = String(formData.get("phone") || "").trim().slice(0, 40);
  const notifyEmail = formData.get("notify_email") === "on";
  const wantsWhatsApp = formData.get("notify_whatsapp") === "on";

  if (!name) redirect("/welcome?error=name");

  const e164 = phone ? toE164(phone) : null;

  // Asking for WhatsApp without a usable number would silently sign someone up
  // for messages that can never arrive, so say so instead.
  if (wantsWhatsApp && !e164) {
    redirect("/welcome?error=phone");
  }

  await sql`
    update users
       set name            = ${name},
           phone           = ${phone},
           phone_e164      = ${e164 ?? ""},
           notify_email    = ${notifyEmail},
           notify_whatsapp = ${wantsWhatsApp && e164 !== null}
     where id = ${user.id}
  `;

  revalidatePath("/", "layout");
  redirect("/schedule");
}

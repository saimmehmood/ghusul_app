"use server";

import { redirect } from "next/navigation";

import { createLoginToken, isValidEmail, normalizeEmail } from "@/lib/auth";
import { appUrl } from "@/lib/config";
import { sendSignInEmail } from "@/lib/email";

export async function requestSignInLink(formData: FormData): Promise<void> {
  const raw = String(formData.get("email") || "");
  const email = normalizeEmail(raw);

  if (!isValidEmail(email)) {
    redirect(`/signin?error=bad-email&email=${encodeURIComponent(raw.trim())}`);
  }

  const token = await createLoginToken(email);
  const link = `${appUrl()}/auth/verify?token=${token}`;

  try {
    await sendSignInEmail(email, link);
  } catch {
    redirect(`/signin?error=send-failed&email=${encodeURIComponent(email)}`);
  }

  redirect(`/signin/check?email=${encodeURIComponent(email)}`);
}

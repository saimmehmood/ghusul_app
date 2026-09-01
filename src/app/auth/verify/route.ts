import { NextRequest, NextResponse } from "next/server";

import { consumeLoginToken, createSession, getOrCreateUser } from "@/lib/auth";
import { appUrl } from "@/lib/config";

/**
 * Lands here when someone taps the link in their sign-in email.
 * Redeems the one-time token, opens a session, and sends first-timers to
 * /welcome so we learn their name before they appear on a roster.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const base = appUrl();

  if (!token) {
    return NextResponse.redirect(`${base}/signin?error=bad-link`);
  }

  const email = await consumeLoginToken(token);
  if (!email) {
    return NextResponse.redirect(`${base}/signin?error=bad-link`);
  }

  const user = await getOrCreateUser(email);
  await createSession(user.id);

  return NextResponse.redirect(user.name ? `${base}/schedule` : `${base}/welcome`);
}

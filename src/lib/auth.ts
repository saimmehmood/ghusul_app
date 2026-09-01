import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { sql } from "./db";
import { ADMIN_EMAILS } from "./config";

export const SESSION_COOKIE = "ghusl_session";

const SESSION_DAYS = 60;
const LOGIN_TOKEN_MINUTES = 30;

export type User = {
  id: string;
  email: string;
  name: string;
  phone: string;
  is_admin: boolean;
  notify_email: boolean;
  notify_whatsapp: boolean;
  phone_e164: string;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  // Deliberately loose: we only need to catch typos like a missing "@".
  // Real validation happens when the sign-in email actually arrives.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Creates a single-use, 30-minute sign-in token for an email address. */
export async function createLoginToken(email: string): Promise<string> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + LOGIN_TOKEN_MINUTES * 60_000);
  await sql`
    insert into login_tokens (token, email, expires_at)
    values (${token}, ${normalizeEmail(email)}, ${expiresAt.toISOString()})
  `;
  return token;
}

/**
 * Redeems a sign-in token. Returns the email it was issued to, or null if the
 * token is unknown, expired, or already used.
 */
export async function consumeLoginToken(token: string): Promise<string | null> {
  const rows = (await sql`
    update login_tokens
       set used_at = now()
     where token = ${token}
       and used_at is null
       and expires_at > now()
    returning email
  `) as { email: string }[];
  return rows[0]?.email ?? null;
}

/**
 * Finds the account for an email, creating it on first sign-in. Emails listed
 * in ADMIN_EMAILS are promoted to admin here, so the first admin never needs a
 * manual database edit.
 */
export async function getOrCreateUser(email: string): Promise<User> {
  const normalized = normalizeEmail(email);
  const shouldBeAdmin = ADMIN_EMAILS.includes(normalized);

  const rows = (await sql`
    insert into users (email, is_admin)
    values (${normalized}, ${shouldBeAdmin})
    on conflict (email) do update
      set is_admin = users.is_admin or ${shouldBeAdmin}
    returning id, email, name, phone, is_admin,
              notify_email, notify_whatsapp, phone_e164
  `) as User[];

  return rows[0];
}

export async function createSession(userId: string): Promise<void> {
  const id = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await sql`
    insert into sessions (id, user_id, expires_at)
    values (${id}, ${userId}, ${expiresAt.toISOString()})
  `;

  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (id) {
    await sql`delete from sessions where id = ${id}`;
  }
  jar.delete(SESSION_COOKIE);
}

/**
 * The signed-in user, or null. Cached per request so several server components
 * can call it without repeating the query.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;

  const rows = (await sql`
    select u.id, u.email, u.name, u.phone, u.is_admin,
           u.notify_email, u.notify_whatsapp, u.phone_e164
      from sessions s
      join users u on u.id = s.user_id
     where s.id = ${id}
       and s.expires_at > now()
  `) as User[];

  return rows[0] ?? null;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.is_admin) redirect("/schedule");
  return user;
}

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { requestSignInLink } from "./actions";

const ERRORS: Record<string, string> = {
  "bad-email":
    "That does not look like an email address. Please check it and try again.",
  "send-failed":
    "We could not send the email just now. Please try again in a moment.",
  "bad-link":
    "That sign-in link has already been used or has expired. Please enter your email to get a new one.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/schedule");

  const { error, email } = await searchParams;
  const message = error ? ERRORS[error] : null;

  return (
    <div className="stack-lg">
      <div>
        <h1>Sign in</h1>
        <p className="lede">
          Enter your email address and we will send you a link. Tap the link and
          you are in — there is no password to remember.
        </p>
      </div>

      {message && (
        <div className="notice notice-bad" role="alert">
          {message}
        </div>
      )}

      <form action={requestSignInLink} className="stack">
        <div className="field">
          <label htmlFor="email">Your email address</label>
          <input
            id="email"
            name="email"
            type="email"
            className="input"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            required
            autoFocus
            defaultValue={email ?? ""}
            placeholder="you@example.com"
          />
        </div>

        <SubmitButton
          className="btn btn-primary btn-block"
          pendingLabel="Sending your link…"
        >
          Send me a sign-in link
        </SubmitButton>
      </form>
    </div>
  );
}

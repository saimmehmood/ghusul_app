import Link from "next/link";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="stack-lg">
      <div>
        <h1>Check your email</h1>
        <p className="lede">
          {email ? (
            <>
              We just sent a sign-in link to <strong>{email}</strong>.
            </>
          ) : (
            <>We just sent you a sign-in link.</>
          )}
        </p>
      </div>

      <div className="helpbox">
        <h2>What to do next</h2>
        <ol>
          <li>Open your email app.</li>
          <li>
            Find the message titled <strong>&ldquo;Your sign-in link&rdquo;</strong>.
          </li>
          <li>
            Tap the green <strong>Sign in</strong> button inside it.
          </li>
          <li>That is it — you will be signed in.</li>
        </ol>
      </div>

      <div className="notice notice-info">
        <strong>Do not see it?</strong> Wait a minute, then look in your Spam or
        Junk folder. The link stops working after 30 minutes.
      </div>

      <Link href="/signin" className="btn btn-quiet btn-block">
        Use a different email address
      </Link>
    </div>
  );
}

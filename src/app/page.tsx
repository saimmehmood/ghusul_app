import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { MASJID_NAME } from "@/lib/config";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/schedule");

  return (
    <div className="stack-lg">
      <div>
        <h1>Volunteer for Ghusl</h1>
        <p className="lede">
          When our community needs help preparing someone for burial, the dates
          are posted here. Sign up for a day you are able to come.
        </p>
      </div>

      <Link href="/signin" className="btn btn-primary btn-block">
        Sign in to get started
      </Link>

      <div className="helpbox">
        <h2>How it works</h2>
        <ol>
          <li>
            Enter your email address. We send you a link — no password to
            remember.
          </li>
          <li>You will see the days that need volunteers.</li>
          <li>
            Tap <strong>Volunteer for this day</strong> on a day you can come.
          </li>
          <li>
            For the first 4 hours after a day is posted, spots are saved for
            people who have not done Ghusl yet that month. After 4 hours, anyone
            may sign up.
          </li>
        </ol>
      </div>

      <p className="foot">{MASJID_NAME}</p>
    </div>
  );
}

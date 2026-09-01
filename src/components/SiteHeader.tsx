import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { MASJID_NAME } from "@/lib/config";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="masthead">
      <div className="masthead-inner">
        <Link className="brand" href={user ? "/schedule" : "/"}>
          {MASJID_NAME}
        </Link>

        <nav className="nav" aria-label="Main">
          {user ? (
            <>
              <Link href="/schedule">Schedule</Link>
              <Link href="/mine">My days</Link>
              {user.is_admin && <Link href="/admin">Admin</Link>}
              <form action="/signout" method="post">
                <button type="submit">Sign out</button>
              </form>
            </>
          ) : (
            <Link href="/signin">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}

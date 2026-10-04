import Link from "next/link";

import { NavLink } from "@/components/NavLink";
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
              <NavLink href="/schedule">Schedule</NavLink>
              <NavLink href="/mine">My days</NavLink>
              {user.is_admin && <NavLink href="/admin">Admin</NavLink>}
              <form action="/signout" method="post">
                <button type="submit">Sign out</button>
              </form>
            </>
          ) : (
            <NavLink href="/signin">Sign in</NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}

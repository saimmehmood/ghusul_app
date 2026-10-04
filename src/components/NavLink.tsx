"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A header link that marks itself when you are on that page. The pathname is
 * only knowable in the browser, so this is the one client component in an
 * otherwise server-rendered header.
 *
 * aria-current carries the same fact to a screen reader, which the highlight
 * alone would not.
 */
export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={active ? "is-active" : undefined}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

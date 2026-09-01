import type { Metadata, Viewport } from "next";

import "./globals.css";
import { MASJID_NAME } from "@/lib/config";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: MASJID_NAME,
  description:
    "Sign up to volunteer for Ghusl. Simple scheduling for our masjid community.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Older eyes often need to pinch-zoom. Never lock that away.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main className="page">{children}</main>
      </body>
    </html>
  );
}

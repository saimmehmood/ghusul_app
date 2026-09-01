import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth";
import { appUrl } from "@/lib/config";

export async function POST() {
  await destroySession();
  return NextResponse.redirect(`${appUrl()}/`, { status: 303 });
}

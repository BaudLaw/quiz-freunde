import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getAdminPassword,
  verifyAdminSessionValue,
} from "@/lib/adminSession";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE);

  const isValid = verifyAdminSessionValue(
    sessionCookie?.value,
    getAdminPassword()
  );

  return NextResponse.json({ ok: isValid }, { status: isValid ? 200 : 401 });
}

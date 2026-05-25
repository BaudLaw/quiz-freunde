import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  getAdminPassword,
  verifyAdminSessionValue,
} from "@/lib/adminSession";

export async function isAdminRequest() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE);

  return verifyAdminSessionValue(sessionCookie?.value, getAdminPassword());
}

import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionValue,
  getAdminPassword,
} from "@/lib/adminSession";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

function passwordsMatch(input: string, expected: string) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(inputBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(`admin-login:${getClientIp(request)}`, {
    limit: 8,
    windowMs: 5 * 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: `Zu viele Login-Versuche. Bitte in ${rateLimit.retryAfterSeconds} Sekunden erneut versuchen.`,
      },
      { status: 429 }
    );
  }

  const configuredPassword = getAdminPassword();

  if (!configuredPassword) {
    return NextResponse.json(
      { ok: false, error: "Kein Admin-Passwort konfiguriert." },
      { status: 500 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Ungueltige Anfrage." },
      { status: 400 }
    );
  }

  const password =
    typeof body === "object" &&
    body !== null &&
    "password" in body &&
    typeof body.password === "string"
      ? body.password.trim()
      : "";

  if (!passwordsMatch(password, configuredPassword)) {
    return NextResponse.json(
      { ok: false, error: "Falsches Passwort." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    createAdminSessionValue(configuredPassword),
    {
      httpOnly: true,
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    }
  );

  return response;
}

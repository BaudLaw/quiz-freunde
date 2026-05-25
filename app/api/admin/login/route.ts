import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getConfiguredPassword() {
  return (
    process.env.ADMIN_PASSWORD ||
    process.env.HOST_PASSWORD ||
    process.env.NEXT_PUBLIC_ADMIN_PASSWORD ||
    process.env.NEXT_PUBLIC_HOST_PASSWORD ||
    ""
  );
}

function passwordsMatch(input: string, expected: string) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(inputBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  const configuredPassword = getConfiguredPassword();

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
      ? body.password
      : "";

  if (!passwordsMatch(password, configuredPassword)) {
    return NextResponse.json(
      { ok: false, error: "Falsches Passwort." },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}

import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_SESSION_COOKIE = "quizfreunde_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export function getAdminPassword() {
  return (process.env.ADMIN_PASSWORD || "").trim();
}

export function createAdminSessionValue(secret: string) {
  const createdAt = Date.now().toString();
  const signature = signValue(createdAt, secret);

  return `${createdAt}.${signature}`;
}

export function verifyAdminSessionValue(value: string | undefined, secret: string) {
  if (!value || !secret) {
    return false;
  }

  const [createdAt, signature] = value.split(".");

  if (!createdAt || !signature) {
    return false;
  }

  const createdAtNumber = Number(createdAt);

  if (!Number.isFinite(createdAtNumber)) {
    return false;
  }

  const sessionAgeSeconds = (Date.now() - createdAtNumber) / 1000;

  if (
    sessionAgeSeconds < 0 ||
    sessionAgeSeconds > ADMIN_SESSION_MAX_AGE_SECONDS
  ) {
    return false;
  }

  return signaturesMatch(signature, signValue(createdAt, secret));
}

function signValue(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function signaturesMatch(input: string, expected: string) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(inputBuffer, expectedBuffer);
}

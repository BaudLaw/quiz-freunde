import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { supabase } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type JoinInput = {
  roomCode?: unknown;
  playerName?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { data: null, error: { message } },
    { status }
  );
}

export async function POST(request: Request) {
  let input: JoinInput;

  try {
    input = await request.json();
  } catch {
    return jsonError("Ungueltige Anfrage.", 400);
  }

  const roomCode =
    typeof input.roomCode === "string"
      ? input.roomCode.trim().toUpperCase()
      : "";
  const playerName =
    typeof input.playerName === "string" ? input.playerName.trim() : "";

  if (!roomCode || !playerName) {
    return jsonError("Name und Raumcode sind erforderlich.", 400);
  }

  const rateLimit = checkRateLimit(
    `join:${getClientIp(request)}:${roomCode}`,
    {
      limit: 20,
      windowMs: 60_000,
    }
  );

  if (!rateLimit.allowed) {
    return jsonError(
      `Zu viele Beitrittsversuche. Bitte in ${rateLimit.retryAfterSeconds} Sekunden erneut versuchen.`,
      429
    );
  }

  const { data: roomData, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", roomCode)
    .maybeSingle();

  if (roomError) {
    return jsonError(roomError.message, 500);
  }

  if (!roomData) {
    return jsonError("Raum nicht gefunden.", 404);
  }

  const { data: existingPlayer, error: existingPlayerError } = await supabase
    .from("players")
    .select("id")
    .eq("room_code", roomCode)
    .eq("player_name", playerName)
    .maybeSingle();

  if (existingPlayerError) {
    return jsonError(existingPlayerError.message, 500);
  }

  if (existingPlayer) {
    return jsonError("Name bereits vergeben.", 409);
  }

  const { error: insertError } = await supabase.from("players").insert([
    {
      room_code: roomCode,
      player_name: playerName,
      score: 0,
    },
  ]);

  if (insertError) {
    return jsonError(insertError.message, 500);
  }

  return NextResponse.json({
    data: { room: roomData },
    error: null,
  });
}

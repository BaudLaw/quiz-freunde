import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type BuzzInput = {
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
  let input: BuzzInput;

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
    return jsonError("Spieler und Raumcode sind erforderlich.", 400);
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

  if (
    roomData.buzz_locked ||
    roomData.active_player ||
    roomData.turn_player === playerName ||
    roomData.game_state !== "buzzing_open"
  ) {
    return NextResponse.json({
      data: { accepted: false },
      error: null,
    });
  }

  const { data: playerData, error: playerError } = await supabase
    .from("players")
    .select("id")
    .eq("room_code", roomCode)
    .eq("player_name", playerName)
    .maybeSingle();

  if (playerError) {
    return jsonError(playerError.message, 500);
  }

  if (!playerData) {
    return jsonError("Spieler wurde nicht gefunden.", 404);
  }

  const { data: existingBuzz, error: existingBuzzError } = await supabase
    .from("buzzes")
    .select("id")
    .eq("room_code", roomCode)
    .eq("question_number", roomData.current_question)
    .eq("player_name", playerName)
    .maybeSingle();

  if (existingBuzzError) {
    return jsonError(existingBuzzError.message, 500);
  }

  if (existingBuzz) {
    return NextResponse.json({
      data: { accepted: false },
      error: null,
    });
  }

  const { error: insertError } = await supabase.from("buzzes").insert([
    {
      room_code: roomCode,
      question_number: roomData.current_question,
      player_name: playerName,
      is_blocked: false,
    },
  ]);

  if (insertError) {
    return jsonError(insertError.message, 500);
  }

  return NextResponse.json({
    data: { accepted: true },
    error: null,
  });
}

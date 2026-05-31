import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminRequest";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type HostRoomActionInput = {
  action?: unknown;
  roomCode?: unknown;
  gameState?: unknown;
  playerName?: unknown;
};

const allowedGameStates = new Set([
  "lobby",
  "board",
  "question",
  "buzzing_open",
  "player_answering",
  "solution",
  "finished",
]);

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { data: null, error: { message } },
    { status }
  );
}

async function updateRoom(roomCode: string, values: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("rooms")
    .update(values)
    .eq("code", roomCode)
    .select("*")
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return jsonError("Nicht autorisiert.", 401);
  }

  let input: HostRoomActionInput;

  try {
    input = await request.json();
  } catch {
    return jsonError("Ungueltige Anfrage.", 400);
  }

  const action = typeof input.action === "string" ? input.action : "";
  const roomCode = typeof input.roomCode === "string" ? input.roomCode.trim() : "";

  if (!action || !roomCode) {
    return jsonError("Pflichtfelder fehlen.", 400);
  }

  if (action === "set-game-state") {
    const gameState =
      typeof input.gameState === "string" ? input.gameState.trim() : "";

    if (!allowedGameStates.has(gameState)) {
      return jsonError("Spielstatus ist ungueltig.", 400);
    }

    const { data, error } = await updateRoom(roomCode, { game_state: gameState });

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ data: { room: data }, error: null });
  }

  if (action === "set-turn-player") {
    const playerName =
      typeof input.playerName === "string" ? input.playerName.trim() : "";

    const { data, error } = await updateRoom(roomCode, {
      turn_player: playerName,
    });

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ data: { room: data }, error: null });
  }

  if (action === "open-board") {
    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", roomCode)
      .maybeSingle();

    if (roomError) {
      return jsonError(roomError.message, 500);
    }

    const { data: playersData, error: playersError } = await supabase
      .from("players")
      .select("*")
      .eq("room_code", roomCode)
      .order("score", { ascending: false });

    if (playersError) {
      return jsonError(playersError.message, 500);
    }

    const firstPlayer = playersData?.[0];
    const { data, error } = await updateRoom(roomCode, {
      game_state: "board",
      turn_player: roomData?.turn_player || firstPlayer?.player_name || "",
    });

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ data: { room: data }, error: null });
  }

  if (action === "assign-buzz-answer") {
    const playerName =
      typeof input.playerName === "string" ? input.playerName.trim() : "";

    if (!playerName) {
      return jsonError("Spieler fehlt.", 400);
    }

    const { data, error } = await updateRoom(roomCode, {
      active_player: playerName,
      game_state: "player_answering",
      buzz_locked: true,
    });

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ data: { room: data }, error: null });
  }

  return jsonError("Aktion ist ungueltig.", 400);
}

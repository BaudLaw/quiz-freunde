import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminRequest";
import { supabase } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type HostRoomActionInput = {
  action?: unknown;
  roomCode?: unknown;
  gameState?: unknown;
  playerName?: unknown;
  questionId?: unknown;
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

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return jsonError("Nicht autorisiert.", 401);
  }

  const url = new URL(request.url);
  const roomCode = url.searchParams.get("roomCode")?.trim() || "";

  if (!roomCode) {
    return jsonError("Pflichtfelder fehlen.", 400);
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
    return NextResponse.json({
      data: {
        room: null,
        players: [],
        activeQuestion: null,
        buzzes: [],
      },
      error: null,
    });
  }

  const { data: playerData, error: playersError } = await supabase
    .from("players")
    .select("*")
    .eq("room_code", roomCode)
    .order("score", { ascending: false });

  if (playersError) {
    return jsonError(playersError.message, 500);
  }

  const { data: questionData, error: questionError } = await supabase
    .from("questions")
    .select("*")
    .eq("question_number", roomData.current_question)
    .eq("room_code", roomCode)
    .maybeSingle();

  if (questionError) {
    return jsonError(questionError.message, 500);
  }

  const { data: buzzData, error: buzzError } = await supabase
    .from("buzzes")
    .select("*")
    .eq("room_code", roomCode)
    .eq("question_number", roomData.current_question)
    .eq("is_blocked", false)
    .order("created_at", { ascending: true });

  if (buzzError) {
    return jsonError(buzzError.message, 500);
  }

  return NextResponse.json({
    data: {
      room: roomData,
      players: playerData || [],
      activeQuestion: questionData || null,
      buzzes: buzzData || [],
    },
    error: null,
  });
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

  if (action === "select-question") {
    const questionId =
      typeof input.questionId === "string" ? input.questionId.trim() : "";

    if (!questionId) {
      return jsonError("Frage fehlt.", 400);
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
      return jsonError("Raum wurde nicht gefunden.", 404);
    }

    const { data: questionData, error: questionError } = await supabase
      .from("questions")
      .select("id, question_number, is_played")
      .eq("id", questionId)
      .eq("room_code", roomCode)
      .maybeSingle();

    if (questionError) {
      return jsonError(questionError.message, 500);
    }

    if (!questionData) {
      return jsonError("Frage wurde nicht gefunden.", 404);
    }

    if (questionData.is_played) {
      return jsonError("Diese Frage wurde bereits gespielt.", 400);
    }

    const { error: deleteBuzzError } = await supabase
      .from("buzzes")
      .delete()
      .eq("room_code", roomCode)
      .eq("question_number", questionData.question_number);

    if (deleteBuzzError) {
      return jsonError(deleteBuzzError.message, 500);
    }

    const { data: updatedRoom, error: updateRoomError } = await updateRoom(
      roomCode,
      {
        current_question: questionData.question_number,
        game_state: "question",
        active_player: roomData.turn_player || "",
        buzz_locked: true,
        feedback: "",
      }
    );

    if (updateRoomError) {
      return jsonError(updateRoomError.message, 500);
    }

    const { error: updateQuestionError } = await supabase
      .from("questions")
      .update({ is_played: true })
      .eq("id", questionId)
      .eq("room_code", roomCode);

    if (updateQuestionError) {
      return jsonError(updateQuestionError.message, 500);
    }

    return NextResponse.json({
      data: { room: updatedRoom, questionId },
      error: null,
    });
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

  if (action === "clear-feedback") {
    const { data, error } = await updateRoom(roomCode, {
      feedback: "",
    });

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ data: { room: data }, error: null });
  }

  if (action === "finish-room") {
    const { data, error } = await updateRoom(roomCode, {
      game_state: "finished",
      timer_end: 0,
    });

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ data: { room: data }, error: null });
  }

  if (action === "start-timer") {
    const { data, error } = await updateRoom(roomCode, {
      timer_end: Date.now() + 30000,
    });

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ data: { room: data }, error: null });
  }

  return jsonError("Aktion ist ungueltig.", 400);
}

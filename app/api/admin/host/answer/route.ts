import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminRequest";
import { supabase } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type HostAnswerInput = {
  action?: unknown;
  roomCode?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { data: null, error: { message } },
    { status }
  );
}

async function loadRoom(roomCode: string) {
  return supabase.from("rooms").select("*").eq("code", roomCode).maybeSingle();
}

async function loadPlayers(roomCode: string) {
  return supabase
    .from("players")
    .select("*")
    .eq("room_code", roomCode)
    .order("score", { ascending: false });
}

async function loadCurrentQuestion(roomCode: string, questionNumber: number) {
  return supabase
    .from("questions")
    .select("*")
    .eq("room_code", roomCode)
    .eq("question_number", questionNumber)
    .maybeSingle();
}

async function hasNoRemainingQuestions(roomCode: string) {
  const { data, error } = await supabase
    .from("questions")
    .select("id")
    .eq("room_code", roomCode)
    .eq("is_played", false);

  if (error) {
    return { data: false, error };
  }

  return { data: (data || []).length === 0, error: null };
}

async function moveToSolution(roomCode: string, feedback: string) {
  const { data: roomData, error: roomError } = await loadRoom(roomCode);

  if (roomError) {
    return { data: null, error: roomError };
  }

  const { data: playersData, error: playersError } = await loadPlayers(roomCode);

  if (playersError) {
    return { data: null, error: playersError };
  }

  const players = playersData || [];
  const currentIndex = roomData?.turn_index || 0;
  const nextIndex = players.length > 0 ? (currentIndex + 1) % players.length : 0;
  const nextPlayer = players[nextIndex];

  const { data, error } = await supabase
    .from("rooms")
    .update({
      game_state: "solution",
      feedback,
      timer_end: 0,
      active_player: "",
      buzz_locked: true,
      turn_index: nextIndex,
      turn_player: nextPlayer?.player_name || "",
    })
    .eq("code", roomCode)
    .select("*")
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  return { data: { room: data }, error: null };
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return jsonError("Nicht autorisiert.", 401);
  }

  let input: HostAnswerInput;

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

  if (action === "show-solution") {
    const solutionResult = await moveToSolution(roomCode, "");

    if (solutionResult.error) {
      return jsonError(solutionResult.error.message, 500);
    }

    const remainingResult = await hasNoRemainingQuestions(roomCode);

    if (remainingResult.error) {
      return jsonError(remainingResult.error.message, 500);
    }

    return NextResponse.json({
      data: {
        ...solutionResult.data,
        shouldClearFeedback: false,
        shouldFinishAfterDelay: remainingResult.data,
      },
      error: null,
    });
  }

  if (action === "mark-correct") {
    const { data: roomData, error: roomError } = await loadRoom(roomCode);

    if (roomError) {
      return jsonError(roomError.message, 500);
    }

    const answeringPlayer = roomData?.active_player || roomData?.turn_player;

    if (!answeringPlayer) {
      return jsonError("Kein Spieler ausgewaehlt.", 400);
    }

    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .select("*")
      .eq("room_code", roomCode)
      .eq("player_name", answeringPlayer)
      .maybeSingle();

    if (playerError) {
      return jsonError(playerError.message, 500);
    }

    const { data: questionData, error: questionError } =
      await loadCurrentQuestion(roomCode, Number(roomData?.current_question || 0));

    if (questionError) {
      return jsonError(questionError.message, 500);
    }

    if (playerData && questionData) {
      const { error: scoreError } = await supabase
        .from("players")
        .update({
          score: Number(playerData.score) + Number(questionData.points || 0),
        })
        .eq("id", playerData.id);

      if (scoreError) {
        return jsonError(scoreError.message, 500);
      }
    }

    const solutionResult = await moveToSolution(roomCode, "correct");

    if (solutionResult.error) {
      return jsonError(solutionResult.error.message, 500);
    }

    const remainingResult = await hasNoRemainingQuestions(roomCode);

    if (remainingResult.error) {
      return jsonError(remainingResult.error.message, 500);
    }

    return NextResponse.json({
      data: {
        ...solutionResult.data,
        shouldClearFeedback: true,
        shouldFinishAfterDelay: remainingResult.data,
      },
      error: null,
    });
  }

  if (action === "mark-wrong") {
    const { data: roomData, error: roomError } = await loadRoom(roomCode);

    if (roomError) {
      return jsonError(roomError.message, 500);
    }

    if (roomData?.active_player) {
      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .select("*")
        .eq("room_code", roomCode)
        .eq("player_name", roomData.active_player)
        .maybeSingle();

      if (playerError) {
        return jsonError(playerError.message, 500);
      }

      const { data: questionData, error: questionError } =
        await loadCurrentQuestion(roomCode, Number(roomData.current_question || 0));

      if (questionError) {
        return jsonError(questionError.message, 500);
      }

      if (playerData && questionData) {
        const { error: scoreError } = await supabase
          .from("players")
          .update({
            score:
              Number(playerData.score) -
              Math.floor(Number(questionData.points || 0) / 2),
          })
          .eq("id", playerData.id);

        if (scoreError) {
          return jsonError(scoreError.message, 500);
        }
      }

      const { error: deleteBuzzError } = await supabase
        .from("buzzes")
        .delete()
        .eq("room_code", roomCode)
        .eq("question_number", roomData.current_question)
        .eq("player_name", roomData.active_player);

      if (deleteBuzzError) {
        return jsonError(deleteBuzzError.message, 500);
      }

      const { error: insertBuzzError } = await supabase.from("buzzes").insert([
        {
          room_code: roomCode,
          question_number: roomData.current_question,
          player_name: roomData.active_player,
          is_blocked: true,
        },
      ]);

      if (insertBuzzError) {
        return jsonError(insertBuzzError.message, 500);
      }
    }

    const { data, error } = await supabase
      .from("rooms")
      .update({
        game_state: "buzzing_open",
        active_player: "",
        buzz_locked: false,
        feedback: "wrong",
        timer_end: 0,
      })
      .eq("code", roomCode)
      .select("*")
      .maybeSingle();

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({
      data: {
        room: data,
        shouldClearFeedback: true,
        shouldFinishAfterDelay: false,
      },
      error: null,
    });
  }

  return jsonError("Aktion ist ungueltig.", 400);
}

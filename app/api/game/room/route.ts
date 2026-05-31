import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { data: null, error: { message } },
    { status }
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const roomCode = url.searchParams.get("roomCode")?.trim().toUpperCase() || "";
  const playerName = url.searchParams.get("playerName")?.trim() || "";
  const includeAllQuestions = url.searchParams.get("allQuestions") === "true";

  if (!roomCode) {
    return jsonError("Raumcode fehlt.", 400);
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
        leaderboard: [],
        question: null,
        allQuestions: [],
        buzzes: [],
        isBlocked: false,
      },
      error: null,
    });
  }

  const { data: playerData, error: playerError } = await supabase
    .from("players")
    .select("*")
    .eq("room_code", roomCode)
    .order("score", { ascending: false });

  if (playerError) {
    return jsonError(playerError.message, 500);
  }

  const { data: questionData, error: questionError } = await supabase
    .from("questions")
    .select("*")
    .eq("room_code", roomCode)
    .eq("question_number", roomData.current_question)
    .maybeSingle();

  if (questionError) {
    return jsonError(questionError.message, 500);
  }

  const allQuestionsQuery = includeAllQuestions
    ? await supabase
        .from("questions")
        .select("*")
        .eq("room_code", roomCode)
        .order("question_number", { ascending: true })
    : { data: [], error: null };

  if (allQuestionsQuery.error) {
    return jsonError(allQuestionsQuery.error.message, 500);
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

  const blockedBuzzQuery = playerName
    ? await supabase
        .from("buzzes")
        .select("id")
        .eq("room_code", roomCode)
        .eq("question_number", roomData.current_question)
        .eq("player_name", playerName)
        .eq("is_blocked", true)
        .limit(1)
    : { data: [], error: null };

  if (blockedBuzzQuery.error) {
    return jsonError(blockedBuzzQuery.error.message, 500);
  }

  return NextResponse.json({
    data: {
      room: roomData,
      players: playerData || [],
      leaderboard: playerData || [],
      question: questionData || null,
      allQuestions: allQuestionsQuery.data || [],
      buzzes: buzzData || [],
      isBlocked: (blockedBuzzQuery.data?.length || 0) > 0,
    },
    error: null,
  });
}

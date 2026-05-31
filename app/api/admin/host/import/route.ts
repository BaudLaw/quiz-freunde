import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminRequest";
import { supabase } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type ImportHostQuizInput = {
  title?: unknown;
  questions?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { data: null, error: { message } },
    { status }
  );
}

function normalizeQuestion(question: Record<string, unknown>, index: number) {
  return {
    room_code:
      typeof question.room_code === "string" ? question.room_code : "",
    question_number: index + 1,
    category: typeof question.category === "string" ? question.category : "",
    points: Number(question.points || 100),
    question: typeof question.question === "string" ? question.question : "",
    solution: typeof question.solution === "string" ? question.solution : "",
    image_url: typeof question.image_url === "string" ? question.image_url : "",
    audio_url: typeof question.audio_url === "string" ? question.audio_url : "",
    solution_image_url:
      typeof question.solution_image_url === "string"
        ? question.solution_image_url
        : "",
    solution_audio_url:
      typeof question.solution_audio_url === "string"
        ? question.solution_audio_url
        : "",
    accepted_answers: Array.isArray(question.accepted_answers)
      ? question.accepted_answers
      : typeof question.accepted_answers === "string"
        ? question.accepted_answers
        : [],
    host_notes:
      typeof question.host_notes === "string" ? question.host_notes : "",
    is_played: false,
  };
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return jsonError("Nicht autorisiert.", 401);
  }

  let input: ImportHostQuizInput;

  try {
    input = await request.json();
  } catch {
    return jsonError("Ungueltige Anfrage.", 400);
  }

  const title = typeof input.title === "string" ? input.title.trim() : "";
  const questions = Array.isArray(input.questions)
    ? input.questions.filter(
        (question): question is Record<string, unknown> =>
          typeof question === "object" && question !== null
      )
    : [];

  if (!title || questions.length === 0) {
    return jsonError("Pflichtfelder fehlen.", 400);
  }

  const { data: quizSet, error: quizSetError } = await supabase
    .from("quiz_sets")
    .insert({ title })
    .select("id, title")
    .single();

  if (quizSetError || !quizSet) {
    return jsonError(
      quizSetError?.message || "Quizset konnte nicht erstellt werden.",
      500
    );
  }

  const questionsToInsert = questions.map((question, index) => ({
    ...normalizeQuestion(question, index),
    quiz_set_id: quizSet.id,
  }));

  const { error: insertError } = await supabase
    .from("questions")
    .insert(questionsToInsert);

  if (insertError) {
    return jsonError(insertError.message, 500);
  }

  return NextResponse.json({
    data: {
      quizSet,
      insertedCount: questionsToInsert.length,
    },
    error: null,
  });
}

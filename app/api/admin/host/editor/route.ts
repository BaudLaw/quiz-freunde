import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminRequest";
import { supabase } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type SaveHostEditorInput = {
  quizSetId?: unknown;
  questions?: unknown;
};

type DeleteHostEditorQuestionInput = {
  id?: unknown;
  quizSetId?: unknown;
  questionNumber?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { data: null, error: { message } },
    { status }
  );
}

function normalizeQuestion(question: Record<string, unknown>, index: number) {
  return {
    quiz_set_id: question.quiz_set_id,
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

  let input: SaveHostEditorInput;

  try {
    input = await request.json();
  } catch {
    return jsonError("Ungueltige Anfrage.", 400);
  }

  const quizSetId =
    typeof input.quizSetId === "string" ? input.quizSetId.trim() : "";
  const questions = Array.isArray(input.questions)
    ? input.questions.filter(
        (question): question is Record<string, unknown> =>
          typeof question === "object" && question !== null
      )
    : [];

  if (!quizSetId) {
    return jsonError("Pflichtfelder fehlen.", 400);
  }

  const questionsToInsert = questions.map((question, index) => ({
    ...normalizeQuestion(question, index),
    quiz_set_id: quizSetId,
  }));

  const { error: deleteError } = await supabase
    .from("questions")
    .delete()
    .eq("quiz_set_id", quizSetId);

  if (deleteError) {
    return jsonError(deleteError.message, 500);
  }

  if (questionsToInsert.length === 0) {
    return NextResponse.json({
      data: { savedCount: 0 },
      error: null,
    });
  }

  const { error: insertError } = await supabase
    .from("questions")
    .insert(questionsToInsert);

  if (insertError) {
    return jsonError(insertError.message, 500);
  }

  return NextResponse.json({
    data: { savedCount: questionsToInsert.length },
    error: null,
  });
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) {
    return jsonError("Nicht autorisiert.", 401);
  }

  let input: DeleteHostEditorQuestionInput;

  try {
    input = await request.json();
  } catch {
    return jsonError("Ungueltige Anfrage.", 400);
  }

  const id = typeof input.id === "string" ? input.id.trim() : "";
  const quizSetId =
    typeof input.quizSetId === "string" ? input.quizSetId.trim() : "";
  const questionNumber = Number(input.questionNumber);

  if (!id && (!quizSetId || !Number.isFinite(questionNumber))) {
    return jsonError("Pflichtfelder fehlen.", 400);
  }

  const { error } = id
    ? await supabase.from("questions").delete().eq("id", id)
    : await supabase
        .from("questions")
        .delete()
        .eq("quiz_set_id", quizSetId)
        .eq("question_number", questionNumber);

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({ data: null, error: null });
}

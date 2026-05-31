import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminRequest";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type UpdateQuizSetInput = {
  id?: unknown;
  title?: unknown;
};

type DuplicateQuizSetInput = {
  sourceQuizSetId?: unknown;
  title?: unknown;
};

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { data: null, error: { message: "Nicht autorisiert." } },
      { status: 401 }
    );
  }

  let input: DuplicateQuizSetInput;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Ungueltige Anfrage." } },
      { status: 400 }
    );
  }

  const sourceQuizSetId =
    typeof input.sourceQuizSetId === "string" ? input.sourceQuizSetId : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";

  if (!sourceQuizSetId || !title) {
    return NextResponse.json(
      { data: null, error: { message: "Pflichtfelder fehlen." } },
      { status: 400 }
    );
  }

  const { data: sourceQuestions, error: sourceQuestionsError } = await supabase
    .from("questions")
    .select("*")
    .eq("quiz_set_id", sourceQuizSetId)
    .order("question_number", { ascending: true });

  if (sourceQuestionsError) {
    return NextResponse.json(
      { data: null, error: { message: sourceQuestionsError.message } },
      { status: 500 }
    );
  }

  if (!sourceQuestions || sourceQuestions.length === 0) {
    return NextResponse.json(
      { data: null, error: { message: "Dieses Quiz-Set enthaelt keine Fragen." } },
      { status: 400 }
    );
  }

  const { data: newQuizSet, error: newQuizSetError } = await supabase
    .from("quiz_sets")
    .insert({ title })
    .select("id")
    .single();

  if (newQuizSetError) {
    return NextResponse.json(
      { data: null, error: { message: newQuizSetError.message } },
      { status: 500 }
    );
  }

  const questionsToInsert = sourceQuestions.map((question, index) => ({
    quiz_set_id: newQuizSet.id,
    room_code: "GENERATED",
    source_pool_question_id: question.source_pool_question_id,
    question_number: index + 1,
    category: question.category,
    points: question.points,
    question: question.question,
    solution: question.solution,
    accepted_answers: question.accepted_answers || [],
    host_notes: question.host_notes || "",
    image_url: question.image_url || "",
    audio_url: question.audio_url || "",
    solution_image_url: question.solution_image_url || "",
    solution_audio_url: question.solution_audio_url || "",
    is_played: false,
  }));

  const { error: insertQuestionsError } = await supabase
    .from("questions")
    .insert(questionsToInsert);

  if (insertQuestionsError) {
    return NextResponse.json(
      { data: null, error: { message: insertQuestionsError.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: { id: newQuizSet.id, title },
    error: null,
  });
}

export async function PATCH(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { data: null, error: { message: "Nicht autorisiert." } },
      { status: 401 }
    );
  }

  let input: UpdateQuizSetInput;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Ungueltige Anfrage." } },
      { status: 400 }
    );
  }

  const id = typeof input.id === "string" ? input.id : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";

  if (!id || !title) {
    return NextResponse.json(
      { data: null, error: { message: "Pflichtfelder fehlen." } },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("quiz_sets")
    .update({ title })
    .eq("id", id)
    .select("id, title")
    .single();

  if (error) {
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data, error: null });
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { data: null, error: { message: "Nicht autorisiert." } },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";

  if (!id) {
    return NextResponse.json(
      { data: null, error: { message: "Pflichtfelder fehlen." } },
      { status: 400 }
    );
  }

  const { error: questionsError } = await supabase
    .from("questions")
    .delete()
    .eq("quiz_set_id", id);

  if (questionsError) {
    return NextResponse.json(
      { data: null, error: { message: questionsError.message } },
      { status: 500 }
    );
  }

  const { data: deletedQuizSet, error: quizSetError } = await supabase
    .from("quiz_sets")
    .delete()
    .eq("id", id)
    .select("id, title")
    .maybeSingle();

  if (quizSetError) {
    return NextResponse.json(
      { data: null, error: { message: quizSetError.message } },
      { status: 500 }
    );
  }

  if (!deletedQuizSet) {
    return NextResponse.json(
      {
        data: null,
        error: {
          message:
            "Quiz-Set wurde nicht geloescht. Die ID wurde nicht gefunden oder Delete ist blockiert.",
        },
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: deletedQuizSet, error: null });
}

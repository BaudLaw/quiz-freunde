import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminRequest";
import { supabase } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type InsertQuizSetQuestionsInput = {
  questions?: unknown;
};

type UpdateQuizSetQuestionInput = {
  id?: unknown;
  values?: unknown;
};

const allowedUpdateFields = new Set([
  "source_pool_question_id",
  "category",
  "points",
  "question",
  "solution",
  "accepted_answers",
  "host_notes",
  "image_url",
  "audio_url",
  "solution_image_url",
  "solution_audio_url",
  "is_played",
]);

function pickAllowedQuestionValues(values: unknown) {
  if (typeof values !== "object" || values === null) {
    return null;
  }

  const nextValues: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(values)) {
    if (allowedUpdateFields.has(key)) {
      nextValues[key] = value;
    }
  }

  return nextValues;
}

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { data: null, error: { message: "Nicht autorisiert." } },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const quizSetId = url.searchParams.get("quizSetId") || "";
  const fields = url.searchParams.get("fields") || "full";

  if (!quizSetId) {
    return NextResponse.json(
      { data: null, error: { message: "Pflichtfelder fehlen." } },
      { status: 400 }
    );
  }

  const selectFields =
    fields === "summary"
      ? "id, question_number, category, points, source_pool_question_id"
      : fields === "display"
        ? "id, question_number, category, points, question, solution, source_pool_question_id"
        : "*";

  const { data, error } = await supabase
    .from("questions")
    .select(selectFields)
    .eq("quiz_set_id", quizSetId)
    .order("question_number", { ascending: true });

  if (error) {
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data, error: null });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { data: null, error: { message: "Nicht autorisiert." } },
      { status: 401 }
    );
  }

  let input: InsertQuizSetQuestionsInput;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Ungueltige Anfrage." } },
      { status: 400 }
    );
  }

  const questions = Array.isArray(input.questions)
    ? input.questions.filter(
        (question): question is Record<string, unknown> =>
          typeof question === "object" && question !== null
      )
    : [];

  if (questions.length === 0) {
    return NextResponse.json(
      { data: null, error: { message: "Keine Fragen angegeben." } },
      { status: 400 }
    );
  }

  const questionsToInsert = questions.map((question) => ({
    ...question,
    room_code: "GENERATED",
  }));

  const { error } = await supabase.from("questions").insert(questionsToInsert);

  if (error) {
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: { insertedCount: questionsToInsert.length },
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

  let input: UpdateQuizSetQuestionInput;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Ungueltige Anfrage." } },
      { status: 400 }
    );
  }

  const id = typeof input.id === "string" ? input.id.trim() : "";
  const values = pickAllowedQuestionValues(input.values);

  if (!id || !values || Object.keys(values).length === 0) {
    return NextResponse.json(
      { data: null, error: { message: "Pflichtfelder fehlen." } },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("questions")
    .update(values)
    .eq("id", id)
    .eq("room_code", "GENERATED")
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { data: null, error: { message: "Frage wurde nicht gefunden." } },
      { status: 404 }
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

  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", id)
    .not("quiz_set_id", "is", null);

  if (error) {
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: null, error: null });
}

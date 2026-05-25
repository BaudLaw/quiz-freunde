import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminRequest";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type InsertQuizSetQuestionsInput = {
  questions?: unknown;
};

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
    .eq("room_code", "GENERATED");

  if (error) {
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: null, error: null });
}

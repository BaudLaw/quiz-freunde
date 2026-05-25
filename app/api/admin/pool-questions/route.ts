import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminRequest";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type CreatePoolQuestionInput = Record<string, unknown>;
type UpdatePoolQuestionInput = {
  id?: unknown;
  values?: unknown;
};

const UPDATABLE_FIELDS = [
  "category",
  "difficulty",
  "question",
  "solution",
  "accepted_answers",
  "host_notes",
  "image_url",
  "audio_url",
  "solution_image_url",
  "solution_audio_url",
  "source",
  "tags",
  "usage_count",
  "last_used_at",
  "is_active",
] as const;

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { data: null, error: { message: "Nicht autorisiert." } },
      { status: 401 }
    );
  }

  let input: CreatePoolQuestionInput;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Ungueltige Anfrage." } },
      { status: 400 }
    );
  }

  const poolId = optionalString(input.pool_id);
  const category = optionalString(input.category);
  const question = optionalString(input.question);
  const difficulty = Number(input.difficulty);

  if (
    !poolId ||
    !category ||
    !question ||
    !Number.isInteger(difficulty) ||
    difficulty < 1 ||
    difficulty > 5
  ) {
    return NextResponse.json(
      { data: null, error: { message: "Pflichtfelder fehlen." } },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("pool_questions")
    .insert({
      pool_id: poolId,
      category,
      difficulty,
      question,
      solution: optionalString(input.solution),
      accepted_answers: stringArray(input.accepted_answers),
      host_notes: optionalString(input.host_notes),
      image_url: optionalString(input.image_url),
      audio_url: optionalString(input.audio_url),
      solution_image_url: optionalString(input.solution_image_url),
      solution_audio_url: optionalString(input.solution_audio_url),
      source: optionalString(input.source),
      tags: stringArray(input.tags),
      usage_count:
        typeof input.usage_count === "number" ? input.usage_count : 0,
      is_active:
        typeof input.is_active === "boolean" ? input.is_active : true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data, error: null });
}

export async function PATCH(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { data: null, error: { message: "Nicht autorisiert." } },
      { status: 401 }
    );
  }

  let input: UpdatePoolQuestionInput;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Ungueltige Anfrage." } },
      { status: 400 }
    );
  }

  const id = optionalString(input.id);
  const values =
    typeof input.values === "object" && input.values !== null
      ? (input.values as Record<string, unknown>)
      : null;

  if (!id || !values) {
    return NextResponse.json(
      { data: null, error: { message: "Pflichtfelder fehlen." } },
      { status: 400 }
    );
  }

  const updateValues = Object.fromEntries(
    UPDATABLE_FIELDS.filter((field) => field in values).map((field) => [
      field,
      values[field],
    ])
  );

  if (Object.keys(updateValues).length === 0) {
    return NextResponse.json(
      { data: null, error: { message: "Keine gueltigen Felder." } },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("pool_questions")
    .update(updateValues)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data, error: null });
}

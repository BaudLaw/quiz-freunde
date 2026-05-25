import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminRequest";
import type { PoolQuestion } from "@/lib/poolTypes";
import { pointsFromDifficulty } from "@/lib/poolTypes";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type GenerateQuizInput = {
  poolQuestionIds?: unknown;
  quizSetId?: unknown;
  quizSetTitle?: unknown;
  mode?: unknown;
};

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { data: null, error: { message: "Nicht autorisiert." } },
      { status: 401 }
    );
  }

  let input: GenerateQuizInput;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Ungueltige Anfrage." } },
      { status: 400 }
    );
  }

  const poolQuestionIds = Array.isArray(input.poolQuestionIds)
    ? input.poolQuestionIds.filter(
        (id): id is string => typeof id === "string" && !!id
      )
    : [];
  const mode = input.mode === "replace" ? "replace" : "append";
  let quizSetId = typeof input.quizSetId === "string" ? input.quizSetId : "";

  if (!poolQuestionIds.length) {
    return createErrorResponse("Keine Pool-Fragen ausgewaehlt.", 400);
  }

  if (!quizSetId) {
    const title =
      typeof input.quizSetTitle === "string" && input.quizSetTitle.trim()
        ? input.quizSetTitle.trim()
        : "Generiertes Quiz";

    const { data: quizSet, error: quizSetError } = await supabase
      .from("quiz_sets")
      .insert({ title })
      .select("id")
      .single();

    if (quizSetError) {
      return createErrorResponse(
        `Quiz-Set konnte nicht erstellt werden: ${quizSetError.message}`,
        500
      );
    }

    quizSetId = quizSet.id;
  }

  const { data: poolQuestions, error: poolQuestionsError } = await supabase
    .from("pool_questions")
    .select("*")
    .in("id", poolQuestionIds);

  if (poolQuestionsError) {
    return createErrorResponse(
      `Pool-Fragen konnten nicht geladen werden: ${poolQuestionsError.message}`,
      500
    );
  }

  if (!poolQuestions || poolQuestions.length === 0) {
    return createErrorResponse("Keine passenden Pool-Fragen gefunden.", 400);
  }

  const orderedPoolQuestions = poolQuestionIds
    .map((id) => poolQuestions.find((question) => question.id === id))
    .filter(Boolean) as PoolQuestion[];

  const {
    data: existingGeneratedQuestions,
    error: existingGeneratedQuestionsError,
  } = await supabase
    .from("questions")
    .select("source_pool_question_id")
    .eq("quiz_set_id", quizSetId)
    .not("source_pool_question_id", "is", null);

  if (existingGeneratedQuestionsError) {
    return createErrorResponse(
      `Bestehende Generator-Fragen konnten nicht geprueft werden: ${existingGeneratedQuestionsError.message}`,
      500
    );
  }

  const existingPoolQuestionIds = new Set(
    existingGeneratedQuestions?.map(
      (question) => question.source_pool_question_id
    ) ?? []
  );

  const duplicatePoolQuestions = orderedPoolQuestions.filter((poolQuestion) =>
    existingPoolQuestionIds.has(poolQuestion.id)
  );

  if (duplicatePoolQuestions.length > 0 && mode === "append") {
    return createErrorResponse(
      `${duplicatePoolQuestions.length} ausgewaehlte Fragen sind bereits in diesem Quiz-Set vorhanden. Waehle "Bestehende Generator-Fragen ersetzen" oder entferne die Duplikate aus der Vorschau.`,
      400
    );
  }

  if (mode === "replace") {
    const { error: deleteQuestionsError } = await supabase
      .from("questions")
      .delete()
      .eq("quiz_set_id", quizSetId)
      .eq("room_code", "GENERATED");

    if (deleteQuestionsError) {
      return createErrorResponse(
        `Bestehende Fragen konnten nicht geloescht werden: ${deleteQuestionsError.message}`,
        500
      );
    }
  }

  const { data: existingQuestions, error: existingQuestionsError } =
    await supabase
      .from("questions")
      .select("question_number")
      .eq("quiz_set_id", quizSetId);

  if (existingQuestionsError) {
    return createErrorResponse(
      `Vorhandene Fragen konnten nicht geladen werden: ${existingQuestionsError.message}`,
      500
    );
  }

  const maxQuestionNumber =
    existingQuestions?.reduce((max, question) => {
      return Math.max(max, question.question_number || 0);
    }, 0) || 0;

  const questionsToInsert = orderedPoolQuestions.map((poolQuestion, index) => ({
    quiz_set_id: quizSetId,
    room_code: "GENERATED",
    source_pool_question_id: poolQuestion.id,
    question_number: maxQuestionNumber + index + 1,
    category: poolQuestion.category,
    points: pointsFromDifficulty(poolQuestion.difficulty),
    question: poolQuestion.question,
    solution: poolQuestion.solution,
    accepted_answers: poolQuestion.accepted_answers ?? [],
    host_notes: poolQuestion.host_notes,
    image_url: poolQuestion.image_url,
    audio_url: poolQuestion.audio_url,
    solution_image_url: poolQuestion.solution_image_url,
    solution_audio_url: poolQuestion.solution_audio_url,
    is_played: false,
  }));

  const { data: insertedQuestions, error: insertQuestionsError } =
    await supabase.from("questions").insert(questionsToInsert).select("*");

  if (insertQuestionsError) {
    return createErrorResponse(
      `Fragen konnten nicht erstellt werden: ${insertQuestionsError.message}`,
      500
    );
  }

  await incrementUsage(orderedPoolQuestions.map((poolQuestion) => poolQuestion.id));

  return NextResponse.json({
    data: {
      quizSetId,
      questions: insertedQuestions,
    },
    error: null,
  });
}

async function incrementUsage(poolQuestionIds: string[]) {
  const uniqueIds = [...new Set(poolQuestionIds)];
  const now = new Date().toISOString();

  const { data: poolQuestions } = await supabase
    .from("pool_questions")
    .select("id, usage_count")
    .in("id", uniqueIds);

  await Promise.all(
    (poolQuestions || []).map((poolQuestion) =>
      supabase
        .from("pool_questions")
        .update({
          usage_count: (poolQuestion.usage_count || 0) + 1,
          last_used_at: now,
        })
        .eq("id", poolQuestion.id)
    )
  );
}

function createErrorResponse(message: string, status: number) {
  return NextResponse.json({ data: null, error: { message } }, { status });
}

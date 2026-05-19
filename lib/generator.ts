import { supabase } from "./supabase";
import type { PoolQuestion } from "./poolTypes";
import { pointsFromDifficulty } from "./poolTypes";

export type GenerateQuizInput = {
  poolQuestionIds: string[];
  quizSetId?: string;
  quizSetTitle?: string;
  mode?: "append" | "replace";
};

export async function generateQuizFromPoolQuestions(input: GenerateQuizInput) {
  const poolQuestionIds = input.poolQuestionIds;
  const mode = input.mode || "append";
  

  if (!poolQuestionIds.length) {
    throw new Error("Keine Pool-Fragen ausgewählt.");
  }

  let quizSetId = input.quizSetId;

  if (!quizSetId) {
    const title = input.quizSetTitle?.trim() || "Generiertes Quiz";

    const { data: quizSet, error: quizSetError } = await supabase
      .from("quiz_sets")
      .insert({
        title,
      })
      .select("id")
      .single();

    if (quizSetError) {
      throw new Error(
        `Quiz-Set konnte nicht erstellt werden: ${quizSetError.message}`
      );
    }

    quizSetId = quizSet.id;
  }

  const { data: poolQuestions, error: poolQuestionsError } = await supabase
    .from("pool_questions")
    .select("*")
    .in("id", poolQuestionIds);

  if (poolQuestionsError) {
    throw new Error(
      `Pool-Fragen konnten nicht geladen werden: ${poolQuestionsError.message}`
    );
  }

  if (!poolQuestions || poolQuestions.length === 0) {
    throw new Error("Keine passenden Pool-Fragen gefunden.");
  }

  const orderedPoolQuestions = poolQuestionIds
    .map((id) => poolQuestions.find((question) => question.id === id))
    .filter(Boolean) as PoolQuestion[];

  if (!quizSetId) {
  throw new Error("Quiz-Set-ID konnte nicht erstellt werden.");
  }

  const { data: existingGeneratedQuestions, error: existingGeneratedQuestionsError } =
    await supabase
      .from("questions")
      .select("source_pool_question_id")
      .eq("quiz_set_id", quizSetId)
      .not("source_pool_question_id", "is", null);

  if (existingGeneratedQuestionsError) {
    throw new Error(
      `Bestehende Generator-Fragen konnten nicht geprüft werden: ${existingGeneratedQuestionsError.message}`
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
    throw new Error(
      `${duplicatePoolQuestions.length} ausgewählte Fragen sind bereits in diesem Quiz-Set vorhanden. Wähle "Bestehende Generator-Fragen ersetzen" oder entferne die Duplikate aus der Vorschau.`
    );
  }
  
  if (mode === "replace") {
    const { error: deleteQuestionsError } = await supabase
      .from("questions")
      .delete()
      .eq("quiz_set_id", quizSetId)
      .eq("room_code", "GENERATED");

    if (deleteQuestionsError) {
      throw new Error(
        `Bestehende Fragen konnten nicht gelöscht werden: ${deleteQuestionsError.message}`
      );
    }
  }

    const { data: existingQuestions, error: existingQuestionsError } =
    await supabase
      .from("questions")
      .select("question_number")
      .eq("quiz_set_id", quizSetId);

  if (existingQuestionsError) {
    throw new Error(
      `Vorhandene Fragen konnten nicht geladen werden: ${existingQuestionsError.message}`
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

  const { data: insertedQuestions, error: insertQuestionsError } = await supabase
    .from("questions")
    .insert(questionsToInsert)
    .select("*");

  if (insertQuestionsError) {
    throw new Error(
      `Fragen konnten nicht erstellt werden: ${insertQuestionsError.message}`
    );
  }

  const now = new Date().toISOString();

  await Promise.all(
    orderedPoolQuestions.map((poolQuestion) =>
      supabase
        .from("pool_questions")
        .update({
          usage_count: (poolQuestion.usage_count ?? 0) + 1,
          last_used_at: now,
        })
        .eq("id", poolQuestion.id)
    )
  );

  return {
    quizSetId,
    questions: insertedQuestions,
  };
}
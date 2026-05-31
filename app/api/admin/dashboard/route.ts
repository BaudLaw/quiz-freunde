import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminRequest";
import { supabase } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type Question = {
  quiz_set_id: string | null;
  category: string | null;
  points: number | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { data: null, error: { message } },
    { status }
  );
}

function isBoardReady(questions: Question[]) {
  if (questions.length === 0) {
    return false;
  }

  const categories = Array.from(
    new Set(
      questions
        .map((question) => question.category)
        .filter((category): category is string => Boolean(category))
    )
  );

  if (categories.length === 0 || categories.length > 6) {
    return false;
  }

  for (const category of categories) {
    const categoryQuestions = questions.filter(
      (question) => question.category === category
    );

    if (categoryQuestions.length !== 5) {
      return false;
    }

    const points = categoryQuestions.map((question) => question.points);
    const uniquePoints = new Set(points);

    if (uniquePoints.size !== points.length) {
      return false;
    }

    for (const requiredPoints of [100, 200, 300, 400, 500]) {
      if (!uniquePoints.has(requiredPoints)) {
        return false;
      }
    }
  }

  return true;
}

export async function GET() {
  if (!(await isAdminRequest())) {
    return jsonError("Nicht autorisiert.", 401);
  }

  const [
    poolsResult,
    activePoolQuestionsResult,
    inactivePoolQuestionsResult,
    quizSetsResult,
    questionsResult,
  ] = await Promise.all([
    supabase.from("question_pools").select("id"),
    supabase.from("pool_questions").select("id").eq("is_active", true),
    supabase.from("pool_questions").select("id").eq("is_active", false),
    supabase.from("quiz_sets").select("id, title"),
    supabase.from("questions").select("id, quiz_set_id, category, points"),
  ]);

  const error =
    poolsResult.error ||
    activePoolQuestionsResult.error ||
    inactivePoolQuestionsResult.error ||
    quizSetsResult.error ||
    questionsResult.error;

  if (error) {
    return jsonError(error.message, 500);
  }

  const quizSets = quizSetsResult.data || [];
  const questions = (questionsResult.data || []) as Question[];
  let boardReadyQuizSets = 0;
  let incompleteQuizSets = 0;

  for (const quizSet of quizSets) {
    const quizSetQuestions = questions.filter(
      (question) => question.quiz_set_id === quizSet.id
    );

    if (isBoardReady(quizSetQuestions)) {
      boardReadyQuizSets += 1;
    } else {
      incompleteQuizSets += 1;
    }
  }

  return NextResponse.json({
    data: {
      pools: poolsResult.data?.length || 0,
      activePoolQuestions: activePoolQuestionsResult.data?.length || 0,
      inactivePoolQuestions: inactivePoolQuestionsResult.data?.length || 0,
      quizSets: quizSets.length,
      boardReadyQuizSets,
      incompleteQuizSets,
    },
    error: null,
  });
}

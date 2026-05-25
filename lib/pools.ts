import { supabase } from "./supabase";
import type { PoolQuestion, QuestionPool } from "./poolTypes";

type ApiResponse<T> = {
  data: T;
  error: null;
} | {
  data: null;
  error: { message: string };
};

export async function getQuestionPools() {
  return supabase
    .from("question_pools")
    .select("*")
    .order("created_at", { ascending: false });
}

export async function createQuestionPool(input: {
  name: string;
  description?: string;
  type?: string;
}): Promise<ApiResponse<QuestionPool>> {
  const response = await fetch("/api/admin/question-pools", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const result = (await response.json().catch(() => null)) as
    | ApiResponse<QuestionPool>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Pool konnte nicht erstellt werden." },
    };
  }

  return result;
}

export async function getPoolQuestions(poolId: string) {
  return supabase
    .from("pool_questions")
    .select("*")
    .eq("pool_id", poolId)
    .order("created_at", { ascending: false });
}

export async function createPoolQuestion(input: Partial<PoolQuestion>) {
  const response = await fetch("/api/admin/pool-questions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const result = (await response.json().catch(() => null)) as
    | ApiResponse<PoolQuestion>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Frage konnte nicht erstellt werden." },
    };
  }

  return result;
}

export async function updatePoolQuestion(
  id: string,
  input: Partial<PoolQuestion>
) {
  return supabase
    .from("pool_questions")
    .update(input)
    .eq("id", id)
    .select()
    .single();
}

export async function deletePoolQuestion(id: string) {
  return supabase
    .from("pool_questions")
    .delete()
    .eq("id", id);
}

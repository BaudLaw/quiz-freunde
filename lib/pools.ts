import { supabase } from "./supabase";
import type { PoolQuestion } from "./poolTypes";

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
}) {
  return supabase
    .from("question_pools")
    .insert({
      name: input.name,
      description: input.description ?? null,
      type: input.type ?? "general",
    })
    .select()
    .single();
}

export async function getPoolQuestions(poolId: string) {
  return supabase
    .from("pool_questions")
    .select("*")
    .eq("pool_id", poolId)
    .order("created_at", { ascending: false });
}

export async function createPoolQuestion(input: Partial<PoolQuestion>) {
  return supabase
    .from("pool_questions")
    .insert(input)
    .select()
    .single();
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
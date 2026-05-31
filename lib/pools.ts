import type { PoolQuestion, QuestionPool } from "./poolTypes";

type ApiResponse<T> = {
  data: T;
  error: null;
} | {
  data: null;
  error: { message: string };
};

export async function getQuestionPools() {
  const response = await fetch("/api/admin/question-pools");
  const result = (await response.json().catch(() => null)) as
    | ApiResponse<QuestionPool[]>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Pools konnten nicht geladen werden." },
    };
  }

  return result;
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
  const response = await fetch(
    `/api/admin/pool-questions?poolId=${encodeURIComponent(poolId)}`
  );
  const result = (await response.json().catch(() => null)) as
    | ApiResponse<PoolQuestion[]>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Pool-Fragen konnten nicht geladen werden." },
    };
  }

  return result;
}

export async function getPoolQuestionCandidates(input: {
  category: string;
  difficulty: number;
  limit?: number;
}) {
  const params = new URLSearchParams({
    category: input.category,
    difficulty: String(input.difficulty),
    isActive: "true",
    limit: String(input.limit || 20),
  });
  const response = await fetch(`/api/admin/pool-questions?${params}`);
  const result = (await response.json().catch(() => null)) as
    | ApiResponse<PoolQuestion[]>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Ersatzfragen konnten nicht geladen werden." },
    };
  }

  return result;
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
): Promise<ApiResponse<PoolQuestion>> {
  const response = await fetch("/api/admin/pool-questions", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, values: input }),
  });

  const result = (await response.json().catch(() => null)) as
    | ApiResponse<PoolQuestion>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Frage konnte nicht aktualisiert werden." },
    };
  }

  return result;
}

export async function deletePoolQuestion(id: string) {
  const response = await fetch(
    `/api/admin/pool-questions?id=${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  );

  const result = (await response.json().catch(() => null)) as
    | ApiResponse<null>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Frage konnte nicht geloescht werden." },
    };
  }

  return result;
}

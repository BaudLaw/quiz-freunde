type PoolQuestionUsageResponse = {
  data: { updatedCount: number } | null;
  error: { message: string } | null;
};

export async function incrementPoolQuestionUsage(poolQuestionIds: string[]) {
  const response = await fetch("/api/admin/pool-questions/usage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids: poolQuestionIds }),
  });

  const result = (await response.json().catch(() => null)) as
    | PoolQuestionUsageResponse
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Pool-Fragen-Nutzung konnte nicht aktualisiert werden." },
    };
  }

  return result;
}

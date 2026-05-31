type QuizSetResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

export async function updateQuizSetTitle(id: string, title: string) {
  const response = await fetch("/api/admin/quiz-sets", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, title }),
  });

  const result = (await response.json().catch(() => null)) as
    | QuizSetResponse<{ id: string; title: string }>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Quiz-Set konnte nicht aktualisiert werden." },
    };
  }

  return result;
}

export async function duplicateQuizSet(sourceQuizSetId: string, title: string) {
  const response = await fetch("/api/admin/quiz-sets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sourceQuizSetId, title }),
  });

  const result = (await response.json().catch(() => null)) as
    | QuizSetResponse<{ id: string; title: string }>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Quiz-Set konnte nicht dupliziert werden." },
    };
  }

  return result;
}

export async function deleteQuizSetQuestion(id: string) {
  const response = await fetch(
    `/api/admin/quiz-set-questions?id=${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  );

  const result = (await response.json().catch(() => null)) as
    | QuizSetResponse<null>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Frage konnte nicht geloescht werden." },
    };
  }

  return result;
}

export async function updateQuizSetQuestion(
  id: string,
  values: Record<string, unknown>
) {
  const response = await fetch("/api/admin/quiz-set-questions", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, values }),
  });

  const result = (await response.json().catch(() => null)) as
    | QuizSetResponse<{ id: string }>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Frage konnte nicht aktualisiert werden." },
    };
  }

  return result;
}

export async function insertQuizSetQuestions(questions: unknown[]) {
  const response = await fetch("/api/admin/quiz-set-questions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ questions }),
  });

  const result = (await response.json().catch(() => null)) as
    | QuizSetResponse<{ insertedCount: number }>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Fragen konnten nicht eingefuegt werden." },
    };
  }

  return result;
}

export async function deleteQuizSet(id: string) {
  const response = await fetch(
    `/api/admin/quiz-sets?id=${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  );

  const result = (await response.json().catch(() => null)) as
    | QuizSetResponse<{ id: string; title: string }>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Quiz-Set konnte nicht geloescht werden." },
    };
  }

  return result;
}

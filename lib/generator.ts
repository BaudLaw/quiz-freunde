export type GenerateQuizInput = {
  poolQuestionIds: string[];
  quizSetId?: string;
  quizSetTitle?: string;
  mode?: "append" | "replace";
};

type GenerateQuizResponse = {
  data: {
    quizSetId: string;
    questions: unknown[] | null;
  } | null;
  error: { message: string } | null;
};

export async function generateQuizFromPoolQuestions(input: GenerateQuizInput) {
  const response = await fetch("/api/admin/generator", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const result = (await response.json().catch(() => null)) as
    | GenerateQuizResponse
    | null;

  if (!result) {
    throw new Error("Quiz konnte nicht erstellt werden.");
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    throw new Error("Quiz konnte nicht erstellt werden.");
  }

  return result.data;
}

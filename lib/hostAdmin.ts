type HostAdminResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

export async function resetHostedRoom(roomCode: string) {
  const response = await fetch("/api/admin/host/reset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ roomCode }),
  });

  const result = (await response.json().catch(() => null)) as
    | HostAdminResponse<{ roomCode: string }>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Spiel konnte nicht zurueckgesetzt werden." },
    };
  }

  return result;
}

export async function startHostedQuiz(quizSetId: string) {
  const response = await fetch("/api/admin/host/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ quizSetId }),
  });

  const result = (await response.json().catch(() => null)) as
    | HostAdminResponse<{
        room: unknown;
        roomCode: string;
        copiedQuestionCount: number;
      }>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Quiz konnte nicht gestartet werden." },
    };
  }

  return result;
}

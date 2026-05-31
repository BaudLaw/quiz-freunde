type HostAdminResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

type HostRoomActionInput = {
  action: string;
  roomCode: string;
  gameState?: string;
  playerName?: string;
};

async function runHostRoomAction(input: HostRoomActionInput) {
  const response = await fetch("/api/admin/host/room", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const result = (await response.json().catch(() => null)) as
    | HostAdminResponse<{ room: unknown }>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Host-Aktion konnte nicht ausgefuehrt werden." },
    };
  }

  return result;
}

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

export async function setHostedGameState(roomCode: string, gameState: string) {
  return runHostRoomAction({
    action: "set-game-state",
    roomCode,
    gameState,
  });
}

export async function setHostedTurnPlayer(roomCode: string, playerName: string) {
  return runHostRoomAction({
    action: "set-turn-player",
    roomCode,
    playerName,
  });
}

export async function openHostedBoard(roomCode: string) {
  return runHostRoomAction({
    action: "open-board",
    roomCode,
  });
}

export async function assignHostedBuzzAnswer(
  roomCode: string,
  playerName: string
) {
  return runHostRoomAction({
    action: "assign-buzz-answer",
    roomCode,
    playerName,
  });
}

export async function clearHostedFeedback(roomCode: string) {
  return runHostRoomAction({
    action: "clear-feedback",
    roomCode,
  });
}

export async function finishHostedRoom(roomCode: string) {
  return runHostRoomAction({
    action: "finish-room",
    roomCode,
  });
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

async function runHostAnswerAction(action: string, roomCode: string) {
  const response = await fetch("/api/admin/host/answer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, roomCode }),
  });

  const result = (await response.json().catch(() => null)) as
    | HostAdminResponse<{
        room: unknown;
        shouldClearFeedback: boolean;
        shouldFinishAfterDelay: boolean;
      }>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Antwort-Aktion konnte nicht ausgefuehrt werden." },
    };
  }

  return result;
}

export async function markHostedCorrect(roomCode: string) {
  return runHostAnswerAction("mark-correct", roomCode);
}

export async function markHostedWrong(roomCode: string) {
  return runHostAnswerAction("mark-wrong", roomCode);
}

export async function showHostedSolution(roomCode: string) {
  return runHostAnswerAction("show-solution", roomCode);
}

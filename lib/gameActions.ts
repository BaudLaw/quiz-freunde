type GameActionResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

async function postGameAction<T>(url: string, body: unknown, fallback: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = (await response.json().catch(() => null)) as
    | GameActionResponse<T>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: fallback },
    };
  }

  return result;
}

export async function joinGameRoom(roomCode: string, playerName: string) {
  return postGameAction<{ room: unknown }>(
    "/api/game/join",
    { roomCode, playerName },
    "Raum konnte nicht betreten werden."
  );
}

export async function sendGameBuzz(roomCode: string, playerName: string) {
  return postGameAction<{ accepted: boolean }>(
    "/api/game/buzz",
    { roomCode, playerName },
    "Buzzer konnte nicht gesendet werden."
  );
}

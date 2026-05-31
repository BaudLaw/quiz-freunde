type GameRoomResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

export async function getGameRoomData(input: {
  roomCode: string;
  playerName?: string;
  allQuestions?: boolean;
}) {
  const params = new URLSearchParams({
    roomCode: input.roomCode,
  });

  if (input.playerName) {
    params.set("playerName", input.playerName);
  }

  if (input.allQuestions) {
    params.set("allQuestions", "true");
  }

  const response = await fetch(`/api/game/room?${params}`);
  const result = (await response.json().catch(() => null)) as
    | GameRoomResponse<{
        room: unknown;
        players: unknown[];
        leaderboard: unknown[];
        question: unknown;
        allQuestions: unknown[];
        buzzes: unknown[];
        isBlocked: boolean;
      }>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Raumdaten konnten nicht geladen werden." },
    };
  }

  return result;
}

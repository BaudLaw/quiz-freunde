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

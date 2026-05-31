import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminRequest";
import { supabase } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type ResetRoomInput = {
  roomCode?: unknown;
};

async function deleteByRoomCode(table: string, column: string, roomCode: string) {
  const { error } = await supabase.from(table).delete().eq(column, roomCode);

  return error;
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { data: null, error: { message: "Nicht autorisiert." } },
      { status: 401 }
    );
  }

  let input: ResetRoomInput;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Ungueltige Anfrage." } },
      { status: 400 }
    );
  }

  const roomCode = typeof input.roomCode === "string" ? input.roomCode.trim() : "";

  if (!roomCode) {
    return NextResponse.json(
      { data: null, error: { message: "Pflichtfelder fehlen." } },
      { status: 400 }
    );
  }

  const deleteSteps: Array<[string, string]> = [
    ["buzzes", "room_code"],
    ["players", "room_code"],
    ["questions", "room_code"],
    ["rooms", "code"],
  ];

  for (const [table, column] of deleteSteps) {
    const error = await deleteByRoomCode(table, column, roomCode);

    if (error) {
      return NextResponse.json(
        { data: null, error: { message: error.message } },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ data: { roomCode }, error: null });
}

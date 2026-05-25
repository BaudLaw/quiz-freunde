import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminRequest";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type UpdateQuizSetInput = {
  id?: unknown;
  title?: unknown;
};

export async function PATCH(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { data: null, error: { message: "Nicht autorisiert." } },
      { status: 401 }
    );
  }

  let input: UpdateQuizSetInput;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Ungueltige Anfrage." } },
      { status: 400 }
    );
  }

  const id = typeof input.id === "string" ? input.id : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";

  if (!id || !title) {
    return NextResponse.json(
      { data: null, error: { message: "Pflichtfelder fehlen." } },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("quiz_sets")
    .update({ title })
    .eq("id", id)
    .select("id, title")
    .single();

  if (error) {
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data, error: null });
}

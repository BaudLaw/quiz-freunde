import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminRequest";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type CreateQuestionPoolInput = {
  name?: unknown;
  description?: unknown;
  type?: unknown;
};

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { data: null, error: { message: "Nicht autorisiert." } },
      { status: 401 }
    );
  }

  let input: CreateQuestionPoolInput;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Ungueltige Anfrage." } },
      { status: 400 }
    );
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  const type = typeof input.type === "string" ? input.type : "general";

  if (!name) {
    return NextResponse.json(
      { data: null, error: { message: "Pool-Name fehlt." } },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("question_pools")
    .insert({
      name,
      description: description || null,
      type: type || "general",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data, error: null });
}

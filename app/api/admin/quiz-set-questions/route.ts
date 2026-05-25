import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminRequest";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { data: null, error: { message: "Nicht autorisiert." } },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";

  if (!id) {
    return NextResponse.json(
      { data: null, error: { message: "Pflichtfelder fehlen." } },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", id)
    .eq("room_code", "GENERATED");

  if (error) {
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: null, error: null });
}

import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminRequest";
import { supabase } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type UsageInput = {
  ids?: unknown;
};

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { data: null, error: { message: "Nicht autorisiert." } },
      { status: 401 }
    );
  }

  let input: UsageInput;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Ungueltige Anfrage." } },
      { status: 400 }
    );
  }

  const ids = Array.isArray(input.ids)
    ? input.ids.filter((id): id is string => typeof id === "string" && !!id)
    : [];

  if (ids.length === 0) {
    return NextResponse.json(
      { data: null, error: { message: "Keine Pool-Fragen angegeben." } },
      { status: 400 }
    );
  }

  const uniqueIds = [...new Set(ids)];
  const now = new Date().toISOString();

  const { data: poolQuestions, error: loadError } = await supabase
    .from("pool_questions")
    .select("id, usage_count")
    .in("id", uniqueIds);

  if (loadError) {
    return NextResponse.json(
      { data: null, error: { message: loadError.message } },
      { status: 500 }
    );
  }

  const updateResults = await Promise.all(
    (poolQuestions || []).map((poolQuestion) =>
      supabase
        .from("pool_questions")
        .update({
          usage_count: (poolQuestion.usage_count || 0) + 1,
          last_used_at: now,
        })
        .eq("id", poolQuestion.id)
    )
  );

  const updateError = updateResults.find((result) => result.error)?.error;

  if (updateError) {
    return NextResponse.json(
      { data: null, error: { message: updateError.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: { updatedCount: poolQuestions?.length || 0 },
    error: null,
  });
}

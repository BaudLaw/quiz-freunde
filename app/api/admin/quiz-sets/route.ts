import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminRequest";
import { supabase } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type UpdateQuizSetInput = {
  id?: unknown;
  title?: unknown;
};

type DuplicateQuizSetInput = {
  sourceQuizSetId?: unknown;
  title?: unknown;
};

type ValidationQuestion = {
  category: string | null;
  points: number | null;
};

function validateQuizSetForBoard(questions: ValidationQuestion[]) {
  const warnings: string[] = [];
  const requiredPoints = [100, 200, 300, 400, 500];

  if (questions.length === 0) {
    return {
      isBoardValid: false,
      warnings: ["Dieses Quiz-Set enthaelt keine Fragen."],
    };
  }

  const categories = Array.from(
    new Set(questions.map((question) => question.category).filter(Boolean))
  );

  if (categories.length > 6) {
    warnings.push(
      `Zu viele Kategorien: ${categories.length} vorhanden, maximal 6 erlaubt.`
    );
  }

  for (const category of categories) {
    const categoryQuestions = questions.filter(
      (question) => question.category === category
    );

    if (categoryQuestions.length !== 5) {
      warnings.push(
        `Kategorie "${category}" enthaelt ${categoryQuestions.length} Fragen statt 5.`
      );
    }

    const pointsInCategory = categoryQuestions.map((question) =>
      Number(question.points)
    );

    for (const requiredPoint of requiredPoints) {
      if (!pointsInCategory.includes(requiredPoint)) {
        warnings.push(`Kategorie "${category}" fehlt ${requiredPoint} Punkte.`);
      }
    }

    const duplicatePoints = pointsInCategory.filter(
      (point, index) => pointsInCategory.indexOf(point) !== index
    );

    for (const duplicatePoint of Array.from(new Set(duplicatePoints))) {
      warnings.push(
        `Kategorie "${category}" enthaelt ${duplicatePoint} Punkte mehrfach.`
      );
    }
  }

  return {
    isBoardValid: warnings.length === 0,
    warnings,
  };
}

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { data: null, error: { message: "Nicht autorisiert." } },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") || "list";

  const { data: quizSetsData, error: quizSetsError } = await supabase
    .from("quiz_sets")
    .select("id, title, created_at")
    .order("created_at", { ascending: false });

  if (quizSetsError) {
    return NextResponse.json(
      { data: null, error: { message: quizSetsError.message } },
      { status: 500 }
    );
  }

  if (mode === "options") {
    return NextResponse.json({
      data: (quizSetsData || []).map((quizSet) => ({
        id: quizSet.id,
        title: quizSet.title,
      })),
      error: null,
    });
  }

  const { data: questionsData, error: questionsError } = await supabase
    .from("questions")
    .select("quiz_set_id, category, points")
    .not("quiz_set_id", "is", null);

  if (questionsError) {
    return NextResponse.json(
      { data: null, error: { message: questionsError.message } },
      { status: 500 }
    );
  }

  const questions = questionsData || [];
  const quizSetsWithValidation = (quizSetsData || []).map((quizSet) => {
    const validationQuestions = questions.filter(
      (question) => question.quiz_set_id === quizSet.id
    );

    return {
      id: quizSet.id,
      title: quizSet.title,
      created_at: quizSet.created_at,
      question_count: validationQuestions.length,
      validation: validateQuizSetForBoard(validationQuestions),
    };
  });

  return NextResponse.json({ data: quizSetsWithValidation, error: null });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { data: null, error: { message: "Nicht autorisiert." } },
      { status: 401 }
    );
  }

  let input: DuplicateQuizSetInput;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Ungueltige Anfrage." } },
      { status: 400 }
    );
  }

  const sourceQuizSetId =
    typeof input.sourceQuizSetId === "string" ? input.sourceQuizSetId : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";

  if (!sourceQuizSetId || !title) {
    return NextResponse.json(
      { data: null, error: { message: "Pflichtfelder fehlen." } },
      { status: 400 }
    );
  }

  const { data: sourceQuestions, error: sourceQuestionsError } = await supabase
    .from("questions")
    .select("*")
    .eq("quiz_set_id", sourceQuizSetId)
    .order("question_number", { ascending: true });

  if (sourceQuestionsError) {
    return NextResponse.json(
      { data: null, error: { message: sourceQuestionsError.message } },
      { status: 500 }
    );
  }

  if (!sourceQuestions || sourceQuestions.length === 0) {
    return NextResponse.json(
      { data: null, error: { message: "Dieses Quiz-Set enthaelt keine Fragen." } },
      { status: 400 }
    );
  }

  const { data: newQuizSet, error: newQuizSetError } = await supabase
    .from("quiz_sets")
    .insert({ title })
    .select("id")
    .single();

  if (newQuizSetError) {
    return NextResponse.json(
      { data: null, error: { message: newQuizSetError.message } },
      { status: 500 }
    );
  }

  const questionsToInsert = sourceQuestions.map((question, index) => ({
    quiz_set_id: newQuizSet.id,
    room_code: "GENERATED",
    source_pool_question_id: question.source_pool_question_id,
    question_number: index + 1,
    category: question.category,
    points: question.points,
    question: question.question,
    solution: question.solution,
    accepted_answers: question.accepted_answers || [],
    host_notes: question.host_notes || "",
    image_url: question.image_url || "",
    audio_url: question.audio_url || "",
    solution_image_url: question.solution_image_url || "",
    solution_audio_url: question.solution_audio_url || "",
    is_played: false,
  }));

  const { error: insertQuestionsError } = await supabase
    .from("questions")
    .insert(questionsToInsert);

  if (insertQuestionsError) {
    return NextResponse.json(
      { data: null, error: { message: insertQuestionsError.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: { id: newQuizSet.id, title },
    error: null,
  });
}

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

  const { error: questionsError } = await supabase
    .from("questions")
    .delete()
    .eq("quiz_set_id", id);

  if (questionsError) {
    return NextResponse.json(
      { data: null, error: { message: questionsError.message } },
      { status: 500 }
    );
  }

  const { data: deletedQuizSet, error: quizSetError } = await supabase
    .from("quiz_sets")
    .delete()
    .eq("id", id)
    .select("id, title")
    .maybeSingle();

  if (quizSetError) {
    return NextResponse.json(
      { data: null, error: { message: quizSetError.message } },
      { status: 500 }
    );
  }

  if (!deletedQuizSet) {
    return NextResponse.json(
      {
        data: null,
        error: {
          message:
            "Quiz-Set wurde nicht geloescht. Die ID wurde nicht gefunden oder Delete ist blockiert.",
        },
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: deletedQuizSet, error: null });
}

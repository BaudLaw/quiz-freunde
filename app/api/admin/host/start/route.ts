import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminRequest";
import { supabase } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type StartRoomInput = {
  quizSetId?: unknown;
};

type QuizSetValidationQuestion = {
  category: string;
  points: number;
};

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

function validateQuizSetForBoard(questions: QuizSetValidationQuestion[]) {
  const warnings: string[] = [];
  const requiredPoints = [100, 200, 300, 400, 500];

  if (questions.length === 0) {
    return {
      isBoardValid: false,
      warnings: ["Dieses Quiz-Set enthaelt keine Fragen."],
    };
  }

  const categories = Array.from(
    new Set(questions.map((question) => question.category))
  );

  if (categories.length > 6) {
    warnings.push("Ein Quiz-Set darf maximal 6 Kategorien enthalten.");
  }

  for (const category of categories) {
    const categoryQuestions = questions.filter(
      (question) => question.category === category
    );
    const points = categoryQuestions.map((question) => question.points);
    const missingPoints = requiredPoints.filter(
      (requiredPoint) => !points.includes(requiredPoint)
    );
    const duplicatePoints = points.filter(
      (point, index) => points.indexOf(point) !== index
    );

    if (categoryQuestions.length !== 5) {
      warnings.push(
        `Kategorie "${category}" braucht exakt 5 Fragen, aktuell ${categoryQuestions.length}.`
      );
    }

    if (missingPoints.length > 0) {
      warnings.push(
        `Kategorie "${category}" fehlt: ${missingPoints.join(", ")} Punkte.`
      );
    }

    if (duplicatePoints.length > 0) {
      warnings.push(
        `Kategorie "${category}" hat doppelte Punktwerte: ${Array.from(
          new Set(duplicatePoints)
        ).join(", ")}.`
      );
    }
  }

  return {
    isBoardValid: warnings.length === 0,
    warnings,
  };
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { data: null, error: { message: "Nicht autorisiert." } },
      { status: 401 }
    );
  }

  let input: StartRoomInput;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Ungueltige Anfrage." } },
      { status: 400 }
    );
  }

  const quizSetId =
    typeof input.quizSetId === "string" ? input.quizSetId.trim() : "";

  if (!quizSetId) {
    return NextResponse.json(
      { data: null, error: { message: "Pflichtfelder fehlen." } },
      { status: 400 }
    );
  }

  const { data: quizSet } = await supabase
    .from("quiz_sets")
    .select("id, title")
    .eq("id", quizSetId)
    .maybeSingle();

  const { data: questionsData, error: loadQuestionsError } = await supabase
    .from("questions")
    .select("*")
    .eq("quiz_set_id", quizSetId)
    .order("question_number", {
      ascending: true,
    });

  if (loadQuestionsError) {
    return NextResponse.json(
      { data: null, error: { message: loadQuestionsError.message } },
      { status: 500 }
    );
  }

  if (!questionsData || questionsData.length === 0) {
    return NextResponse.json(
      {
        data: null,
        error: {
          message:
            "Dieses Quiz-Set enthaelt keine Fragen. Das Quiz kann nicht gehostet werden.",
        },
      },
      { status: 400 }
    );
  }

  const quizSetValidation = validateQuizSetForBoard(
    questionsData.map((question) => ({
      category: question.category,
      points: Number(question.points),
    }))
  );

  if (!quizSetValidation.isBoardValid) {
    return NextResponse.json(
      {
        data: null,
        error: {
          message:
            "Dieses Quiz-Set ist nicht board-konform und kann nicht gehostet werden.\n\n" +
            quizSetValidation.warnings.join("\n"),
        },
      },
      { status: 400 }
    );
  }

  const newRoomCode = generateCode();

  const { error: roomError } = await supabase.from("rooms").insert([
    {
      code: newRoomCode,
      title: quizSet?.title || "Baud_iful Quizz",
      current_question: 1,
      game_state: "lobby",
      turn_player: "",
      active_player: "",
      buzz_locked: false,
      feedback: "",
    },
  ]);

  if (roomError) {
    return NextResponse.json(
      { data: null, error: { message: roomError.message } },
      { status: 500 }
    );
  }

  const copiedQuestions = questionsData.map((question, index) => ({
    quiz_set_id: null,
    room_code: newRoomCode,
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
    solution_audio_url: question.solution_audio_url || "",
    solution_image_url: question.solution_image_url || "",
    is_played: false,
  }));

  const { error: questionError } = await supabase
    .from("questions")
    .insert(copiedQuestions);

  if (questionError) {
    return NextResponse.json(
      { data: null, error: { message: questionError.message } },
      { status: 500 }
    );
  }

  const { data: newRoomData, error: newRoomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", newRoomCode)
    .single();

  if (newRoomError) {
    return NextResponse.json(
      { data: null, error: { message: newRoomError.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: {
      room: newRoomData,
      roomCode: newRoomCode,
      copiedQuestionCount: copiedQuestions.length,
    },
    error: null,
  });
}

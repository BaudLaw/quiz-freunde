"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PoolQuestion } from "@/lib/poolTypes";

type QuizSetValidationCategorySummary = {
  category: string;
  existingPoints: number[];
  missingPoints: number[];
};

type QuizSetValidation = {
  isBoardValid: boolean;
  statusText: string;
  warnings: string[];
  categorySummaries: QuizSetValidationCategorySummary[];
};

type QuizSetWithCount = {
  id: string;
  title: string;
  created_at?: string;
  question_count: number;
  validation: QuizSetValidation;
};

type QuizSetQuestion = {
  id: string;
  question_number: number;
  category: string;
  points: number;
  question: string;
  solution: string | null;
  source_pool_question_id: string | null;
};

type QuizSetValidationQuestion = {
  category: string;
  points: number;
};

type ReplacementCandidate = PoolQuestion;

type ReplacementSelection = {
  quizSetQuestion: QuizSetQuestion;
  candidates: ReplacementCandidate[];
};

function validateQuizSetForBoard(
  questions: QuizSetValidationQuestion[]
): QuizSetValidation {
  const warnings: string[] = [];
  const requiredPoints = [100, 200, 300, 400, 500];
  const categorySummaries: QuizSetValidationCategorySummary[] = [];

  if (questions.length === 0) {
    return {
      isBoardValid: false,
      statusText: "Keine Fragen",
      warnings: ["Dieses Quiz-Set enthält keine Fragen."],
      categorySummaries: [],
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
        `Kategorie "${category}" enthält ${categoryQuestions.length} Fragen statt 5.`
      );
    }

    const pointsInCategory = categoryQuestions
      .map((question) => Number(question.points))
      .sort((a, b) => a - b);

    const missingPoints = requiredPoints.filter(
      (requiredPoint) => !pointsInCategory.includes(requiredPoint)
    );

    categorySummaries.push({
      category,
      existingPoints: pointsInCategory,
      missingPoints,
    });

    for (const requiredPoint of requiredPoints) {
      if (!pointsInCategory.includes(requiredPoint)) {
        warnings.push(
          `Kategorie "${category}" fehlt ${requiredPoint} Punkte.`
        );
      }
    }

    const duplicatePoints = pointsInCategory.filter(
      (point, index) => pointsInCategory.indexOf(point) !== index
    );

    const uniqueDuplicatePoints = Array.from(new Set(duplicatePoints));

    for (const duplicatePoint of uniqueDuplicatePoints) {
      warnings.push(
        `Kategorie "${category}" enthält ${duplicatePoint} Punkte mehrfach.`
      );
    }
  }

  const isBoardValid = warnings.length === 0;

  return {
    isBoardValid,
    statusText: isBoardValid ? "Board-konform" : "Nicht vollständig",
    warnings,
    categorySummaries,
  };
}

export default function QuizSetsPage() {
  const [quizSetsWithCount, setQuizSetsWithCount] = useState<QuizSetWithCount[]>(
    []
  );
  const [expandedQuizSetId, setExpandedQuizSetId] = useState<string | null>(
    null
  );
  const [quizSetQuestions, setQuizSetQuestions] = useState<QuizSetQuestion[]>(
    []
  );
  const [replacementSelection, setReplacementSelection] =
    useState<ReplacementSelection | null>(null);
  const [expandedValidationQuizSetId, setExpandedValidationQuizSetId] =
    useState<string | null>(null);

  async function loadQuizSetsWithCount() {
    const { data: quizSetsData, error: quizSetsError } = await supabase
      .from("quiz_sets")
      .select("id, title, created_at")
      .order("created_at", { ascending: false });

    if (quizSetsError) {
      alert("Quiz-Sets konnten nicht geladen werden: " + quizSetsError.message);
      return;
    }

    const quizSetsWithQuestionCount = await Promise.all(
      (quizSetsData || []).map(async (quizSet) => {
        const { data: questionsData, error: questionsError } = await supabase
          .from("questions")
          .select("category, points")
          .eq("quiz_set_id", quizSet.id);

        if (questionsError) {
          console.error(
            "Quiz-Set-Fragen konnten für die Validierung nicht geladen werden:",
            questionsError
          );
        }

        const validationQuestions = questionsData || [];

        return {
          id: quizSet.id,
          title: quizSet.title,
          created_at: quizSet.created_at,
          question_count: validationQuestions.length,
          validation: validateQuizSetForBoard(validationQuestions),
        };
      })
    );

    setQuizSetsWithCount(quizSetsWithQuestionCount);
  }

  useEffect(() => {
    loadQuizSetsWithCount();
  }, []);

function handleToggleQuizSetValidation(quizSetId: string) {
  setExpandedValidationQuizSetId((currentQuizSetId) =>
    currentQuizSetId === quizSetId ? null : quizSetId
  );
}

async function handleRenameQuizSet(quizSetId: string, currentTitle: string) {
  const newTitle = window.prompt(
    "Neuer Name für dieses Quiz-Set:",
    currentTitle
  );

  if (!newTitle) {
    return;
  }

  const cleanedTitle = newTitle.trim();

  if (!cleanedTitle) {
    alert("Der Name darf nicht leer sein.");
    return;
  }

  const { error } = await supabase
    .from("quiz_sets")
    .update({
      title: cleanedTitle,
    })
    .eq("id", quizSetId);

  if (error) {
    alert("Quiz-Set konnte nicht umbenannt werden: " + error.message);
    return;
  }

  await loadQuizSetsWithCount();

  alert("Quiz-Set wurde umbenannt.");
}

async function handleDuplicateQuizSet(quizSetId: string, title: string) {
  const newTitle = window.prompt(
    "Name für die Kopie:",
    `${title} Kopie`
  );

  if (!newTitle) {
    return;
  }

  const cleanedTitle = newTitle.trim();

  if (!cleanedTitle) {
    alert("Der Name darf nicht leer sein.");
    return;
  }

  const { data: sourceQuestions, error: sourceQuestionsError } =
    await supabase
      .from("questions")
      .select("*")
      .eq("quiz_set_id", quizSetId)
      .order("question_number", { ascending: true });

  if (sourceQuestionsError) {
    alert(
      "Fragen konnten nicht geladen werden: " +
        sourceQuestionsError.message
    );
    return;
  }

  if (!sourceQuestions || sourceQuestions.length === 0) {
    alert("Dieses Quiz-Set enthält keine Fragen.");
    return;
  }

  const { data: newQuizSet, error: newQuizSetError } = await supabase
    .from("quiz_sets")
    .insert({
      title: cleanedTitle,
    })
    .select("id")
    .single();

  if (newQuizSetError) {
    alert(
      "Quiz-Set-Kopie konnte nicht erstellt werden: " +
        newQuizSetError.message
    );
    return;
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
    alert(
      "Fragen konnten nicht in die Kopie eingefügt werden: " +
        insertQuestionsError.message
    );
    return;
  }

  await loadQuizSetsWithCount();

  alert("Quiz-Set wurde dupliziert.");
}

async function handleShowReplacementCandidates(question: QuizSetQuestion) {
  if (!expandedQuizSetId) {
    alert("Kein Quiz-Set ausgewählt.");
    return;
  }

  const requiredDifficulty = question.points / 100;

  const { data: existingQuestions, error: existingQuestionsError } =
    await supabase
      .from("questions")
      .select("source_pool_question_id")
      .eq("quiz_set_id", expandedQuizSetId);

  if (existingQuestionsError) {
    alert(
      "Bestehende Quiz-Set-Fragen konnten nicht geladen werden: " +
        existingQuestionsError.message
    );
    return;
  }

  const usedSourcePoolQuestionIds = new Set(
    (existingQuestions || [])
      .map((existingQuestion) => existingQuestion.source_pool_question_id)
      .filter(Boolean)
  );

  const { data: poolCandidates, error: poolCandidatesError } = await supabase
    .from("pool_questions")
    .select("*")
    .eq("category", question.category)
    .eq("difficulty", requiredDifficulty)
    .eq("is_active", true)
    .order("usage_count", { ascending: true })
    .order("last_used_at", {
      ascending: true,
      nullsFirst: true,
    })
    .limit(20);

  if (poolCandidatesError) {
    alert(
      "Pool-Fragen konnten nicht geladen werden: " +
        poolCandidatesError.message
    );
    return;
  }

  const availableCandidates = (poolCandidates || []).filter(
    (poolQuestion) => !usedSourcePoolQuestionIds.has(poolQuestion.id)
  );

  if (availableCandidates.length === 0) {
    alert(
      `Keine ungenutzte Ersatzfrage gefunden für Kategorie "${question.category}" und ${question.points} Punkte.`
    );
    return;
  }

  setReplacementSelection({
    quizSetQuestion: question,
    candidates: availableCandidates as ReplacementCandidate[],
  });
}

async function handleReplaceQuizSetQuestionWithCandidate(
  question: QuizSetQuestion,
  replacementQuestion: ReplacementCandidate
) {
  const { error: updateQuestionError } = await supabase
    .from("questions")
    .update({
      source_pool_question_id: replacementQuestion.id,
      category: replacementQuestion.category,
      points: replacementQuestion.difficulty * 100,
      question: replacementQuestion.question,
      solution: replacementQuestion.solution,
      accepted_answers: replacementQuestion.accepted_answers || [],
      host_notes: replacementQuestion.host_notes || "",
      image_url: replacementQuestion.image_url || "",
      audio_url: replacementQuestion.audio_url || "",
      solution_image_url: replacementQuestion.solution_image_url || "",
      solution_audio_url: replacementQuestion.solution_audio_url || "",
      is_played: false,
    })
    .eq("id", question.id);

  if (updateQuestionError) {
    alert("Frage konnte nicht ersetzt werden: " + updateQuestionError.message);
    return;
  }

  const { data: currentPoolQuestion, error: loadPoolQuestionError } =
    await supabase
      .from("pool_questions")
      .select("usage_count")
      .eq("id", replacementQuestion.id)
      .single();

  if (!loadPoolQuestionError) {
    await supabase
      .from("pool_questions")
      .update({
        usage_count: (currentPoolQuestion?.usage_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", replacementQuestion.id);
  }

  if (expandedQuizSetId) {
    const { data, error: reloadError } = await supabase
      .from("questions")
      .select(
        "id, question_number, category, points, question, solution, source_pool_question_id"
      )
      .eq("quiz_set_id", expandedQuizSetId)
      .order("question_number", { ascending: true });

    if (reloadError) {
      alert(
        "Quiz-Set-Fragen konnten nicht neu geladen werden: " +
          reloadError.message
      );
      return;
    }

    setQuizSetQuestions((data || []) as QuizSetQuestion[]);
  }

  setReplacementSelection(null);

  await loadQuizSetsWithCount();

  alert("Frage wurde ersetzt.");
}

async function handleFillMissingQuizSetQuestions(quizSetId: string) {
  const { data: existingQuestions, error: existingQuestionsError } =
    await supabase
      .from("questions")
      .select(
        "id, question_number, category, points, source_pool_question_id"
      )
      .eq("quiz_set_id", quizSetId)
      .order("question_number", { ascending: true });

  if (existingQuestionsError) {
    alert(
      "Quiz-Set-Fragen konnten nicht geladen werden: " +
        existingQuestionsError.message
    );
    return;
  }

  if (!existingQuestions || existingQuestions.length === 0) {
    alert("Dieses Quiz-Set enthält keine Kategorien, die ergänzt werden können.");
    return;
  }

  const requiredPoints = [100, 200, 300, 400, 500];

  const categories = Array.from(
    new Set(
      existingQuestions
        .map((question) => question.category)
        .filter(Boolean)
    )
  );

  const usedSourcePoolQuestionIds = new Set(
    existingQuestions
      .map((question) => question.source_pool_question_id)
      .filter(Boolean)
  );

  const questionsToInsert = [];
  const warnings: string[] = [];

  for (const category of categories) {
    const categoryQuestions = existingQuestions.filter(
      (question) => question.category === category
    );

    const existingPoints = new Set(
      categoryQuestions.map((question) => Number(question.points))
    );

    for (const requiredPoint of requiredPoints) {
      if (existingPoints.has(requiredPoint)) {
        continue;
      }

      const requiredDifficulty = requiredPoint / 100;

      const { data: poolCandidates, error: poolCandidatesError } =
        await supabase
          .from("pool_questions")
          .select("*")
          .eq("category", category)
          .eq("difficulty", requiredDifficulty)
          .eq("is_active", true)
          .order("usage_count", { ascending: true })
          .order("last_used_at", {
            ascending: true,
            nullsFirst: true,
          })
          .limit(10);

      if (poolCandidatesError) {
        warnings.push(
          `Kategorie "${category}", ${requiredPoint} Punkte: Pool-Fragen konnten nicht geladen werden.`
        );
        continue;
      }

      const selectedPoolQuestion = (poolCandidates || []).find(
        (poolQuestion) => !usedSourcePoolQuestionIds.has(poolQuestion.id)
      );

      if (!selectedPoolQuestion) {
        warnings.push(
          `Kategorie "${category}", ${requiredPoint} Punkte: keine passende ungenutzte Pool-Frage gefunden.`
        );
        continue;
      }

      usedSourcePoolQuestionIds.add(selectedPoolQuestion.id);

      questionsToInsert.push({
        quiz_set_id: quizSetId,
        room_code: "GENERATED",
        source_pool_question_id: selectedPoolQuestion.id,
        question_number: existingQuestions.length + questionsToInsert.length + 1,
        category: selectedPoolQuestion.category,
        points: selectedPoolQuestion.difficulty * 100,
        question: selectedPoolQuestion.question,
        solution: selectedPoolQuestion.solution,
        accepted_answers: selectedPoolQuestion.accepted_answers || [],
        host_notes: selectedPoolQuestion.host_notes || "",
        image_url: selectedPoolQuestion.image_url || "",
        audio_url: selectedPoolQuestion.audio_url || "",
        solution_image_url: selectedPoolQuestion.solution_image_url || "",
        solution_audio_url: selectedPoolQuestion.solution_audio_url || "",
        is_played: false,
      });
    }
  }

  if (questionsToInsert.length === 0) {
    alert(
      warnings.length > 0
        ? warnings.join("\n")
        : "Es wurden keine fehlenden Fragen gefunden."
    );
    return;
  }

  const { error: insertError } = await supabase
    .from("questions")
    .insert(questionsToInsert);

  if (insertError) {
    alert("Fehlende Fragen konnten nicht ergänzt werden: " + insertError.message);
    return;
  }

  for (const insertedQuestion of questionsToInsert) {
    const sourceId = insertedQuestion.source_pool_question_id;

    if (!sourceId) {
      continue;
    }

    const { data: currentPoolQuestion, error: loadPoolQuestionError } =
      await supabase
        .from("pool_questions")
        .select("usage_count")
        .eq("id", sourceId)
        .single();

    if (loadPoolQuestionError) {
      console.error(
        "Pool-Frage konnte für usage_count nicht geladen werden:",
        loadPoolQuestionError
      );
      continue;
    }

    const currentUsageCount = currentPoolQuestion?.usage_count || 0;

    const { error: updatePoolQuestionError } = await supabase
      .from("pool_questions")
      .update({
        usage_count: currentUsageCount + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", sourceId);

    if (updatePoolQuestionError) {
      console.error(
        "usage_count konnte nicht aktualisiert werden:",
        updatePoolQuestionError
      );
    }
  }

  if (expandedQuizSetId === quizSetId) {
    const { data, error: reloadError } = await supabase
      .from("questions")
      .select(
        "id, question_number, category, points, question, solution, source_pool_question_id"
      )
      .eq("quiz_set_id", quizSetId)
      .order("question_number", { ascending: true });

    if (reloadError) {
      alert(
        "Quiz-Set-Fragen konnten nicht neu geladen werden: " +
          reloadError.message
      );
      return;
    }

    setQuizSetQuestions((data || []) as QuizSetQuestion[]);
  }

  await loadQuizSetsWithCount();

  alert(
    `${questionsToInsert.length} fehlende Fragen ergänzt.` +
      (warnings.length > 0 ? "\n\n" + warnings.join("\n") : "")
  );
}

async function handleDeleteQuizSetQuestion(questionId: string) {
  const confirmed = window.confirm(
    "Diese Frage wirklich aus dem Quiz-Set entfernen?"
  );

  if (!confirmed) {
    return;
  }

  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", questionId);

  if (error) {
    alert("Frage konnte nicht gelöscht werden: " + error.message);
    return;
  }

  if (expandedQuizSetId) {
    const currentQuizSetId = expandedQuizSetId;

    const { data, error: reloadError } = await supabase
      .from("questions")
      .select(
        "id, question_number, category, points, question, solution, source_pool_question_id"
      )
      .eq("quiz_set_id", currentQuizSetId)
      .order("question_number", { ascending: true });

    if (reloadError) {
      alert(
        "Quiz-Set-Fragen konnten nicht neu geladen werden: " +
          reloadError.message
      );
      return;
    }

    setQuizSetQuestions((data || []) as QuizSetQuestion[]);
  }

  setReplacementSelection(null);

  await loadQuizSetsWithCount();

  alert("Frage wurde entfernt.");
}

async function handleDeleteQuizSet(quizSetId: string, title: string) {
  const confirmed = window.confirm(
    `Quiz-Set "${title}" wirklich löschen? Die zugehörigen Template-Fragen werden ebenfalls gelöscht.`
  );

  if (!confirmed) {
    return;
  }

  const { error: questionsError } = await supabase
    .from("questions")
    .delete()
    .eq("quiz_set_id", quizSetId);

  if (questionsError) {
    alert("Fragen konnten nicht gelöscht werden: " + questionsError.message);
    return;
  }

  const { data: deletedQuizSet, error: quizSetError } = await supabase
    .from("quiz_sets")
    .delete()
    .eq("id", quizSetId)
    .select("id, title")
    .maybeSingle();

  if (quizSetError) {
    alert("Quiz-Set konnte nicht gelöscht werden: " + quizSetError.message);
    return;
  }

  if (!deletedQuizSet) {
    alert(
      "Quiz-Set wurde nicht gelöscht. Die ID wurde nicht gefunden oder Delete ist durch RLS blockiert."
    );
    return;
  }

  if (expandedQuizSetId === quizSetId) {
    setExpandedQuizSetId(null);
    setQuizSetQuestions([]);
    setReplacementSelection(null);
  }

  await loadQuizSetsWithCount();

  alert("Quiz-Set wurde gelöscht.");
}

    async function handleToggleQuizSetQuestions(quizSetId: string) {
    setReplacementSelection(null);

    if (expandedQuizSetId === quizSetId) {
      setExpandedQuizSetId(null);
      setQuizSetQuestions([]);
      return;
    }

    const { data, error } = await supabase
      .from("questions")
      .select(
        "id, question_number, category, points, question, solution, source_pool_question_id"
      )
      .eq("quiz_set_id", quizSetId)
      .order("question_number", { ascending: true });

    if (error) {
      alert("Quiz-Set-Fragen konnten nicht geladen werden: " + error.message);
      return;
    }

    setExpandedQuizSetId(quizSetId);
    setQuizSetQuestions((data || []) as QuizSetQuestion[]);
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Quiz-Sets</h1>

      <a
        href="/generator"
        style={{
            display: "inline-block",
            marginBottom: 24,
            marginRight: 12,
            padding: "10px 14px",
            background: "#003366",
            color: "white",
            border: "1px solid #0066aa",
            textDecoration: "none",
            fontWeight: "bold",
        }}
        >
        Zum Generator
      </a>

      <a
        href="/pools"
        style={{
            display: "inline-block",
            marginBottom: 24,
            marginRight: 12,
            padding: "10px 14px",
            background: "#003366",
            color: "white",
            border: "1px solid #0066aa",
            textDecoration: "none",
            fontWeight: "bold",
        }}
      >
        Zurück zu den Pools
      </a>

      <a
        href="/admin"
        style={{
            display: "inline-block",
            marginBottom: 24,
            padding: "10px 14px",
            background: "#003366",
            color: "white",
            border: "1px solid #0066aa",
            textDecoration: "none",
            fontWeight: "bold",
        }}
      >
        Zum Admin-Dashboard
      </a>

      <p style={{ color: "gray" }}>
        Verwaltung der fertigen Quiz-Sets.
      </p>

      <section
        style={{
          marginTop: 24,
          padding: 16,
          border: "1px solid #333",
          background: "#080808",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Quiz-Set-Verwaltung</h2>

        <button
          type="button"
          onClick={loadQuizSetsWithCount}
          style={{
            marginBottom: 12,
            padding: "8px 10px",
            background: "#222",
            color: "white",
            border: "1px solid #555",
            cursor: "pointer",
          }}
        >
          Validierung aktualisieren
        </button>

        {quizSetsWithCount.length === 0 ? (
          <p style={{ color: "gray" }}>Keine Quiz-Sets vorhanden.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {quizSetsWithCount.map((quizSet) => (
              <div
                key={quizSet.id}
                style={{
                  display: "grid",
                  gap: 12,
                  padding: 12,
                  border: "1px solid #333",
                  background: "#111",
                }}
              >
                <div>
                  <strong style={{ color: "white" }}>{quizSet.title}</strong>

                  <div style={{ color: "gray", fontSize: 13 }}>
                    {quizSet.question_count} Fragen
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      display: "inline-block",
                      padding: "4px 8px",
                      border: quizSet.validation.isBoardValid
                        ? "1px solid #00ff88"
                        : "1px solid #ffaa00",
                      color: quizSet.validation.isBoardValid
                        ? "#00ff88"
                        : "#ffaa00",
                      background: quizSet.validation.isBoardValid
                        ? "#002b18"
                        : "#1a1200",
                      fontSize: 13,
                      fontWeight: "bold",
                    }}
                  >
                    {quizSet.validation.statusText}
                  </div>

{quizSet.validation.warnings.length > 0 && (
  <div style={{ marginTop: 8 }}>
    <button
      type="button"
      onClick={() => handleToggleQuizSetValidation(quizSet.id)}
      style={{
        padding: "6px 8px",
        background: "#1a1200",
        color: "#ffaa00",
        border: "1px solid #ffaa00",
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      {expandedValidationQuizSetId === quizSet.id
        ? "Validierung ausblenden"
        : `Validierung anzeigen (${quizSet.validation.warnings.length})`}
    </button>

    {expandedValidationQuizSetId === quizSet.id && (
      <div>
        <ul
          style={{
            marginTop: 8,
            marginBottom: 0,
            paddingLeft: 18,
            color: "#ffaa00",
            fontSize: 13,
          }}
        >
          {quizSet.validation.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>

        <div
          style={{
            marginTop: 12,
            display: "grid",
            gap: 8,
          }}
        >
          {quizSet.validation.categorySummaries.map((summary) => (
            <div
              key={summary.category}
              style={{
                padding: 10,
                border: "1px solid #333",
                background: "#080808",
                color: "white",
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: 4 }}>
                {summary.category}
              </div>

              <div style={{ color: "#bbbbbb" }}>
                Vorhanden:{" "}
                {summary.existingPoints.length > 0
                  ? summary.existingPoints.join(", ")
                  : "keine"}
              </div>

              <div
                style={{
                  color:
                    summary.missingPoints.length > 0 ? "#ffaa00" : "#00ff88",
                }}
              >
                Fehlt:{" "}
                {summary.missingPoints.length > 0
                  ? summary.missingPoints.join(", ")
                  : "nichts"}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
)}
                  
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => handleToggleQuizSetQuestions(quizSet.id)}
                  style={{
                        padding: "8px 10px",
                        background: "#111",
                        color: "white",
                        border: "1px solid #555",
                        cursor: "pointer",
                  }}
                >
                  {expandedQuizSetId === quizSet.id ? "Schliessen" : "Fragen anzeigen"}
                </button>

                <button
                    type="button"
                    onClick={() => handleRenameQuizSet(quizSet.id, quizSet.title)}
                    style={{
                    padding: "8px 10px",
                    background: "#222",
                    color: "white",
                    border: "1px solid #555",
                    cursor: "pointer",
                    }}
                >
                    Umbenennen
                </button>

                <button
                    type="button"
                    onClick={() => handleDuplicateQuizSet(quizSet.id, quizSet.title)}
                    style={{
                    padding: "8px 10px",
                    background: "#003366",
                    color: "white",
                    border: "1px solid #0066aa",
                    cursor: "pointer",
                    }}
                >
                    Duplizieren
                </button>

                <button
                    type="button"
                    onClick={() => handleFillMissingQuizSetQuestions(quizSet.id)}
                    disabled={quizSet.validation.isBoardValid}
                    style={{
                    padding: "8px 10px",
                    background: quizSet.validation.isBoardValid ? "#333" : "#332600",
                    color: quizSet.validation.isBoardValid ? "#888" : "#ffaa00",
                    border: quizSet.validation.isBoardValid
                    ? "1px solid #444"
                    : "1px solid #ffaa00",
                    cursor: quizSet.validation.isBoardValid ? "not-allowed" : "pointer",
                    }}
                >
                    Fehlende Fragen ergänzen
                </button>

                <button
                    type="button"
                    onClick={() => handleDeleteQuizSet(quizSet.id, quizSet.title)}
                    style={{
                    padding: "8px 10px",
                    background: "#660000",
                    color: "white",
                    border: "1px solid #aa0000",
                    cursor: "pointer",
                    }}
                >
                    Löschen
                </button>
                </div>

{expandedQuizSetId === quizSet.id && (
  <div style={{ display: "grid", gap: 8 }}>

{replacementSelection && (
  <div
    style={{
      padding: 12,
      border: "1px solid #0066aa",
      background: "#001a33",
      color: "white",
      display: "grid",
      gap: 8,
    }}
  >
    <div style={{ fontWeight: "bold" }}>
      Ersatzfrage auswählen für:{" "}
      {replacementSelection.quizSetQuestion.category} ·{" "}
      {replacementSelection.quizSetQuestion.points} Punkte
    </div>

    {replacementSelection.candidates.map((candidate) => (
      <div
        key={candidate.id}
        style={{
          padding: 10,
          border: "1px solid #335577",
          background: "#07111f",
          display: "grid",
          gap: 6,
        }}
      >
        <div style={{ color: "#00ff88", fontWeight: "bold" }}>
          {candidate.category} · Schwierigkeit {candidate.difficulty} ·{" "}
          {candidate.difficulty * 100} Punkte
        </div>

        <div>{candidate.question}</div>

        <div style={{ color: "#bbbbbb", fontSize: 13 }}>
          Lösung: {candidate.solution || "Keine Lösung"}
        </div>

        <button
          type="button"
          onClick={() =>
            handleReplaceQuizSetQuestionWithCandidate(
              replacementSelection.quizSetQuestion,
              candidate
            )
          }
          style={{
            justifySelf: "start",
            padding: "8px 10px",
            background: "#00ff88",
            color: "black",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Diese Frage verwenden
        </button>
      </div>
    ))}

    <button
      type="button"
      onClick={() => setReplacementSelection(null)}
      style={{
        justifySelf: "start",
        padding: "8px 10px",
        background: "#222",
        color: "white",
        border: "1px solid #555",
        cursor: "pointer",
      }}
    >
      Auswahl schliessen
    </button>
  </div>
)}

    {quizSetQuestions.length === 0 ? (
      <p style={{ color: "gray" }}>Keine Fragen in diesem Quiz-Set.</p>
    ) : (
      quizSetQuestions.map((question) => (
        <div
          key={question.id}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 16,
            alignItems: "start",
            padding: 14,
            border: "1px solid #333",
            background: "#080808",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div
              style={{
                color: "#00ff88",
                fontSize: 13,
                fontWeight: "bold",
                letterSpacing: 0.3,
              }}
            >
              Frage {question.question_number} · {question.category} ·{" "}
              {question.points} Punkte
            </div>

            <div
              style={{
                color: "white",
                fontSize: 16,
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              {question.question}
            </div>

            <div
              style={{
                color: "#bbbbbb",
                fontSize: 14,
                lineHeight: 1.4,
              }}
            >
              Lösung: {question.solution || "Keine Lösung"}
            </div>
          </div>
            <div style={{ display: "grid", gap: 8 }}>
            <button
                type="button"
                onClick={() => handleShowReplacementCandidates(question)}
                style={{
                padding: "8px 10px",
                background: "#003366",
                color: "white",
                border: "1px solid #0066aa",
                cursor: "pointer",
                whiteSpace: "nowrap",
                }}
            >
                Ersetzen
            </button>

            <button
                type="button"
                onClick={() => handleDeleteQuizSetQuestion(question.id)}
                style={{
                padding: "8px 10px",
                background: "#660000",
                color: "white",
                border: "1px solid #aa0000",
                cursor: "pointer",
                whiteSpace: "nowrap",
                }}
            >
                Entfernen
            </button>
            </div>
        </div>
      ))
    )}
  </div>
)}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
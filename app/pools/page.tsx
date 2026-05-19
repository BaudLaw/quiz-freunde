"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getQuestionPools,
  getPoolQuestions,
  createQuestionPool,
  createPoolQuestion,
  updatePoolQuestion,
} from "@/lib/pools";
import type { PoolQuestion, QuestionPool } from "@/lib/poolTypes";
import { generateQuizFromPoolQuestions } from "@/lib/generator";

type QuizSetOption = {
  id: string;
  title: string;
};

export default function PoolsPage() {
const [pools, setPools] = useState<QuestionPool[]>([]);
const [questions, setQuestions] = useState<PoolQuestion[]>([]);
const [selectedPoolId, setSelectedPoolId] = useState<string>("");

const [newPoolName, setNewPoolName] = useState("");
const [newPoolDescription, setNewPoolDescription] = useState("");
const [loading, setLoading] = useState(false);
const [newQuestion, setNewQuestion] = useState("");
const [newSolution, setNewSolution] = useState("");
const [newCategory, setNewCategory] = useState("");
const [newDifficulty, setNewDifficulty] = useState(1);
const [newAcceptedAnswers, setNewAcceptedAnswers] = useState("");
const [newHostNotes, setNewHostNotes] = useState("");
const [newTags, setNewTags] = useState("");
const [imageFile, setImageFile] = useState<File | null>(null);
const [uploadingImage, setUploadingImage] = useState(false);
const [audioFile, setAudioFile] = useState<File | null>(null);
const [uploadingAudio, setUploadingAudio] = useState(false);
const [solutionImageFile, setSolutionImageFile] = useState<File | null>(null);
const [uploadingSolutionImage, setUploadingSolutionImage] =
  useState(false);
const [solutionAudioFile, setSolutionAudioFile] = useState<File | null>(null);
const [uploadingSolutionAudio, setUploadingSolutionAudio] =
  useState(false);
const [csvFile, setCsvFile] = useState<File | null>(null);
const [importingCsv, setImportingCsv] = useState(false);
const [categoryFilter, setCategoryFilter] = useState("");
const [difficultyFilter, setDifficultyFilter] = useState("");
const [activeFilter, setActiveFilter] = useState("active");
const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
const [editCategory, setEditCategory] = useState("");
const [editDifficulty, setEditDifficulty] = useState(1);
const [editQuestion, setEditQuestion] = useState("");
const [editSolution, setEditSolution] = useState("");
const [editAcceptedAnswers, setEditAcceptedAnswers] = useState("");
const [editHostNotes, setEditHostNotes] = useState("");
const [editTags, setEditTags] = useState("");
const [generatorCategory, setGeneratorCategory] = useState("");
const [generatorDifficulty, setGeneratorDifficulty] = useState("");
const [generatorAmount, setGeneratorAmount] = useState(5);
const [generatorPreview, setGeneratorPreview] = useState<PoolQuestion[]>([]);
const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
const [generatedQuizSetId, setGeneratedQuizSetId] = useState<string | null>(null);
const [generatorQuizTitle, setGeneratorQuizTitle] = useState("Generiertes Quiz");
const [quizSetOptions, setQuizSetOptions] = useState<QuizSetOption[]>([]);
const [targetQuizSetId, setTargetQuizSetId] = useState("");
const [generatorMode, setGeneratorMode] = useState<"append" | "replace">("append");
const [generatorRuleMode, setGeneratorRuleMode] =
  useState<"random" | "balancedDifficulty">("random");

const [generatorWarnings, setGeneratorWarnings] = useState<string[]>([]);
const [selectedBoardCategories, setSelectedBoardCategories] =
  useState<string[]>([]);

const availableBoardCategories = Array.from(
  new Set(
    questions
      .filter((question) => question.is_active)
      .map((question) => question.category)
      .filter(Boolean)
  )
).sort();

async function loadQuizSetOptions() {
  const { data, error } = await supabase
    .from("quiz_sets")
    .select("id,title")
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error("Quiz-Sets konnten nicht geladen werden:", error);
    return;
  }

  setQuizSetOptions(data || []);
}

  useEffect(() => {
    async function loadPools() {
      const { data, error } = await getQuestionPools();

      if (error) {
        console.error("Fehler beim Laden der Pools:", error);
        return;
      }

      setPools(data ?? []);
    }

    loadPools();
    loadQuizSetOptions();
  }, []);

  const filteredQuestions = questions.filter((question) => {
  const matchesCategory =
    !categoryFilter ||
    question.category.toLowerCase().includes(categoryFilter.toLowerCase());

  const matchesDifficulty =
    !difficultyFilter || question.difficulty === Number(difficultyFilter);

  const matchesActive =
    activeFilter === "all" ||
    (activeFilter === "active" && question.is_active) ||
    (activeFilter === "inactive" && !question.is_active);

  return matchesCategory && matchesDifficulty && matchesActive;
});

function toggleBoardCategory(category: string) {
  setSelectedBoardCategories((currentCategories) => {
    if (currentCategories.includes(category)) {
      return currentCategories.filter(
        (currentCategory) => currentCategory !== category
      );
    }

    if (currentCategories.length >= 6) {
      alert("Es können maximal 6 Kategorien ausgewählt werden.");
      return currentCategories;
    }

    return [...currentCategories, category];
  });
}

function shufflePoolQuestions(input: PoolQuestion[]) {
  return [...input].sort(() => Math.random() - 0.5);
}

function rankPoolQuestionsForGenerator(input: PoolQuestion[]) {
  return shufflePoolQuestions(input).sort((a, b) => {
    const usageA = a.usage_count ?? 0;
    const usageB = b.usage_count ?? 0;

    if (usageA !== usageB) {
      return usageA - usageB;
    }

    const lastUsedA = a.last_used_at
      ? new Date(a.last_used_at).getTime()
      : 0;

    const lastUsedB = b.last_used_at
      ? new Date(b.last_used_at).getTime()
      : 0;

    return lastUsedA - lastUsedB;
  });
}

function buildBalancedDifficultyPreview(
  availableQuestions: PoolQuestion[],
  amount: number
) {
  const difficulties = [1, 2, 3, 4, 5];
  const selectedQuestions: PoolQuestion[] = [];

  const questionsByDifficulty = difficulties.map((difficulty) => ({
    difficulty,
questions: rankPoolQuestionsForGenerator(
  availableQuestions.filter(
    (question) => question.difficulty === difficulty
  )
),
  }));

  const baseAmountPerDifficulty = Math.floor(amount / difficulties.length);
  let remainingQuestions = amount % difficulties.length;

  for (const group of questionsByDifficulty) {
    const targetAmount =
      baseAmountPerDifficulty + (remainingQuestions > 0 ? 1 : 0);

    if (remainingQuestions > 0) {
      remainingQuestions -= 1;
    }

    selectedQuestions.push(...group.questions.slice(0, targetAmount));
  }

  if (selectedQuestions.length < amount) {
    const selectedIds = new Set(
      selectedQuestions.map((question) => question.id)
    );

    const fallbackQuestions = shufflePoolQuestions(
      availableQuestions.filter((question) => !selectedIds.has(question.id))
    );

    selectedQuestions.push(
      ...fallbackQuestions.slice(0, amount - selectedQuestions.length)
    );
  }

  return selectedQuestions.slice(0, amount);
}

function buildGeneratorWarnings(
  availableQuestions: PoolQuestion[],
  previewQuestions: PoolQuestion[],
  requestedAmount: number
) {
  const warnings: string[] = [];

  if (availableQuestions.length < requestedAmount) {
    warnings.push(
      `Nur ${availableQuestions.length} passende aktive Fragen gefunden. Gewünscht waren ${requestedAmount}.`
    );
  }

  const questionsWithoutSolution = previewQuestions.filter(
    (question) => !question.solution?.trim()
  );

  if (questionsWithoutSolution.length > 0) {
    warnings.push(
      `${questionsWithoutSolution.length} Vorschau-Fragen haben keine Lösung.`
    );
  }

  const questionsWithoutMedia = previewQuestions.filter(
    (question) =>
      !question.image_url &&
      !question.audio_url &&
      !question.solution_image_url &&
      !question.solution_audio_url
  );

  if (questionsWithoutMedia.length > 0) {
    warnings.push(
      `${questionsWithoutMedia.length} Vorschau-Fragen haben keine Medien.`
    );
  }

  if (generatorRuleMode === "balancedDifficulty") {
    const usedDifficulties = new Set(
      previewQuestions.map((question) => question.difficulty)
    );

    if (usedDifficulties.size < 5) {
      warnings.push(
        "Ausgewogene Schwierigkeit ist eingeschränkt, weil nicht alle Schwierigkeiten 1 bis 5 genügend Fragen enthalten."
      );
    }
  }

  return warnings;
}

function handleGenerateBoardQuizPreview() {
  if (selectedBoardCategories.length === 0) {
    setGeneratorPreview([]);
    setGeneratorWarnings(["Wähle mindestens eine Kategorie aus."]);
    alert("Wähle mindestens eine Kategorie aus.");
    return;
  }

  const difficulties = [1, 2, 3, 4, 5];
  const previewQuestions: PoolQuestion[] = [];
  const warnings: string[] = [];

  for (const category of selectedBoardCategories) {
    for (const difficulty of difficulties) {
      const matchingQuestions = questions.filter(
        (question) =>
          question.is_active &&
          question.category === category &&
          question.difficulty === difficulty
      );

      if (matchingQuestions.length === 0) {
        warnings.push(
          `Kategorie "${category}" hat keine aktive Frage mit Schwierigkeit ${difficulty}.`
        );
        continue;
      }

const selectedQuestion =
  rankPoolQuestionsForGenerator(matchingQuestions)[0];

previewQuestions.push(selectedQuestion);
    }
  }

  if (warnings.length > 0) {
    setGeneratorPreview([]);
    setGeneratorWarnings(warnings);
    alert(warnings.join("\n"));
    return;
  }

  const questionsWithoutSolution = previewQuestions.filter(
    (question) => !question.solution?.trim()
  );

  if (questionsWithoutSolution.length > 0) {
    warnings.push(
      `${questionsWithoutSolution.length} Vorschau-Fragen haben keine Lösung.`
    );
  }

  const questionsWithoutMedia = previewQuestions.filter(
    (question) =>
      !question.image_url &&
      !question.audio_url &&
      !question.solution_image_url &&
      !question.solution_audio_url
  );

  if (questionsWithoutMedia.length > 0) {
    warnings.push(
      `${questionsWithoutMedia.length} Vorschau-Fragen haben keine Medien.`
    );
  }

  setGeneratorPreview(previewQuestions);
  setGeneratorWarnings(warnings);
  setGeneratorAmount(previewQuestions.length);

  if (warnings.length > 0) {
    alert(warnings.join("\n"));
  }
}

function handleGeneratePreview() {
  const safeAmount = Math.max(1, Math.min(generatorAmount, 50));

  if (safeAmount !== generatorAmount) {
    setGeneratorAmount(safeAmount);
  }

  let availableQuestions = questions.filter((question) => question.is_active);

  if (generatorCategory.trim()) {
    availableQuestions = availableQuestions.filter((question) =>
      question.category
        .toLowerCase()
        .includes(generatorCategory.trim().toLowerCase())
    );
  }

  if (generatorDifficulty) {
    availableQuestions = availableQuestions.filter(
      (question) => question.difficulty === Number(generatorDifficulty)
    );
  }

  if (availableQuestions.length === 0) {
    setGeneratorPreview([]);
    setGeneratorWarnings(["Keine passenden aktiven Fragen gefunden."]);
    alert("Keine passenden aktiven Fragen gefunden.");
    return;
  }

  const previewQuestions =
    generatorRuleMode === "balancedDifficulty"
      ? buildBalancedDifficultyPreview(availableQuestions, safeAmount)
      : rankPoolQuestionsForGenerator(availableQuestions).slice(0, safeAmount);

  setGeneratorPreview(previewQuestions);

  const warnings = buildGeneratorWarnings(
    availableQuestions,
    previewQuestions,
    safeAmount
  );

  setGeneratorWarnings(warnings);

  if (warnings.length > 0) {
    alert(warnings.join("\n"));
  }
}

  async function handleGenerateQuiz() {
    if (generatorPreview.length === 0) {
      alert("Keine Vorschau-Fragen zum Generieren vorhanden.");
      return;
    }

    setIsGeneratingQuiz(true);
    setGeneratedQuizSetId(null);

    try {
      const cleanTitle = generatorQuizTitle.trim() || "Generiertes Quiz";

const result = await generateQuizFromPoolQuestions({
  poolQuestionIds: generatorPreview.map((question) => question.id),
  quizSetId: targetQuizSetId || undefined,
  quizSetTitle: cleanTitle,
  mode: targetQuizSetId ? generatorMode : "append",
});

setGeneratedQuizSetId(result.quizSetId);

const { data, error } = await supabase
  .from("quiz_sets")
  .select("id,title")
  .order("created_at", {
    ascending: false,
  });

if (!error) {
  setQuizSetOptions(data || []);
}

const actionText =
  targetQuizSetId && generatorMode === "replace"
    ? "Bestehende Generator-Fragen wurden ersetzt."
    : targetQuizSetId
      ? "Fragen wurden an das bestehende Quiz-Set angehängt."
      : "Neues Quiz-Set wurde erstellt.";

alert(`${actionText} Anzahl Fragen: ${generatorPreview.length}`);
    } catch (error) {
      console.error("Fehler beim Generieren des Quiz:", error);

      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert("Quiz konnte nicht generiert werden.");
      }
    } finally {
      setIsGeneratingQuiz(false);
    }
  }

  async function handleCreatePool() {
    if (!newPoolName.trim()) {
        alert("Bitte Pool-Name eingeben.");
        return;
    }

    setLoading(true);

    const { data, error } = await createQuestionPool({
        name: newPoolName.trim(),
        description: newPoolDescription.trim(),
        type: "general",
    });

    setLoading(false);

    if (error) {
        console.error("Fehler beim Erstellen des Pools:", error);
        alert("Pool konnte nicht erstellt werden.");
        return;
    }

    setPools([data, ...pools]);
    setNewPoolName("");
    setNewPoolDescription("");
  }

  function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());

  return result;
}

function parseBoolean(value: string): boolean {
  if (!value.trim()) return true;

  return value.trim().toLowerCase() === "true";
}

  async function handleImportCsv() {
  if (!selectedPoolId) {
    alert("Bitte zuerst einen Pool auswählen.");
    return;
  }

  if (!csvFile) {
    alert("Bitte CSV-Datei auswählen.");
    return;
  }

  setImportingCsv(true);

  const text = await csvFile.text();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    setImportingCsv(false);
    alert("CSV enthält keine Fragen.");
    return;
  }

  const header = parseCsvLine(lines[0]);

  const requiredHeaders = [
    "category",
    "difficulty",
    "question",
    "solution",
    "accepted_answers",
    "host_notes",
    "image_url",
    "audio_url",
    "solution_image_url",
    "solution_audio_url",
    "source",
    "tags",
    "is_active",
  ];

  const missingHeaders = requiredHeaders.filter(
    (headerName) => !header.includes(headerName)
  );

  if (missingHeaders.length > 0) {
    setImportingCsv(false);
    alert(`CSV-Spalten fehlen: ${missingHeaders.join(", ")}`);
    return;
  }

  const rows = lines.slice(1);

  const createdQuestions = [];

  for (const row of rows) {
    const values = parseCsvLine(row);

    const getValue = (columnName: string) => {
      const index = header.indexOf(columnName);
      return values[index] ?? "";
    };

    const difficulty = Number(getValue("difficulty"));

    if (!difficulty || difficulty < 1 || difficulty > 5) {
      console.error("Ungültige Schwierigkeit:", row);
      continue;
    }

    const questionText = getValue("question").trim();
    const category = getValue("category").trim();

    if (!questionText || !category) {
      console.error("Zeile übersprungen, Frage oder Kategorie fehlt:", row);
      continue;
    }

    const acceptedAnswers = getValue("accepted_answers")
      .split("|")
      .map((answer) => answer.trim())
      .filter(Boolean);

    const tags = getValue("tags")
      .split("|")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const { data, error } = await createPoolQuestion({
      pool_id: selectedPoolId,
      category,
      difficulty: difficulty as 1 | 2 | 3 | 4 | 5,
      question: questionText,
      solution: getValue("solution").trim() || null,
      accepted_answers: acceptedAnswers,
      host_notes: getValue("host_notes").trim() || null,
      image_url: getValue("image_url").trim() || null,
      audio_url: getValue("audio_url").trim() || null,
      solution_image_url: getValue("solution_image_url").trim() || null,
      solution_audio_url: getValue("solution_audio_url").trim() || null,
      source: getValue("source").trim() || "csv",
      tags,
      usage_count: 0,
      is_active: parseBoolean(getValue("is_active")),
    });

    if (error) {
      console.error("Fehler beim Import einer CSV-Zeile:", error, row);
      continue;
    }

    if (data) {
      createdQuestions.push(data);
    }
  }

  setQuestions([...createdQuestions, ...questions]);
  setCsvFile(null);
  setImportingCsv(false);

  alert(`${createdQuestions.length} Fragen importiert.`);
}

  async function uploadPoolImage(file: File): Promise<string | null> {
  setUploadingImage(true);

  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${fileExt}`;

  const filePath = `pool-images/${fileName}`;

  const { error } = await supabase.storage
    .from("quiz-media")
    .upload(filePath, file);

  setUploadingImage(false);

  if (error) {
    console.error("Fehler beim Bildupload:", error);
    alert("Bild konnte nicht hochgeladen werden.");
    return null;
  }

  const { data } = supabase.storage.from("quiz-media").getPublicUrl(filePath);

  return data.publicUrl;
}

  async function uploadPoolAudio(file: File): Promise<string | null> {
    setUploadingAudio(true);

    const fileExt = file.name.split(".").pop();

    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${fileExt}`;

    const filePath = `pool-audio/${fileName}`;

    const { error } = await supabase.storage
      .from("quiz-media")
      .upload(filePath, file);

    setUploadingAudio(false);

    if (error) {
      console.error("Fehler beim Audio-Upload:", error);
      alert("Audio konnte nicht hochgeladen werden.");
      return null;
    }

    const { data } = supabase.storage
      .from("quiz-media")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function uploadSolutionImage(file: File): Promise<string | null> {
  setUploadingSolutionImage(true);

  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${fileExt}`;

  const filePath = `pool-solution-images/${fileName}`;

  const { error } = await supabase.storage
    .from("quiz-media")
    .upload(filePath, file);

  setUploadingSolutionImage(false);

  if (error) {
    console.error("Fehler beim Lösungsbild-Upload:", error);
    alert("Lösungsbild konnte nicht hochgeladen werden.");
    return null;
  }

  const { data } = supabase.storage
    .from("quiz-media")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

  async function uploadSolutionAudio(file: File): Promise<string | null> {
  setUploadingSolutionAudio(true);

  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${fileExt}`;

  const filePath = `pool-solution-audio/${fileName}`;

  const { error } = await supabase.storage
    .from("quiz-media")
    .upload(filePath, file);

  setUploadingSolutionAudio(false);

  if (error) {
    console.error("Fehler beim Lösungsaudio-Upload:", error);
    alert("Lösungsaudio konnte nicht hochgeladen werden.");
    return null;
  }

  const { data } = supabase.storage
    .from("quiz-media")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

  function startEditQuestion(question: PoolQuestion) {
  setEditingQuestionId(question.id);
  setEditCategory(question.category);
  setEditDifficulty(question.difficulty);
  setEditQuestion(question.question);
  setEditSolution(question.solution ?? "");
  setEditAcceptedAnswers(question.accepted_answers.join("|"));
  setEditHostNotes(question.host_notes ?? "");
  setEditTags(question.tags.join("|"));
  }

  async function handleSaveEditQuestion() {
    if (!editingQuestionId) return;

    if (!editCategory.trim()) {
      alert("Bitte Kategorie eingeben.");
      return;
    }

    if (!editQuestion.trim()) {
      alert("Bitte Frage eingeben.");
      return;
    }

    const acceptedAnswers = editAcceptedAnswers
      .split("|")
      .map((answer) => answer.trim())
      .filter(Boolean);

    const tags = editTags
      .split("|")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const { data, error } = await updatePoolQuestion(editingQuestionId, {
      category: editCategory.trim(),
      difficulty: editDifficulty as 1 | 2 | 3 | 4 | 5,
      question: editQuestion.trim(),
      solution: editSolution.trim() || null,
      accepted_answers: acceptedAnswers,
      host_notes: editHostNotes.trim() || null,
      tags,
    });

    if (error) {
      console.error("Fehler beim Speichern der Frage:", error);
      alert("Frage konnte nicht gespeichert werden.");
      return;
    }

    if (!data) return;

    setQuestions(
      questions.map((question) =>
        question.id === editingQuestionId ? data : question
      )
    );

    setEditingQuestionId(null);
  }

  function cancelEditQuestion() {
  setEditingQuestionId(null);
  }

  async function handleDeactivateQuestion(questionId: string) {
    const { data, error } = await updatePoolQuestion(questionId, {
      is_active: false,
    });

    if (error) {
      console.error("Fehler beim Deaktivieren der Frage:", error);
      alert("Frage konnte nicht deaktiviert werden.");
      return;
    }

    if (!data) return;

    setQuestions(
      questions.map((question) =>
        question.id === questionId ? data : question
      )
    );
  }

  async function handleActivateQuestion(questionId: string) {
    const { data, error } = await updatePoolQuestion(questionId, {
      is_active: true,
    });

    if (error) {
      console.error("Fehler beim Aktivieren der Frage:", error);
      alert("Frage konnte nicht aktiviert werden.");
      return;
    }

    if (!data) return;

    setQuestions(
      questions.map((question) =>
        question.id === questionId ? data : question
      )
    );
  }

  async function handleCreateQuestion() {
  if (!selectedPoolId) {
    alert("Bitte zuerst einen Pool auswählen.");
    return;
  }

  if (!newQuestion.trim()) {
    alert("Bitte Frage eingeben.");
    return;
  }

  if (!newCategory.trim()) {
    alert("Bitte Kategorie eingeben.");
    return;
  }

  setLoading(true);

let imageUrl: string | null = null;
let audioUrl: string | null = null;
let solutionImageUrl: string | null = null;
let solutionAudioUrl: string | null = null;

if (imageFile) {
  imageUrl = await uploadPoolImage(imageFile);

  if (!imageUrl) {
    setLoading(false);
    return;
  }
}

if (audioFile) {
  audioUrl = await uploadPoolAudio(audioFile);

  if (!audioUrl) {
    setLoading(false);
    return;
  }
}

if (solutionImageFile) {
  solutionImageUrl = await uploadSolutionImage(solutionImageFile);

  if (!solutionImageUrl) {
    setLoading(false);
    return;
  }
}

if (solutionAudioFile) {
  solutionAudioUrl = await uploadSolutionAudio(solutionAudioFile);

  if (!solutionAudioUrl) {
    setLoading(false);
    return;
  }
}

const acceptedAnswers = newAcceptedAnswers
    .split("|")
    .map((answer) => answer.trim())
    .filter(Boolean);

  const tags = newTags
    .split("|")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const { data, error } = await createPoolQuestion({
    pool_id: selectedPoolId,
    category: newCategory.trim(),
    difficulty: newDifficulty as 1 | 2 | 3 | 4 | 5,

    question: newQuestion.trim(),
    solution: newSolution.trim(),

    accepted_answers: acceptedAnswers,
    host_notes: newHostNotes.trim(),

    image_url: imageUrl,
    audio_url: audioUrl,
    solution_image_url: solutionImageUrl,
    solution_audio_url: solutionAudioUrl,

    tags,
    source: "manual",

    usage_count: 0,
    is_active: true,
  });

  setLoading(false);

  if (error) {
    console.error("Fehler beim Erstellen der Frage:", error);
    alert("Frage konnte nicht erstellt werden.");
    return;
  }

  setQuestions([data, ...questions]);

  setNewQuestion("");
  setNewSolution("");
  setNewCategory("");
  setNewDifficulty(1);
  setNewAcceptedAnswers("");
  setNewHostNotes("");
  setNewTags("");
}

  async function handleSelectPool(poolId: string) {
    setSelectedPoolId(poolId);
    
setGeneratorPreview([]);
setGeneratorWarnings([]);
setGeneratorCategory("");
setGeneratorDifficulty("");
setGeneratorAmount(5);
setGeneratorRuleMode("random");
setSelectedBoardCategories([]);
setGeneratedQuizSetId(null);

    const { data, error } = await getPoolQuestions(poolId);

    if (error) {
      console.error("Fehler beim Laden der Pool-Fragen:", error);
      return;
    }

    setQuestions(data ?? []);
  }

  return ( 
    <main style={{ padding: 24 }}>
      <h1>Question Pools</h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
      <a
        href="/generator"
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
        Zum Generator
      </a>

      <a
        href="/quiz-sets"
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
        Zur Quiz-Set-Verwaltung
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

      </div>

      <h2>Pools</h2>
      <div
  style={{
    border: "1px solid gray",
    padding: 16,
    marginBottom: 24,
    maxWidth: 500,
  }}
>
  <h3>Neuen Pool erstellen</h3>

  <input
    type="text"
    placeholder="Pool Name"
    value={newPoolName}
    onChange={(e) => setNewPoolName(e.target.value)}
    style={{
      width: "100%",
      padding: 10,
      marginBottom: 12,
      background: "#111",
      color: "white",
      border: "1px solid gray",
    }}
  />

  <textarea
    placeholder="Beschreibung"
    value={newPoolDescription}
    onChange={(e) => setNewPoolDescription(e.target.value)}
    style={{
      width: "100%",
      padding: 10,
      marginBottom: 12,
      background: "#111",
      color: "white",
      border: "1px solid gray",
      minHeight: 100,
    }}
  />

  <button
    onClick={handleCreatePool}
    disabled={loading}
    style={{
      padding: "10px 16px",
      background: "white",
      color: "black",
      border: "none",
      cursor: "pointer",
      fontWeight: "bold",
    }}
  >
    {loading ? "Erstelle..." : "Pool erstellen"}
  </button>
</div>

      {pools.length === 0 && <p>Keine Pools gefunden.</p>}

      {pools.map((pool) => (
        <button
          key={pool.id}
          onClick={() => handleSelectPool(pool.id)}
          style={{
            display: "block",
            marginBottom: 8,
            padding: 12,
            border:
              selectedPoolId === pool.id
                ? "2px solid white"
                : "1px solid gray",
            background: "black",
            color: "white",
            cursor: "pointer",
          }}
        >
          {pool.name}
        </button>
      ))}

      <h2>Fragen</h2>

      <div
        style={{
          border: "1px solid gray",
          padding: 16,
          marginBottom: 24,
          maxWidth: 700,
          background: "#050505",
        }}
>
      <h3>Fragen filtern</h3>

      <input
        type="text"
        placeholder="Kategorie filtern, z.B. Musik"
        value={categoryFilter}
        onChange={(e) => setCategoryFilter(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          marginBottom: 12,
          background: "#111",
          color: "white",
          border: "1px solid gray",
        }}
      />

      <select
        value={difficultyFilter}
        onChange={(e) => setDifficultyFilter(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          marginBottom: 12,
          background: "#111",
          color: "white",
          border: "1px solid gray",
        }}
      >
        <option value="">Alle Schwierigkeiten</option>
        <option value="1">Schwierigkeit 1</option>
        <option value="2">Schwierigkeit 2</option>
        <option value="3">Schwierigkeit 3</option>
        <option value="4">Schwierigkeit 4</option>
        <option value="5">Schwierigkeit 5</option>
      </select>

      <select
        value={activeFilter}
        onChange={(e) => setActiveFilter(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          marginBottom: 12,
          background: "#111",
          color: "white",
          border: "1px solid gray",
        }}
      >
        <option value="active">Nur aktive Fragen</option>
        <option value="inactive">Nur inaktive Fragen</option>
        <option value="all">Alle Fragen</option>
      </select>

      <p style={{ color: "gray", margin: 0 }}>
        Angezeigt: {filteredQuestions.length} von {questions.length}
      </p>
    </div>

    {selectedPoolId && (
      <div
        style={{
          border: "1px solid gray",
          padding: 16,
          marginBottom: 24,
          maxWidth: 700,
          background: "#050505",
        }}
      >
        <h3>CSV-Import für Pool-Fragen</h3>

        <p style={{ color: "gray", fontSize: 14 }}>
          Importiert Fragen in den aktuell ausgewählten Pool.
        </p>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            setCsvFile(file);
          }}
          style={{
            color: "white",
            marginBottom: 12,
            display: "block",
          }}
        />

        <button
          onClick={handleImportCsv}
          disabled={importingCsv}
          style={{
            padding: "10px 16px",
            background: "white",
            color: "black",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          {importingCsv ? "Importiert..." : "CSV importieren"}
        </button>
      </div>
    )}

      {selectedPoolId && (
  <div
    style={{
      border: "1px solid gray",
      padding: 16,
      marginBottom: 24,
      maxWidth: 700,
    }}
  >
    <h3>Neue Frage erstellen</h3>

    <input
      type="text"
      placeholder="Kategorie, z.B. Musik"
      value={newCategory}
      onChange={(e) => setNewCategory(e.target.value)}
      style={{
        width: "100%",
        padding: 10,
        marginBottom: 12,
        background: "#111",
        color: "white",
        border: "1px solid gray",
      }}
    />

    <select
      value={newDifficulty}
      onChange={(e) => setNewDifficulty(Number(e.target.value))}
      style={{
        width: "100%",
        padding: 10,
        marginBottom: 12,
        background: "#111",
        color: "white",
        border: "1px solid gray",
      }}
    >
      <option value={1}>Schwierigkeit 1 = 100 Punkte</option>
      <option value={2}>Schwierigkeit 2 = 200 Punkte</option>
      <option value={3}>Schwierigkeit 3 = 300 Punkte</option>
      <option value={4}>Schwierigkeit 4 = 400 Punkte</option>
      <option value={5}>Schwierigkeit 5 = 500 Punkte</option>
    </select>

    <textarea
      placeholder="Frage"
      value={newQuestion}
      onChange={(e) => setNewQuestion(e.target.value)}
      style={{
        width: "100%",
        padding: 10,
        marginBottom: 12,
        background: "#111",
        color: "white",
        border: "1px solid gray",
        minHeight: 100,
      }}
    />

    <input
      type="text"
      placeholder="Lösung"
      value={newSolution}
      onChange={(e) => setNewSolution(e.target.value)}
      style={{
        width: "100%",
        padding: 10,
        marginBottom: 12,
        background: "#111",
        color: "white",
        border: "1px solid gray",
      }}
    />

    <input
      type="text"
      placeholder="Alternative Antworten mit | trennen, z.B. Queen|The Queen"
      value={newAcceptedAnswers}
      onChange={(e) => setNewAcceptedAnswers(e.target.value)}
      style={{
        width: "100%",
        padding: 10,
        marginBottom: 12,
        background: "#111",
        color: "white",
        border: "1px solid gray",
      }}
    />

    <div
    style={{
        marginBottom: 12,
        padding: 10,
        background: "#111",
        color: "white",
        border: "1px solid gray",
    }}
    >
    <label style={{ display: "block", marginBottom: 8, color: "white" }}>
        Fragebild hochladen
    </label>

    <input
        type="file"
        accept="image/*"
        onChange={(e) => {
        const file = e.target.files?.[0] ?? null;
        setImageFile(file);
        }}
        style={{
        color: "white",
        width: "100%",
        }}
    />

    {uploadingImage && (
        <p style={{ marginTop: 8, color: "white" }}>Bild wird hochgeladen...</p>
    )}
    </div>

    <div
  style={{
    marginBottom: 12,
    padding: 10,
    background: "#111",
    color: "white",
    border: "1px solid gray",
  }}
>
  <label style={{ display: "block", marginBottom: 8, color: "white" }}>
    Audio hochladen
  </label>

  <input
    type="file"
    accept="audio/*"
    onChange={(e) => {
      const file = e.target.files?.[0] ?? null;
      setAudioFile(file);
    }}
    style={{
      color: "white",
      width: "100%",
    }}
  />

  {uploadingAudio && (
    <p style={{ marginTop: 8, color: "white" }}>
      Audio wird hochgeladen...
    </p>
  )}
</div>

<div
  style={{
    marginBottom: 12,
    padding: 10,
    background: "#111",
    color: "white",
    border: "1px solid gray",
  }}
>
  <label style={{ display: "block", marginBottom: 8, color: "white" }}>
    Lösungsbild hochladen
  </label>

  <input
    type="file"
    accept="image/*"
    onChange={(e) => {
      const file = e.target.files?.[0] ?? null;
      setSolutionImageFile(file);
    }}
    style={{
      color: "white",
      width: "100%",
    }}
  />

  {uploadingSolutionImage && (
    <p style={{ marginTop: 8, color: "white" }}>
      Lösungsbild wird hochgeladen...
    </p>
  )}
</div>

<div
  style={{
    marginBottom: 12,
    padding: 10,
    background: "#111",
    color: "white",
    border: "1px solid gray",
  }}
>
  <label style={{ display: "block", marginBottom: 8, color: "white" }}>
    Lösungsaudio hochladen
  </label>

  <input
    type="file"
    accept="audio/*"
    onChange={(e) => {
      const file = e.target.files?.[0] ?? null;
      setSolutionAudioFile(file);
    }}
    style={{
      color: "white",
      width: "100%",
    }}
  />

  {uploadingSolutionAudio && (
    <p style={{ marginTop: 8, color: "white" }}>
      Lösungsaudio wird hochgeladen...
    </p>
  )}
</div>

    <textarea
      placeholder="Moderatornotizen"
      value={newHostNotes}
      onChange={(e) => setNewHostNotes(e.target.value)}
      style={{
        width: "100%",
        padding: 10,
        marginBottom: 12,
        background: "#111",
        color: "white",
        border: "1px solid gray",
        minHeight: 80,
      }}
    />

    <input
      type="text"
      placeholder="Tags mit | trennen, z.B. rock|klassiker"
      value={newTags}
      onChange={(e) => setNewTags(e.target.value)}
      style={{
        width: "100%",
        padding: 10,
        marginBottom: 12,
        background: "#111",
        color: "white",
        border: "1px solid gray",
      }}
    />

    <button
      onClick={handleCreateQuestion}
      disabled={loading}
      style={{
        padding: "10px 16px",
        background: "white",
        color: "black",
        border: "none",
        cursor: "pointer",
        fontWeight: "bold",
      }}
    >
      {loading ? "Speichert..." : "Frage erstellen"}
    </button>
  </div>
)}

      {filteredQuestions.length === 0 && <p>Keine passenden Fragen gefunden.</p>}

      {filteredQuestions.map((question) => (
        <div
          key={question.id}
          style={{
            border: "1px solid gray",
            padding: 12,
            marginBottom: 12,
          }}
        >

          {editingQuestionId === question.id ? (
            <div
              style={{
                border: "1px solid #555",
                padding: 12,
                marginBottom: 12,
                background: "#080808",
              }}
            >
              <h3>Frage bearbeiten</h3>

              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder="Kategorie"
                style={{
                  width: "100%",
                  padding: 10,
                  marginBottom: 12,
                  background: "#111",
                  color: "white",
                  border: "1px solid gray",
                }}
              />

              <select
                value={editDifficulty}
                onChange={(e) => setEditDifficulty(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: 10,
                  marginBottom: 12,
                  background: "#111",
                  color: "white",
                  border: "1px solid gray",
                }}
              >
                <option value={1}>Schwierigkeit 1 = 100 Punkte</option>
                <option value={2}>Schwierigkeit 2 = 200 Punkte</option>
                <option value={3}>Schwierigkeit 3 = 300 Punkte</option>
                <option value={4}>Schwierigkeit 4 = 400 Punkte</option>
                <option value={5}>Schwierigkeit 5 = 500 Punkte</option>
              </select>

              <textarea
                value={editQuestion}
                onChange={(e) => setEditQuestion(e.target.value)}
                placeholder="Frage"
                style={{
                  width: "100%",
                  padding: 10,
                  marginBottom: 12,
                  background: "#111",
                  color: "white",
                  border: "1px solid gray",
                  minHeight: 100,
                }}
              />

              <input
                type="text"
                value={editSolution}
                onChange={(e) => setEditSolution(e.target.value)}
                placeholder="Lösung"
                style={{
                  width: "100%",
                  padding: 10,
                  marginBottom: 12,
                  background: "#111",
                  color: "white",
                  border: "1px solid gray",
                }}
              />

              <input
                type="text"
                value={editAcceptedAnswers}
                onChange={(e) => setEditAcceptedAnswers(e.target.value)}
                placeholder="Alternative Antworten mit | trennen"
                style={{
                  width: "100%",
                  padding: 10,
                  marginBottom: 12,
                  background: "#111",
                  color: "white",
                  border: "1px solid gray",
                }}
              />

              <textarea
                value={editHostNotes}
                onChange={(e) => setEditHostNotes(e.target.value)}
                placeholder="Moderatornotizen"
                style={{
                  width: "100%",
                  padding: 10,
                  marginBottom: 12,
                  background: "#111",
                  color: "white",
                  border: "1px solid gray",
                  minHeight: 80,
                }}
              />

              <input
                type="text"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="Tags mit | trennen"
                style={{
                  width: "100%",
                  padding: 10,
                  marginBottom: 12,
                  background: "#111",
                  color: "white",
                  border: "1px solid gray",
                }}
              />

              <button
                onClick={handleSaveEditQuestion}
                style={{
                  padding: "8px 12px",
                  background: "white",
                  color: "black",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "bold",
                  marginRight: 8,
                }}
              >
                Speichern
              </button>

              <button
                onClick={cancelEditQuestion}
                style={{
                  padding: "8px 12px",
                  background: "#222",
                  color: "white",
                  border: "1px solid gray",
                  cursor: "pointer",
                }}
              >
                Abbrechen
              </button>
            </div>
          ) : (
  <>
            <strong>{question.category}</strong>
            <p>{question.question}</p>
            {question.image_url && (
              <img
                  src={question.image_url}
                  alt="Fragebild"
                  style={{
                  width: "100%",
                  maxWidth: 400,
                  marginTop: 12,
                  marginBottom: 12,
                  borderRadius: 8,
                  border: "1px solid gray",
                  }}
              />
            )}

            {question.audio_url && (
              <div style={{ marginTop: 12, marginBottom: 12 }}>
                  <audio controls style={{ width: "100%" }}>
                  <source src={question.audio_url} />
                  </audio>
              </div>
            )}

        {question.solution_image_url && (
        <img
            src={question.solution_image_url}
            alt="Lösungsbild"
            style={{
            width: "100%",
            maxWidth: 400,
            marginTop: 12,
            marginBottom: 12,
            borderRadius: 8,
            border: "1px solid gray",
            }}
        />
        )}

        {question.solution_audio_url && (
        <div style={{ marginTop: 12, marginBottom: 12 }}>
            <audio controls style={{ width: "100%" }}>
            <source src={question.solution_audio_url} />
            </audio>
        </div>
        )}

              <p>Lösung: {question.solution}</p>
              <p>Schwierigkeit: {question.difficulty}</p>
              <p>Punkte: {question.difficulty * 100}</p>
              <p>Status: {question.is_active ? "Aktiv" : "Inaktiv"}</p>

              <button
                onClick={() => startEditQuestion(question)}
                style={{
                  padding: "8px 12px",
                  background: "#222",
                  color: "white",
                  border: "1px solid gray",
                  cursor: "pointer",
                  marginTop: 8,
                  marginRight: 8,
                }}
              >
                Frage bearbeiten
              </button>

            {question.is_active && (
              <button
                onClick={() => handleDeactivateQuestion(question.id)}
                style={{
                  padding: "8px 12px",
                  background: "#3a0000",
                  color: "white",
                  border: "1px solid #aa3333",
                  cursor: "pointer",
                  marginTop: 8,
                }}
              >
                Frage deaktivieren
              </button>
            )}

            {!question.is_active && (
              <button
                onClick={() => handleActivateQuestion(question.id)}
                style={{
                  padding: "8px 12px",
                  background: "#003a12",
                  color: "white",
                  border: "1px solid #33aa55",
                  cursor: "pointer",
                  marginTop: 8,
                }}
              >
                Frage aktivieren
              </button>
            )}
              </>
          )}
        </div>
      ))}
</main>
  );
}
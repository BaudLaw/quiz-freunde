"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import JSZip from "jszip";
import AdminLayout from "@/components/AdminLayout";
import { uploadAdminMedia } from "@/lib/adminStorage";
import {
  assignHostedBuzzAnswer,
  clearHostedFeedback,
  deleteHostEditorQuestion,
  finishHostedRoom,
  getHostedRoomData,
  importHostQuizSet,
  markHostedCorrect,
  markHostedWrong,
  openHostedBoard,
  resetHostedRoom,
  setHostedGameState,
  setHostedTurnPlayer,
  showHostedSolution,
  saveHostQuizEditor,
  startHostedQuiz,
  startHostedTimer,
} from "@/lib/hostAdmin";
import { getQuizSetQuestions, getQuizSets } from "@/lib/quizSets";

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

type QuizSetValidationQuestion = {
  category: string;
  points: number;
};

function validateQuizSetForBoard(
  questions: QuizSetValidationQuestion[]
) {
  const warnings: string[] = [];
  const requiredPoints = [100, 200, 300, 400, 500];

  if (questions.length === 0) {
    return {
      isBoardValid: false,
      warnings: ["Dieses Quiz-Set enthält keine Fragen."],
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

    const pointsInCategory = categoryQuestions.map(
      (question) => Number(question.points)
    );

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

  return {
    isBoardValid: warnings.length === 0,
    warnings,
  };
}

function parseCSV(text: string) {
  const lines = text.trim().split("\n");

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = line
      .split(",")
      .map((v) => v.trim());

    const row: any = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    return row;
  });
}

export default function HostPage() {
  const [roomCode, setRoomCode] = useState("");
  const [quizTitle, setQuizTitle] = useState("");

  const [csvFile, setCsvFile] =
    useState<File | null>(null);

  const [savedQuizSets, setSavedQuizSets] =
    useState<any[]>([]);

  const [loadedQuestions, setLoadedQuestions] =
    useState<any[]>([]);

  const [players, setPlayers] =
    useState<any[]>([]);

  const [leaderboard, setLeaderboard] =
    useState<any[]>([]);

  const [room, setRoom] = useState<any>(null);

  const [showQuizList, setShowQuizList] =
  useState(false);

  const [activeQuestion, setActiveQuestion] =
    useState<any>(null);

  const [buzzes, setBuzzes] =
  useState<any[]>([]);

  const [imageFile, setImageFile] =
  useState<File | null>(null);

  const [audioFile, setAudioFile] =
  useState<File | null>(null);

  const [zipFile, setZipFile] =
  useState<File | null>(null);

  const [editingQuiz, setEditingQuiz] =
  useState<any>(null);

  const [editingQuestions, setEditingQuestions] =
  useState<any[]>([]);

  const [deletedQuestionIds, setDeletedQuestionIds] =
  useState<string[]>([]);

  useEffect(() => {
    loadQuizSets();
  }, []);

  useEffect(() => {
    if (!roomCode) return;

    loadRoomData();

    const interval = setInterval(() => {
      loadRoomData();
    }, 1000);

    return () => clearInterval(interval);
  }, [roomCode]);

async function loadQuizSets() {
  const { data, error } = await getQuizSets("list");

  if (error) {
    alert("Quiz-Sets konnten nicht geladen werden: " + error.message);
    return;
  }

  setSavedQuizSets(data || []);
}

  async function loadQuizEditor(
  quizSetId: string
) {
  const selectedQuiz =
    savedQuizSets.find(
      (q) => q.id === quizSetId
    );

  setEditingQuiz(selectedQuiz);

  const { data, error } = await getQuizSetQuestions(quizSetId, "full");

  if (error) {
    alert("Quiz-Fragen konnten nicht geladen werden: " + error.message);
    return;
  }

  setEditingQuestions(data || []);
}

async function saveQuizEditor() {
  if (!editingQuiz?.id) {
    alert("Kein Quiz ausgewaehlt");
    return;
  }

  const { error } = await saveHostQuizEditor(
    editingQuiz.id,
    editingQuestions
  );

  if (error) {
    alert("Fragen konnten nicht gespeichert werden: " + error.message);
    return;
  }

alert("Quiz gespeichert");

await loadQuizSets();
await loadQuizEditor(editingQuiz.id);
}

  async function loadRoomData() {
    const { data, error } = await getHostedRoomData(roomCode);

    if (error) {
      console.error("Raumdaten konnten nicht geladen werden:", error);
      return;
    }

    if (!data?.room) return;

    setRoom(data.room);
    setPlayers(data.players || []);
    setLeaderboard(data.players || []);
    setActiveQuestion(data.activeQuestion);
    setBuzzes(data.buzzes || []);
  }

  async function importCsvQuiz() {
    if (!csvFile) {
      alert("Bitte CSV-Datei auswählen");
      return;
    }

    if (!quizTitle.trim()) {
      alert("Bitte Quiztitel eingeben");
      return;
    }

    const text = await csvFile.text();

    const rows = parseCSV(text);

    let uploadedImageUrl = "";
    let uploadedAudioUrl = "";

      if (imageFile) {
      uploadedImageUrl =
      (await uploadFile(
      imageFile,
      "images"
      )) || "";
      }

      if (audioFile) {
      uploadedAudioUrl =
      (await uploadFile(
      audioFile,
      "audio"
      )) || "";
      }
    
    const questions = rows.map(
  (row: any, index: number) => ({
    quiz_set_id: "",
    room_code: "",
    question_number: index + 1,

    category: row.category,
    points: Number(row.points || 100),

    question: row.question,
    solution: row.solution || "",

    image_url:
      row.image_url ||
      uploadedImageUrl ||
      "",

    audio_url:
      row.audio_url ||
      uploadedAudioUrl ||
      "",

    solution_audio_url:
      row.solution_audio_url ||
      row.solution_audio ||
      "",

    solution_image_url:
      row.solution_image_url ||
      row.solution_image ||
      "",

    is_played: false,
  })
);

    const invalidQuestions =
          questions.filter(
            (q: any) =>
            !q.category ||
            !q.points ||
            !q.question ||
            !q.solution
          );

      if (invalidQuestions.length > 0) {
        alert(
        "CSV fehlerhaft. Jede Frage benötigt: category, points, question, solution"
        );

      return;
      }

    const { error } = await importHostQuizSet(quizTitle, questions);

    if (error) {
      alert(error.message);
      return;
    }

    await loadQuizSets();

    alert("Quiz importiert");
  }

  async function hostQuiz(quizSetId: string) {
    const { data, error } = await startHostedQuiz(quizSetId);

    if (error || !data) {
      alert(error?.message || "Quiz konnte nicht gestartet werden.");
      return;
    }

    setRoomCode(data.roomCode);
    setRoom(data.room as any);

    alert(
      `Quiz gestartet. ${data.copiedQuestionCount} Fragen wurden in den Raum kopiert.`
    );
  }

  async function setGameState(state: string) {
  const { error } = await setHostedGameState(roomCode, state);

  if (error) {
    alert("Spielstatus konnte nicht geaendert werden: " + error.message);
    return;
  }

  await loadRoomData();
}

  async function setTurnPlayer(
    playerName: string
  ) {
    const { error } = await setHostedTurnPlayer(roomCode, playerName);

    if (error) {
      alert("Spieler konnte nicht gesetzt werden: " + error.message);
      return;
    }

    await loadRoomData();
  }

  async function markCorrect() {
  const { data, error } = await markHostedCorrect(roomCode);

  if (error || !data) {
    alert(error?.message || "Antwort konnte nicht als richtig gewertet werden.");
    return;
  }

  if (data.shouldFinishAfterDelay) {
    setTimeout(() => {
      finishHostedRoom(roomCode);
    }, 3500);
  }

  if (data.shouldClearFeedback) {
    setTimeout(() => {
      clearHostedFeedback(roomCode);
    }, 1500);
  }

  await loadRoomData();
}

async function processZipImport() {
  if (!zipFile) {
    alert("Bitte ZIP auswählen");
    return;
  }

  if (!quizTitle.trim()) {
    alert("Bitte Quiztitel eingeben");
    return;
  }

  const zip = await JSZip.loadAsync(zipFile);

  let csvText = "";

  const uploadedFiles: Record<string, string> = {};

  for (const fileName of Object.keys(zip.files)) {
    const file = zip.files[fileName];

    if (file.dir) continue;

    if (fileName.toLowerCase().endsWith(".csv")) {
      csvText = await file.async("text");
      continue;
    }

    const blob = await file.async("blob");

    const uploadFileObject = new File(
      [blob],
      fileName
    );

    const lowerName = fileName.toLowerCase();

    const folder =
      lowerName.endsWith(".mp3") ||
      lowerName.endsWith(".wav") ||
      lowerName.endsWith(".m4a")
        ? "audio"
        : "images";

    const publicUrl = await uploadFile(
      uploadFileObject,
      folder
    );

    if (publicUrl) {
  uploadedFiles[fileName] = publicUrl;

  const shortName =
  fileName
    .split("/")
    .pop()
    ?.split("\\")
    .pop() || fileName;

  uploadedFiles[shortName] = publicUrl;
}
  console.log("UPLOAD:", {
    fileName,
    shortName: fileName.split("/").pop(),
    publicUrl,
  });
  }

  if (!csvText) {
    alert("Keine CSV-Datei im ZIP gefunden");
    return;
  }

  const rows = parseCSV(csvText);

  const questions = rows.map(
    (row: any, index: number) => ({
      quiz_set_id: "",
      room_code: "",
      question_number: index + 1,

      category: row.category,
      points: Number(row.points || 100),

      question: row.question,
      solution: row.solution || "",

      image_url:
        uploadedFiles[row.image?.trim()] ||
        row.image_url ||
        "",

      audio_url:
        uploadedFiles[row.audio?.trim()] ||
        row.audio_url ||
        "",
      
      solution_audio_url:
        uploadedFiles[
          row.solution_audio?.trim()
        ] || "",

      solution_image_url:
        uploadedFiles[
          row.solution_image?.trim()
        ] || "",

      is_played: false,
    })
  );

  const invalidQuestions = questions.filter(
    (q: any) =>
      !q.category ||
      !q.points ||
      !q.question ||
      !q.solution
  );

  if (invalidQuestions.length > 0) {
    alert(
      "ZIP/CSV fehlerhaft. Jede Frage benötigt: category, points, question, solution"
    );
    return;
  }

  const { error } = await importHostQuizSet(quizTitle, questions);

  if (error) {
    alert(error.message);
    return;
  }

  await loadQuizSets();

  alert("ZIP Quiz importiert");
}
  

  async function markWrong() {
  const { data, error } = await markHostedWrong(roomCode);

  if (error || !data) {
    alert(error?.message || "Antwort konnte nicht als falsch gewertet werden.");
    return;
  }

  if (data.shouldClearFeedback) {
    setTimeout(() => {
      clearHostedFeedback(roomCode);
    }, 1500);
  }

  await loadRoomData();
}

  async function showSolution() {
  const { data, error } = await showHostedSolution(roomCode);

  if (error || !data) {
    alert(error?.message || "Loesung konnte nicht angezeigt werden.");
    return;
  }

  if (data.shouldFinishAfterDelay) {
    setTimeout(() => {
      finishHostedRoom(roomCode);
    }, 3500);
  }

  await loadRoomData();
}

async function uploadFile(
  file: File,
  folder: string
) {
  const uploadType =
    folder === "audio" ? "host-audio" : "host-image";
  const { data, error } = await uploadAdminMedia(file, uploadType);

  if (error) {
    console.log(error);

    alert(
      JSON.stringify(error, null, 2)
    );
    return null;
  }

  return data?.publicUrl || null;
}

async function resetGame() {
  if (!roomCode) return;

  const confirmReset = confirm(
    "Spiel wirklich zurücksetzen?"
  );

  if (!confirmReset) return;

  const codeToReset = roomCode;

  const { error } = await resetHostedRoom(codeToReset);

  if (error) {
    alert("Spiel konnte nicht zurÃ¼ckgesetzt werden: " + error.message);
    return;
  }

  setRoomCode("");
  setRoom(null);
  setPlayers([]);
  setLeaderboard([]);
  setBuzzes([]);
  setActiveQuestion(null);
  setLoadedQuestions([]);

  alert("Spiel zurückgesetzt");
}

return (
  <AdminLayout
    title="Baud_iful Quiz"
    subtitle="Board-konforme Quiz-Sets starten und Spielräume erzeugen."
  >
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.6fr]">
      <div className="space-y-6">

        {roomCode && (
          <div className="quiz-panel rounded-3xl p-6 space-y-6">
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => setGameState("lobby")}
                className={`rounded-xl p-3 ${
                  room?.game_state === "lobby"
                    ? "bg-white text-black font-bold"
                    : "bg-slate-800"
                }`}
              >
                Lobby
              </button>

              <button
                onClick={async () => {
                  const { error } = await openHostedBoard(roomCode);

                  if (error) {
                    alert("Quizwand konnte nicht geÃ¶ffnet werden: " + error.message);
                    return;
                  }

                  await loadRoomData();
                }}
                className={`rounded-xl p-3 ${
                  room?.game_state === "board"
                    ? "bg-white text-black font-bold"
                    : "bg-slate-800"
                }`}
              >
                Quizwand
              </button>

              <button
                onClick={showSolution}
                className={`rounded-xl p-3 ${
                  room?.game_state === "solution"
                    ? "bg-white text-black font-bold"
                    : "bg-slate-800"
                }`}
              >
                Lösung
              </button>

              <button
                onClick={() => setGameState("finished")}
                className={`rounded-xl p-3 ${
                  room?.game_state === "finished"
                    ? "bg-cyan-500 text-black font-bold"
                    : "bg-slate-800"
                }`}
              >
                Ende
              </button>

              <button
              onClick={resetGame}
              className="w-full bg-red-700 rounded-2xl p-4 text-xl font-black"
            >
              Spiel zurücksetzen
            </button>
            </div>

            

            <div className="bg-slate-800 rounded-2xl p-4 space-y-2">
              <p className="text-sm text-slate-400">
                Aktive Frage
              </p>

              <p className="text-2xl font-bold">
                {activeQuestion?.question || "Keine aktive Frage"}
              </p>

              <p className="text-sm text-slate-400">
                {activeQuestion?.category} | {activeQuestion?.points} Punkte
              </p>

              {activeQuestion?.solution && (
                <div className="rounded-xl border border-green-500/40 bg-slate-900/80 p-3">
                  <p className="text-sm text-slate-400">
                    Lösung
                  </p>

                  <p className="text-lg font-black text-green-400">
                    {activeQuestion.solution}
                  </p>
                </div>
              )}

              {activeQuestion?.accepted_answers && (
                <div className="rounded-xl border border-cyan-400/40 bg-slate-900/80 p-3">
                  <p className="text-sm text-white/50">
                    Alternative Antworten
                  </p>

                  <p className="text-white">
                    {activeQuestion.accepted_answers}
                  </p>
                </div>
              )}

              {activeQuestion?.host_notes && (
                <div className="rounded-xl border border-purple-400/40 bg-slate-900/80 p-3">
                  <p className="text-sm text-white/50">
                    Moderator Notizen
                  </p>

                  <p className="text-white">
                    {activeQuestion.host_notes}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={markCorrect}
                className="bg-green-600 rounded-2xl p-6 text-2xl font-black"
              >
                Richtig
              </button>

              <button
                onClick={markWrong}
                className="bg-red-600 rounded-2xl p-6 text-2xl font-black"
              >
                Falsch
              </button>

              <button
                onClick={async () => {
                const { error } = await startHostedTimer(roomCode);

                if (error) {
                  alert("Timer konnte nicht gestartet werden: " + error.message);
                  return;
                }

                await loadRoomData();
                }}
                className="bg-orange-500 rounded-2xl p-6 text-2xl font-black"
              >
                30s Timer
              </button>
            </div>

            

            <div className="bg-slate-800 rounded-2xl p-4">
              <p className="text-xl font-bold mb-4">
                Buzz-Reihenfolge
              </p>

              {buzzes.length === 0 && (
                <p className="text-slate-400">
                  Noch keine Buzzes
                </p>
              )}

              <div className="space-y-2">
                {buzzes.map((buzz: any, index) => (
                  <button
                    key={buzz.id || buzz.tempId}
                    onClick={async () => {
                      const { error } = await assignHostedBuzzAnswer(
                        roomCode,
                        buzz.player_name
                      );

                      if (error) {
                        alert(
                          "Antwortrecht konnte nicht gesetzt werden: " +
                            error.message
                        );
                        return;
                      }

                      await loadRoomData();
                    }}
                    className="w-full bg-slate-900 rounded-xl p-3 flex justify-between"
                  >
                    <span>
                      {index + 1}. {buzz.player_name}
                    </span>

                    <span>
                      Antwortrecht geben
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xl font-bold">
                Spieler am Zug
              </p>

              {players.map((player: any) => (
                <button
                  key={player.id || player.tempId}
                  onClick={() => setTurnPlayer(player.player_name)}
                  className={`w-full rounded-xl p-4 text-left ${
                    room?.turn_player === player.player_name
                      ? "bg-white text-black"
                      : "bg-slate-800"
                  }`}
                >
                  {player.player_name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="quiz-panel rounded-3xl p-6 space-y-4">
          <p className="text-sm uppercase tracking-widest text-slate-400">
            Raumcode
          </p>

          <p className="text-5xl font-black tracking-widest">
            {roomCode || "-"}
          </p>

          {roomCode && (
            <div className="bg-white p-4 rounded-3xl w-fit mx-auto">
              <QRCode
                value={`${window.location.origin}/join?room=${roomCode}`}
                size={180}
              />
            </div>
          )}

          <p className="text-sm text-slate-400">
            Status: {room?.game_state || "-"}
          </p>
        </div>

        <div className="quiz-panel rounded-3xl p-6 space-y-4">
          <p className="text-2xl font-bold">
            Rangliste
          </p>

          {leaderboard.map((player: any, index) => (
            <div
              key={player.id || player.tempId}
              className="flex justify-between bg-slate-800 rounded-xl p-3"
            >
              <span>
                {index + 1}. {player.player_name}
              </span>

              <span className="font-bold">
                {player.score}
              </span>
            </div>
          ))}
        </div>

        <div className="quiz-panel rounded-3xl p-6 space-y-4">
          <p className="text-2xl font-bold">
            Neues Spiel
          </p>

          <button
            onClick={() => setShowQuizList(!showQuizList)}
            className="w-full bg-green-600 rounded-xl p-4 font-bold"
          >
            Neues Spiel hosten
          </button>

          {showQuizList &&
savedQuizSets.map((quiz: any) => (
  <div
    key={quiz.id || quiz.tempId}
    className="bg-slate-800 rounded-2xl p-4 flex justify-between items-start gap-3"
  >
    <div className="space-y-2">
      <p className="font-bold">{quiz.title}</p>

      <p className="text-sm text-slate-400">
        {quiz.question_count || 0} Fragen
      </p>

      <div
        className={
          quiz.validation?.isBoardValid
            ? "inline-block rounded-lg border border-green-400 bg-green-950 px-3 py-1 text-sm font-bold text-green-300"
            : "inline-block rounded-lg border border-yellow-400 bg-yellow-950 px-3 py-1 text-sm font-bold text-yellow-300"
        }
      >
        {quiz.validation?.isBoardValid
          ? "Board-konform"
          : "Nicht board-konform"}
      </div>

      {!quiz.validation?.isBoardValid &&
        quiz.validation?.warnings?.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-yellow-300">
            {quiz.validation.warnings.map((warning: string) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
    </div>

    <div className="flex gap-2">
      <button
        onClick={() => hostQuiz(quiz.id)}
        disabled={!quiz.validation?.isBoardValid}
        className={
          quiz.validation?.isBoardValid
            ? "bg-green-600 rounded-xl px-4 py-2 font-bold"
            : "bg-slate-600 text-slate-300 rounded-xl px-4 py-2 font-bold cursor-not-allowed"
        }
      >
        Hosten
      </button>

      <button
        onClick={() => loadQuizEditor(quiz.id)}
        className="bg-cyan-500 text-black rounded-xl px-4 py-2 font-bold"
      >
        Bearbeiten
      </button>
    </div>
  </div>
))}
</div>

        {editingQuiz && (
          <div className="quiz-panel rounded-3xl p-6 space-y-4">

            <p className="text-3xl font-black">
              {editingQuiz.title}
            </p>

            <button
              onClick={saveQuizEditor}
              className="bg-green-600 rounded-2xl px-6 py-4 font-black"
            >
              Änderungen speichern
            </button>

            <button
              onClick={() => {
                setEditingQuiz(null);
                setEditingQuestions([]);
              }}
              className="bg-slate-700 rounded-2xl px-6 py-4 font-black"
            >
              Editor schliessen
            </button>
          
              {editingQuestions.map(
              (question: any, index) => (
            <div
              key={question.id || question.tempId}
              className="bg-slate-800 rounded-2xl p-4 space-y-3"
            >

            <input
              value={question.category}
              onChange={(e) => {
                const updated =
                  [...editingQuestions];

                  updated[index].category =
                  e.target.value;

                setEditingQuestions(updated);
              }}
              className="w-full rounded-xl bg-slate-700 p-3"
            />

            <input
              value={question.points}
              onChange={(e) => {
                const updated =
                  [...editingQuestions];

                  updated[index].points =
                  e.target.value;

                setEditingQuestions(updated);
              }}
              className="w-full rounded-xl bg-slate-700 p-3"
            />

            <textarea
              value={question.question}
              onChange={(e) => {
                const updated =
                  [...editingQuestions];

                  updated[index].question =
                  e.target.value;

                setEditingQuestions(updated);
              }}
              className="w-full rounded-xl bg-slate-700 p-3 min-h-[120px]"
            />

            <input
              value={question.solution}
              onChange={(e) => {
                const updated =
                  [...editingQuestions];

                  updated[index].solution =
                  e.target.value;

                setEditingQuestions(updated);
              }}
              className="w-full rounded-xl bg-slate-700 p-3"
            />

            <textarea
              value={
                question.accepted_answers || ""
              }
              onChange={(e) => {
              const updated =
              [...editingQuestions];

              updated[index]
              .accepted_answers =
              e.target.value;

              setEditingQuestions(updated);
              }}
              placeholder="Alternative Antworten"
              className="w-full rounded-xl bg-slate-700 p-3 min-h-[80px]"
            />

            <textarea
              value={
                question.host_notes || ""
              }
              onChange={(e) => {
                const updated =
                [...editingQuestions];

                updated[index]
                .host_notes =
                e.target.value;

                setEditingQuestions(updated);
              }}
              placeholder="Moderator Notizen"
              className="w-full rounded-xl bg-slate-700 p-3 min-h-[120px]"
            />

            <button
              type="button"
              onClick={async () => {
                const confirmDelete = confirm(
                  "Diese Frage wirklich loeschen?"
                );

                if (!confirmDelete) return;

                const { error } = await deleteHostEditorQuestion(
                  question.id
                    ? { id: question.id }
                    : {
                        quizSetId: editingQuiz.id,
                        questionNumber: question.question_number,
                      }
                );

                if (error) {
                  alert("Loeschen fehlgeschlagen: " + error.message);
                  console.error(error);
                  return;
                }

                setEditingQuestions((prev) =>
                  prev.filter(
                    (q: any) =>
                      (q.id || q.tempId) !==
                      (question.id || question.tempId)
                  )
                );

                alert("Frage geloescht");
              }}
              className="bg-red-600 rounded-xl px-4 py-2 font-bold"
            >
              Frage entfernen
            </button>
          </div>
        )
    )}
            <button
              onClick={() => {
                setEditingQuestions([
                  ...editingQuestions,

                  {
                    tempId: crypto.randomUUID(),
                    category: "",
                    points: 100,
                    question: "",
                    solution: "",
                    image_url: "",
                    audio_url: "",
                    isNew: true,
                  },
                ]);
              }}
              className="bg-blue-600 rounded-2xl px-6 py-4 font-black"
            >
              Neue Frage hinzufügen
            </button>
          </div>
        )}

        <div className="quiz-panel rounded-3xl p-6 space-y-4">
          <p className="text-2xl font-bold">
            CSV Import
          </p>

          <input
            className="w-full rounded-xl bg-slate-800 p-4"
            placeholder="Quiz Titel"
            value={quizTitle}
            onChange={(e) => setQuizTitle(e.target.value)}
          />

          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              const file = e.target.files?.[0];

              if (file) {
                setCsvFile(file);
              }
            }}
            className="w-full rounded-xl bg-slate-800 p-4"
          />

          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file =
              e.target.files?.[0];

              if (file) {
              setImageFile(file);
              }
            }}
            className="w-full rounded-xl bg-slate-800 p-4"
          />

          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const file =
              e.target.files?.[0];

              if (file) {
              setAudioFile(file);
              }
            }}
            className="w-full rounded-xl bg-slate-800 p-4"
          />

          <input
            type="file"
            accept=".zip"
            onChange={(e) => {
              const file =
              e.target.files?.[0];

              if (file) {
              setZipFile(file);
              }
            }}
            className="w-full rounded-xl bg-slate-800 p-4"
          />

          <button
            onClick={importCsvQuiz}
            className="w-full bg-blue-600 rounded-xl p-4 font-bold"
          >
            CSV importieren
          </button>

          <button
            onClick={processZipImport}
            className="w-full bg-purple-600 rounded-xl p-4 font-bold"
          >
            ZIP Quiz importieren
          </button>

          <a
            href="/quiz_template.csv"
            download
            className="w-full block text-center bg-slate-700 rounded-xl px-6 py-4 font-semibold"
          >
            CSV Vorlage herunterladen
          </a>
        </div>
      </div>
    </div>
</AdminLayout>
);
}

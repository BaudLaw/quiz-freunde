"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { supabase } from "@/lib/supabase";
import JSZip from "jszip";

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
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

  const [hostPassword, setHostPassword] =
  useState("");

  const [hostUnlocked, setHostUnlocked] =
  useState(false);

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
    const { data } = await supabase
      .from("quiz_sets")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

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

  const { data } = await supabase
    .from("questions")
    .select("*")
    .eq("quiz_set_id", quizSetId)
    .order("question_number", {
      ascending: true,
    });

  setEditingQuestions(data || []);
}

async function saveQuizEditor() {
  if (!editingQuiz?.id) {
    alert("Kein Quiz ausgewählt");
    return;
  }

  const { error: deleteError } = await supabase
    .from("questions")
    .delete()
    .eq("quiz_set_id", editingQuiz.id);

  if (deleteError) {
    alert(
      "Alte Fragen konnten nicht gelöscht werden: " +
        deleteError.message
    );
    return;
  }

  const questionsToInsert = editingQuestions.map(
    (question: any, index: number) => ({
      quiz_set_id: editingQuiz.id,
      room_code: "",
      question_number: index + 1,

      category: question.category,
      points: Number(question.points || 100),

      question: question.question,
      solution: question.solution,

      image_url: question.image_url || "",
      audio_url: question.audio_url || "",

      accepted_answers:
        question.accepted_answers || "",

      host_notes:
        question.host_notes || "",

      is_played: false,
    })
  );

  const { error: insertError } = await supabase
    .from("questions")
    .insert(questionsToInsert);

  if (insertError) {
    alert(
      "Fragen konnten nicht gespeichert werden: " +
        insertError.message
    );
    return;
  }

  alert("Quiz gespeichert");

  await loadQuizEditor(editingQuiz.id);
}

  async function loadRoomData() {
    const { data: roomData } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", roomCode)
      .single();

    if (!roomData) return;

    setRoom(roomData);

    const { data: playerData } = await supabase
      .from("players")
      .select("*")
      .eq("room_code", roomCode)
      .order("score", {
        ascending: false,
      });

    setPlayers(playerData || []);
    setLeaderboard(playerData || []);

    const { data: questionData } = await supabase
      .from("questions")
      .select("*")
      .eq(
        "question_number",
        roomData.current_question
      )
      .eq("room_code", roomCode)
      .single();

    setActiveQuestion(questionData);
    
    const { data: buzzData } = await supabase
  .from("buzzes")
  .select("*")
  .eq("room_code", roomCode)
  .eq(
    "question_number",
    roomData.current_question
  )
  .eq("is_blocked", false)
  .order("created_at", {
    ascending: true,
  });

setBuzzes(buzzData || []);
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

    const zipQuizSetResponse = await supabase
  .from("quiz_sets")
  .insert([
    {
      title: quizTitle,
    },
  ])
  .select()
  .single();

if (zipQuizSetResponse.error) {
  alert(zipQuizSetResponse.error.message);
  return;
}

if (!zipQuizSetResponse.data) {
  alert("Quizset konnte nicht erstellt werden");
  return;
}

const zipQuizSetId = zipQuizSetResponse.data.id;

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
    quiz_set_id: zipQuizSetId,
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

    const { error: insertError } =
      await supabase
        .from("questions")
        .insert(questions);

    if (insertError) {
      alert(insertError.message);
      return;
    }

    await loadQuizSets();

    alert("Quiz importiert");
  }

  async function hostQuiz(quizSetId: string) {
    const newRoomCode = generateCode();

    const selectedQuiz =
      savedQuizSets.find(
        (q) => q.id === quizSetId
      );

    const { error: roomError } =
      await supabase
        .from("rooms")
        .insert([
          {
            code: newRoomCode,
            title:
              selectedQuiz?.title ||
              "Baud_iful Quizz",

            current_question: 1,

            game_state: "lobby",

            turn_player: "",
            active_player: "",

            buzz_locked: false,

            feedback: "",
          },
        ]);

    if (roomError) {
      alert(roomError.message);
      return;
    }

    const { data: questionsData } =
      await supabase
        .from("questions")
        .select("*")
        .eq("quiz_set_id", quizSetId)
        .order("question_number", {
          ascending: true,
        });

    const copiedQuestions =
  questionsData?.map((q: any) => ({
    room_code: newRoomCode,

    quiz_set_id: null,

    question_number:
      q.question_number,

    category: q.category,
    points: q.points,

    question: q.question,

    solution: q.solution,

    accepted_answers:
      q.accepted_answers,

    host_notes:
      q.host_notes,

    image_url: q.image_url,
    audio_url: q.audio_url,

    is_played: false,
  })) || [];
    const { error: questionError } =
      await supabase
        .from("questions")
        .insert(copiedQuestions); 

    if (questionError) {
      alert(questionError.message);
      return;
    }

    setRoomCode(newRoomCode);

const { data: newRoomData } = await supabase
  .from("rooms")
  .select("*")
  .eq("code", newRoomCode)
  .single();

setRoom(newRoomData);

alert("Quiz gestartet");
  }

  async function setGameState(state: string) {
  await supabase
    .from("rooms")
    .update({
      game_state: state,
    })
    .eq("code", roomCode);

  setRoom((prev: any) =>
    prev ? { ...prev, game_state: state } : prev
  );

  await loadRoomData();
}

  async function setTurnPlayer(
    playerName: string
  ) {
    await supabase
      .from("rooms")
      .update({
        turn_player: playerName,
      })
      .eq("code", roomCode);
  }

  async function markCorrect() {
  const answeringPlayer =
    room?.active_player || room?.turn_player;

  if (!answeringPlayer) {
    alert("Kein Spieler ausgewählt");
    return;
  }

  const { data: playerData } =
    await supabase
      .from("players")
      .select("*")
      .eq("room_code", roomCode)
      .eq("player_name", answeringPlayer)
      .single();

  if (playerData && activeQuestion) {
    await supabase
      .from("players")
      .update({
        score:
          Number(playerData.score) +
          Number(activeQuestion.points || 0),
      })
      .eq("id", playerData.id);
  }

  const currentIndex =
    room?.turn_index || 0;

  const nextIndex =
    players.length > 0
      ? (currentIndex + 1) % players.length
      : 0;

  const nextPlayer =
    players[nextIndex];

  await supabase
    .from("rooms")
    .update({
      game_state: "solution",
      feedback: "correct",
      timer_end: 0,
      active_player: "",
      buzz_locked: true,
      turn_index: nextIndex,
      turn_player: nextPlayer?.player_name || "",
    })
    .eq("code", roomCode);

  const { data: remainingQuestions } =
    await supabase
      .from("questions")
      .select("*")
      .eq("room_code", roomCode)
      .eq("is_played", false);

  if (
    remainingQuestions &&
    remainingQuestions.length === 0
  ) {
    setTimeout(async () => {
      await supabase
        .from("rooms")
        .update({
          game_state: "finished",
          timer_end: 0,
        })
        .eq("code", roomCode);
    }, 3500);
  }

  setTimeout(async () => {
    await supabase
      .from("rooms")
      .update({
        feedback: "",
      })
      .eq("code", roomCode);
  }, 1500);

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

  const quizSetResponse = await supabase
    .from("quiz_sets")
    .insert([
      {
        title: quizTitle,
      },
    ])
    .select()
    .single();

  if (quizSetResponse.error) {
    alert(quizSetResponse.error.message);
    return;
  }

  if (!quizSetResponse.data) {
    alert("Quizset konnte nicht erstellt werden");
    return;
  }

  const quizSetId = quizSetResponse.data.id;

  const questions = rows.map(
    (row: any, index: number) => ({
      quiz_set_id: quizSetId,
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

  const { error: insertError } = await supabase
    .from("questions")
    .insert(questions);

  if (insertError) {
    alert(insertError.message);
    return;
  }

  await loadQuizSets();

  alert("ZIP Quiz importiert");
}
  

  async function markWrong() {
  const { data: roomData } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", roomCode)
    .single();

  if (roomData?.active_player) {
    const { data: playerData } =
      await supabase
        .from("players")
        .select("*")
        .eq("room_code", roomCode)
        .eq(
          "player_name",
          roomData.active_player
        )
        .single();

    const { data: questionData } =
  await supabase
    .from("questions")
    .select("*")
    .eq("room_code", roomCode)
    .eq(
      "question_number",
      roomData.current_question
    )
    .single();

      if (playerData && questionData) {
        await supabase
          .from("players")
          .update({
            score:
              Number(playerData.score) -
              Math.floor(
                Number(questionData.points || 0) / 2
              ),
          })
          .eq("id", playerData.id);
      }
    await supabase
  .from("buzzes")
  .delete()
  .eq("room_code", roomCode)
  .eq("question_number", roomData.current_question)
  .eq("player_name", roomData.active_player);

await supabase
  .from("buzzes")
  .insert([
    {
      room_code: roomCode,
      question_number: roomData.current_question,
      player_name: roomData.active_player,
      is_blocked: true,
    },
  ]);
  }

  await supabase
    .from("rooms")
    .update({
      game_state: "buzzing_open",
      active_player: "",
      buzz_locked: false,
      feedback: "wrong",
      timer_end: 0,
    })
    .eq("code", roomCode);

  setTimeout(async () => {
    await supabase
      .from("rooms")
      .update({
        feedback: "",
      })
      .eq("code", roomCode);
  }, 1500);

  await loadRoomData();
}

async function uploadFile(
  file: File,
  folder: string
) {
  const originalName =
    file.name
      .split("/")
      .pop()
      ?.split("\\")
      .pop() || "file";

  const safeName =
    originalName
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .toLowerCase();

  const storagePath =
    `${folder}/${Date.now()}-${safeName}`;

  const { error } = await supabase
    .storage
    .from("quiz-media")
    .upload(
      storagePath,
      file,
      {
        contentType:
          file.type || "application/octet-stream",
      }
    );

  if (error) {
    console.log(error);

    alert(
      JSON.stringify(error, null, 2)
    );
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase
    .storage
    .from("quiz-media")
    .getPublicUrl(storagePath);

  return publicUrl;
}

async function resetGame() {
  if (!roomCode) return;

  const confirmReset = confirm(
    "Spiel wirklich zurücksetzen?"
  );

  if (!confirmReset) return;

  const codeToReset = roomCode;

  await supabase
    .from("buzzes")
    .delete()
    .eq("room_code", codeToReset);

  await supabase
    .from("players")
    .delete()
    .eq("room_code", codeToReset);

  await supabase
    .from("questions")
    .delete()
    .eq("room_code", codeToReset);

  await supabase
    .from("rooms")
    .delete()
    .eq("code", codeToReset);

  setRoomCode("");
  setRoom(null);
  setPlayers([]);
  setLeaderboard([]);
  setBuzzes([]);
  setActiveQuestion(null);
  setLoadedQuestions([]);

  alert("Spiel zurückgesetzt");
}

if (!hostUnlocked) {
  return (
    <main className="min-h-screen bg-[#020617] text-white p-8 flex items-center justify-center">
      <div className="quiz-panel rounded-3xl p-8 w-full max-w-md space-y-6">
        <h1 className="text-4xl font-black text-center">
          Host Login
        </h1>

        <input
          type="password"
          value={hostPassword}
          onChange={(e) =>
            setHostPassword(e.target.value)
          }
          placeholder="Host Passwort"
          className="w-full rounded-xl bg-slate-900 border border-cyan-400/30 p-4"
        />

        <button
          onClick={() => {
            if (
              hostPassword ===
              process.env.NEXT_PUBLIC_HOST_PASSWORD
            ) {
              setHostUnlocked(true);
            } else {
              alert("Falsches Passwort");
            }
          }}
          className="w-full bg-cyan-500 text-black rounded-xl p-4 font-black quiz-button quiz-glow"
        >
          Entsperren
        </button>
      </div>
    </main>
  );
}

  return (
  <main className="min-h-screen bg-[#020617] text-white p-8">
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.6fr]">

      <div className="space-y-6">
        <h1 className="text-5xl font-black">
          Baud_iful Quizz Host
        </h1>

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
                  const firstPlayer = players[0];

                  await supabase
                    .from("rooms")
                    .update({
                      game_state: "board",
                      turn_player:
                        room?.turn_player ||
                        firstPlayer?.player_name ||
                        "",
                    })
                    .eq("code", roomCode);

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
                onClick={async () => {
                  const { data: roomData } = await supabase
                    .from("rooms")
                    .select("*")
                    .eq("code", roomCode)
                    .single();

                  const currentIndex = roomData?.turn_index || 0;

                  const nextIndex =
                    players.length > 0
                      ? (currentIndex + 1) % players.length
                      : 0;

                  const nextPlayer = players[nextIndex];

                  await supabase
                    .from("rooms")
                    .update({
                      game_state: "solution",
                      timer_end: 0,
                      turn_index: nextIndex,
                      turn_player: nextPlayer?.player_name || "",
                      active_player: "",
                      buzz_locked: true,
                      feedback: "",
                    })
                    .eq("code", roomCode);

                  const { data: remainingQuestions } = await supabase
                    .from("questions")
                    .select("*")
                    .eq("room_code", roomCode)
                    .eq("is_played", false);

                  if (
                    remainingQuestions &&
                    remainingQuestions.length === 0
                  ) {
                    setTimeout(async () => {
                      await supabase
                        .from("rooms")
                        .update({
                          game_state: "finished",
                          timer_end: 0,
                        })
                        .eq("code", roomCode);
                    }, 3500);
                  }

                  await loadRoomData();
                }}
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
                  <p className="text-sm text-slate-400">
                    Alternative Antworten
                  </p>

                  <p className="text-cyan-300">
                    {activeQuestion.accepted_answers}
                  </p>
                </div>
              )}

              {activeQuestion?.host_notes && (
                <div className="rounded-xl border border-purple-400/40 bg-slate-900/80 p-3">
                  <p className="text-sm text-slate-400">
                    Moderator Notizen
                  </p>

                  <p className="text-purple-300">
                    {activeQuestion.host_notes}
                  </p>
                </div>
              )}

              {activeQuestion?.accepted_answers && (
              <div className="bg-slate-700 rounded-xl p-3">
                <p className="text-sm text-slate-400">
                  Akzeptierte Antworten
                </p>

                <p>
                  {activeQuestion.accepted_answers}
                </p>
              </div>
            )}

            {activeQuestion?.host_notes && (
              <div className="bg-slate-700 rounded-xl p-3">
                <p className="text-sm text-slate-400">
                  Moderator Notizen
                </p>

                <p>
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
                await supabase
                .from("rooms")
                .update({
                timer_end:
                Date.now() + 30000,
                })
                .eq("code", roomCode);

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
                      await supabase
                        .from("rooms")
                        .update({
                          active_player: buzz.player_name,
                          game_state: "player_answering",
                          buzz_locked: true,
                        })
                        .eq("code", roomCode);

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
                className="bg-slate-800 rounded-2xl p-4 flex justify-between items-center gap-3"
              >
                  <p>{quiz.title}</p>

                <div className="flex gap-2">
                  <button
                  onClick={() => hostQuiz(quiz.id)}
                  className="bg-green-600 rounded-xl px-4 py-2 font-bold"
                  >
                  Hosten
                  </button>

                  <button
                   onClick={() =>
                   loadQuizEditor(quiz.id)
                   }
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
                  "Diese Frage wirklich löschen?"
                );

                if (!confirmDelete) return;

                if (question.id) {
                  const { error } = await supabase
                    .from("questions")
                    .delete()
                    .eq("id", question.id);

                  if (error) {
                    alert("Löschen fehlgeschlagen: " + error.message);
                    console.error(error);
                    return;
                  }
                } else {
                  const { error } = await supabase
                    .from("questions")
                    .delete()
                    .eq("quiz_set_id", editingQuiz.id)
                    .eq("question_number", question.question_number);

                  if (error) {
                    alert("Löschen fehlgeschlagen: " + error.message);
                    console.error(error);
                    return;
                  }
                }

                setEditingQuestions((prev) =>
                  prev.filter(
                    (q: any) =>
                      (q.id || q.tempId) !==
                      (question.id || question.tempId)
                  )
                );

                alert("Frage gelöscht");
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
  </main>
);
}
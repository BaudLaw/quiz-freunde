"use client";

import {
  use,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import QRCode from "react-qr-code";


export default function DisplayPage({
  params,
}: {
  params: Promise<{ roomcode: string }>;
}) {
  const { roomcode } = use(params);
  const roomCode = roomcode;

  const [room, setRoom] = useState<any>(null);
  const [question, setQuestion] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const lastBuzzCountRef = useRef(0);
  const [flash, setFlash] = useState("");
  const lastFeedbackRef = useRef("");
  const [zoomCard, setZoomCard] = useState<any>(null);
  const [zoomedImage, setZoomedImage] = 
  useState<string | null>(null);
  const [timeLeft, setTimeLeft] =
  useState(0);
  const timerAudioRef = useRef<HTMLAudioElement | null>(null);
  const boardSelectSound =
  useRef<HTMLAudioElement | null>(null);
  const winnerSoundRef =
  useRef<HTMLAudioElement | null>(null);

  const applauseSoundRef =
  useRef<HTMLAudioElement | null>(null);
  const timerEndPlayedRef = useRef(false);
  const questionLoopRef =
  useRef<HTMLAudioElement | null>(null);
  

  useEffect(() => {
    async function loadData() {
      const { data: roomData } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", roomCode)
        .maybeSingle();

      if (!roomData) {
        setRoom(null);
        setQuestion(null);
        setLeaderboard([]);
        setAllQuestions([]);
        return;
      }

      if (
        roomData.game_state === "finished" &&
        room?.game_state !== "finished"
      ) {
        winnerSoundRef.current
          ?.play()
          .catch(() => {});

        applauseSoundRef.current
          ?.play()
          .catch(() => {});
      }

      setRoom(roomData);

      if (
  roomData.feedback &&
  roomData.feedback !== lastFeedbackRef.current
) {
  lastFeedbackRef.current = roomData.feedback;

  if (roomData.feedback === "correct") {
  setFlash("green");

  const audio = new Audio(
    "/sounds/correct.mp3"
  );

  audio.play().catch(() => {});
}

if (roomData.feedback === "wrong") {
  setFlash("red");

  const audio = new Audio(
    "/sounds/wrong.mp3"
  );

  audio.play().catch(() => {});
}

  setTimeout(() => {
    setFlash("");
  }, 20);
}

if (!roomData.feedback) {
  lastFeedbackRef.current = "";
}

      const { data: questionData } = await supabase
        .from("questions")
        .select("*")
        .eq("room_code", roomCode)
        .eq("question_number", roomData.current_question)
        .single();

      setQuestion(questionData);

      const { data: allQuestionsData } = await supabase
        .from("questions")
        .select("*")
        .eq("room_code", roomCode)
        .order("points", { ascending: true });

      setAllQuestions(allQuestionsData || []);

        const { data: playerData } = await supabase
        .from("players")
        .select("*")
        .eq("room_code", roomCode)
        .order("score", { ascending: false });

      setLeaderboard(playerData || []);

      const { data: buzzData } = await supabase
  .from("buzzes")
  .select("*")
  .eq("room_code", roomCode)
  .eq(
    "question_number",
    roomData.current_question
  )
  .eq("is_blocked", false);

const buzzCount = buzzData?.length || 0;

if (buzzCount > lastBuzzCountRef.current) {
  const audio = new Audio("/sounds/buzz.mp3");

  audio.play().catch(() => {});

  lastBuzzCountRef.current = buzzCount;
}

if (buzzCount === 0) {
  lastBuzzCountRef.current = 0;
}

    }

    loadData();

    const interval = setInterval(loadData, 1000);

    return () => clearInterval(interval);
  }, [roomCode]);

useEffect(() => {
  const interval = setInterval(() => {
    if (!room?.timer_end) {
      setTimeLeft(0);
      return;
    }

    const remaining =
      Math.max(
        0,
        Math.floor(
          (room.timer_end - Date.now()) / 1000
        )
      );

    setTimeLeft(remaining);
  }, 200);

  return () => clearInterval(interval);
}, [room]);

useEffect(() => {
  if (timeLeft > 0) {
    if (!timerAudioRef.current) {
      timerAudioRef.current = new Audio("/sounds/timer.mp3");
      timerAudioRef.current.loop = true;
      timerAudioRef.current.volume = 0.4;

      timerAudioRef.current.play();
    }
  } else {
    if (timerAudioRef.current) {
      timerAudioRef.current.pause();
      timerAudioRef.current.currentTime = 0;
      timerAudioRef.current = null;
    }
  }
}, [timeLeft]);

useEffect(() => {
  boardSelectSound.current =
    new Audio("/sounds/board_select.mp3");

  winnerSoundRef.current =
    new Audio("/sounds/winner_fanfare.mp3");

  applauseSoundRef.current =
    new Audio("/sounds/applause.mp3");

  questionLoopRef.current =
    new Audio("/sounds/question_loop.mp3");

  winnerSoundRef.current.volume = 0.8;
  applauseSoundRef.current.volume = 0.45;

  questionLoopRef.current.loop = true;
  questionLoopRef.current.volume = 0.25;
}, []);

useEffect(() => {
  const hasAudioQuestion =
    !!question?.audio_url;

  const shouldPlay =
    !hasAudioQuestion &&
    (
      room?.game_state === "question" ||
      room?.game_state === "buzzing_open" ||
      room?.game_state === "player_answering"
    );
  if (shouldPlay) {
    questionLoopRef.current
      ?.play()
      .catch(() => {});
  } else {
    if (questionLoopRef.current) {
      questionLoopRef.current.pause();
      questionLoopRef.current.currentTime = 0;
    }
  }
}, [
  room?.game_state,
  question?.audio_url,
]);

useEffect(() => {
  if (!room?.timer_end) {
    timerEndPlayedRef.current = false;
    return;
  }

  if (timeLeft > 0) {
    timerEndPlayedRef.current = false;
    return;
  }

  const timerIsFinished =
    room.timer_end > 0 &&
    Date.now() >= room.timer_end;

  if (
    timerIsFinished &&
    !timerEndPlayedRef.current
  ) {
    timerEndPlayedRef.current = true;

    const audio = new Audio(
      "/sounds/timer_end.mp3"
    );

    audio.volume = 0.8;
    audio.play().catch(() => {});
  }
}, [timeLeft, room]);

  if (!room) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        Laden...
      </main>
    );
  }

 const categories = [
  ...new Set(
    allQuestions.map(
      (q: any) => q.category
    )
  ),
].sort();

  return (
    <main className="h-screen overflow-hidden bg-[#020617] text-white p-4">
      {room?.game_state === "lobby" && (
        <div className="pointer-events-none fixed right-8 top-18 z-50 flex h-32 w-32 items-center justify-center">
          <img
            src="/logo.png"
            alt="Logo"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}

      {room?.game_state === "board" && (
        <div className="pointer-events-none fixed right-8 top-3 z-50 flex h-20 w-20 items-center justify-center">
          <img
            src="/logo.png"
            alt="Logo"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
      {timeLeft > 0 && (
  <div className="fixed right-8 top-8 z-50 flex h-36 w-36 items-center justify-center rounded-full border-4 border-cyan-300/60 quiz-glow bg-slate-950 text-6xl font-black text-cyan-300 quiz-glow shadow-2xl">
    {timeLeft}
  </div>
)}
      {zoomCard && (
  <div
    className="quiz-card-zoom fixed z-40 flex items-center justify-center bg-cyan-500 quiz-glow text-black shadow-2xl"
    style={{
      left: zoomCard.rect.left,
      top: zoomCard.rect.top,
      width: zoomCard.rect.width,
      height: zoomCard.rect.height,
    }}
  >
    <div className="text-center font-black">
      <p className="text-5xl">
        {zoomCard.category}
      </p>

      <p className="text-8xl">
        {zoomCard.points}
      </p>
    </div>
  </div>
)}
      <div className="max-w-7xl mx-auto h-full flex flex-col gap-4">
          <div className="grid grid-cols-3 items-center gap-4">
        {room.game_state !== "board" &&
        room.game_state !== "lobby" &&
        room.game_state !== "finished" ? (
          <div className="bg-slate-900 rounded-2xl p-3">
            <p className="text-sm text-slate-400">
            Kategorie
            </p>

            <p className="text-2xl font-black">
              {question?.category || "-"}
            </p>
          </div>
        ) : (
          <div />
        )}

          <div className="text-center">
            <h1 className="text-3xl font-black">
            {room.title}
            </h1>

          {room.turn_player &&
            room.game_state !== "finished" &&
            room.game_state !== "lobby" && (
              <p className="text-xl text-white font-bold">
                Am Zug: {room.turn_player}
              </p>
          )}
          </div>

          {room.game_state !== "board" &&
          room.game_state !== "lobby" &&
          room.game_state !== "finished" ? (
            <div className="bg-slate-900 rounded-2xl p-3 text-right">
              <p className="text-sm text-slate-400">
               Punkte
              </p>

              <p className="text-3xl font-black text-white">
                {question?.points || "-"}
              </p>
            </div>
          ) : (
         <div />
          )}
        </div>

        {room.game_state === "lobby" && (
          <div className="gap-4 text-center">
            <div className="bg-slate-900 rounded-3xl p-12">
              
              <p className="text-3xl text-slate-400 mt-6">
                Raumcode
              </p>

              <p className="text-8xl font-black tracking-widest mt-4">
                {roomCode}
              </p>

            <div className="mt-10 flex justify-center">
              <div className="rounded-3xl bg-white p-6">
                <QRCode
                value={`${window.location.origin}/join`}
                size={220}
                />
              </div>
            </div>

              <p className="mt-6 text-2xl text-slate-400">
              QR-Code scannen und Raumcode eingeben
              </p>
            </div>

            <div className="bg-slate-900 rounded-3xl p-4">
              <p className="text-3xl font-bold">
                Spieler verbunden: {leaderboard.length}
              </p>
            </div>
          </div>
        )}

        {room.game_state === "board" && (
          <div className="flex flex-1 flex-col gap-2 overflow-hidden">
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${Math.max(
                  categories.length,
                  1
                )}, minmax(0, 1fr))`,
              }}
            >
              {categories.map((category: any) => (
                <div
                  key={category}
                  className="h-14 bg-cyan-950 border border-cyan-400/50 rounded-xl p-2 text-center font-bold text-xl flex items-center justify-center overflow-hidden"
                >
                  {category}
                </div>
              ))}
            </div>

            <div
              className="grid flex-1 gap-2 overflow-hidden"
              style={{
              gridTemplateColumns: `repeat(${Math.max(
              categories.length,
              1
              )}, minmax(0, 1fr))`,
              }}
            >
          {categories.map((category: any) => {
            const categoryQuestions = allQuestions
            .filter((q: any) => q.category === category)
            .sort((a: any, b: any) => a.points - b.points);

            return (
            <div
            key={category}
            className="grid grid-rows-5 gap-2"
            >

          {categoryQuestions.map((q: any) => (
            <button
              key={q.id}
              onClick={async (event) => {
              if (q.is_played) return;

            const rect = event.currentTarget.getBoundingClientRect();

            if (boardSelectSound.current) {
              boardSelectSound.current.currentTime = 0;
              boardSelectSound.current.play().catch(() => {});
            } 

            setZoomCard({
              category: q.category,
              points: q.points,
              rect,
          });

              setTimeout(async () => {
              await supabase
                .from("buzzes")
                .delete()
                .eq("room_code", roomCode)
                .eq("question_number", q.question_number);

              await supabase
                .from("rooms")
                .update({
                  current_question: q.question_number,
                  game_state: "question",
                  active_player: room.turn_player || "",
                  buzz_locked: true,
                  feedback: "",
                })
                .eq("code", roomCode);

              await supabase
                .from("questions")
                .update({
                  is_played: true,
                })
                .eq("id", q.id);
              setTimeout(() => {
                setZoomCard(null);
              },1000);

              }, 1150);
          }}

            className={`min-h-0 rounded-xl p-1 text-center text-3xl font-black cursor-pointer transition flex items-center justify-center ${
              q.is_played
                ? "bg-slate-900/70 text-slate-700 border border-slate-700"
                : "bg-cyan-500 text-black hover:scale-105 quiz-button"
            }`}
          >
            {q.is_played ? " " : q.points}
          </button>
        ))}
      </div>
    );
  })}
</div>
          </div>
        )}

        {room.game_state === "question" && question && (
  <div className="flex flex-1 flex-col justify-center px-10">
    <div className="mx-auto flex min-h-[180px] w-full max-w-6xl flex-col justify-center rounded-3xl border-4 border-cyan-400/60 bg-slate-900/90 quiz-panel quiz-glow px-16 py-12 text-center text-4xl font-black leading-tight shadow-2xl quiz-panel-enter">
      <div>{question.question}</div>

      {question.image_url && (
        <div className="mt-8 flex justify-center">
          <img
            src={question.image_url}
            alt="Quizbild"
            onClick={() =>
              setZoomedImage(question.image_url)
            }
            className="cursor-zoom-in max-h-[180px] rounded-3xl border-4 border-slate-700 shadow-2xl"
          />
        </div>
      )}

      {question.audio_url && (
        <div className="mt-8 flex justify-center">
          <audio controls autoPlay className="w-full max-w-xl">
            <source src={question.audio_url} />
          </audio>
        </div>
      )}
    </div>
  </div>
)}

{room.game_state === "buzzing_open" && question && (
  <div className="flex flex-1 flex-col justify-center gap-8 px-10">
    <div className="mx-auto w-full max-w-5xl rounded-3xl bg-red-600 px-8 py-5 text-center text-5xl font-black shadow-2xl quiz-panel-enter">
      BUZZER FREI
    </div>

    <div className="mx-auto flex min-h-[180px] w-full max-w-6xl flex-col justify-center rounded-3xl border-4 border-cyan-400/60 bg-slate-900/90 quiz-panel quiz-glow px-14 py-10 text-center text-4xl font-black leading-tight shadow-2xl quiz-panel-enter">
      <div>{question.question}</div>

      {question.image_url && (
        <div className="mt-8 flex justify-center">
          <img
            src={question.image_url}
            alt="Quizbild"
            onClick={() =>
              setZoomedImage(question.image_url)
            }
            className="cursor-zoom-in max-h-[180px] rounded-3xl border-4 border-slate-700 shadow-2xl"
          />
        </div>
      )}

      {question.audio_url && (
        <div className="mt-8 flex justify-center">
          <audio controls autoPlay className="w-full max-w-xl">
            <source src={question.audio_url} />
          </audio>
        </div>
      )}
    </div>
  </div>
)}

{room.game_state === "player_answering" && question && (
  <div className="flex flex-1 flex-col justify-center gap-8 px-10">
    <div className="mx-auto w-full max-w-5xl rounded-3xl bg-yellow-500 px-8 py-5 text-center text-5xl font-black text-black shadow-2xl quiz-panel-enter">
      {room.active_player}
    </div>

    <div className="mx-auto flex min-h-[180px] w-full max-w-6xl flex-col justify-center rounded-3xl border-4 border-cyan-400/60 bg-slate-900/90 quiz-panel quiz-glow px-14 py-10 text-center text-4xl font-black leading-tight shadow-2xl quiz-panel-enter">
      <div>{question.question}</div>

      {question.image_url && (
        <div className="mt-8 flex justify-center">
          <img
            src={question.image_url}
            alt="Quizbild"
            onClick={() =>
              setZoomedImage(question.image_url)
            }
            className="cursor-zoom-in max-h-[180px] rounded-3xl border-4 border-slate-700 shadow-2xl"
          />
        </div>
      )}

      {question.audio_url && (
        <div className="mt-8 flex justify-center">
          <audio controls autoPlay className="w-full max-w-xl">
            <source src={question.audio_url} />
          </audio>
        </div>
      )}
    </div>
  </div>
)}

{room.game_state === "solution" && question && (
  <div className="flex flex-1 flex-col justify-center gap-8 px-10">
    <div className="mx-auto flex min-h-[180px] w-full max-w-6xl flex-col justify-center rounded-3xl border-4 border-cyan-400/60 bg-slate-900/90 quiz-panel quiz-glow px-14 py-8 text-center text-5xl font-black leading-tight shadow-2xl quiz-panel-enter">
      <div>{question.question}</div>

      {question.image_url && (
        <div className="mt-6 flex justify-center">
          <img
            src={question.image_url}
            alt="Quizbild"
            onClick={() =>
              setZoomedImage(question.image_url)
            }
            className="cursor-zoom-in max-h-[180px] rounded-3xl border-4 border-slate-700 shadow-2xl"
          />
        </div>
      )}
    </div>

    <div className="mx-auto flex min-h-[120px] w-full max-w-6xl items-center justify-center rounded-3xl border-4 border-cyan-400/60 bg-slate-900/90 quiz-panel quiz-glow px-12 py-6 text-center text-4xl font-black text-green-400 shadow-2xl quiz-panel-enter">
      {question.solution}
    </div>

    {question.solution_image_url && (
      <div className="mt-6 flex justify-center">
        <img
          src={question.solution_image_url}
          alt="Lösungsbild"
          onClick={() =>
            setZoomedImage(
              question.solution_image_url
            )
          }
          className="cursor-zoom-in max-h-[260px] rounded-3xl border-4 border-slate-700 shadow-2xl"
        />
      </div>
    )}

    {question.solution_audio_url && (
      <div className="mt-6 flex justify-center">
        <audio
          key={`${room.game_state}-${question.solution_audio_url}`}
          controls
          autoPlay
          className="w-full max-w-xl"
        >
          <source
            src={question.solution_audio_url}
          />
        </audio>
      </div>
    )}
  </div>
)}

        {room.game_state === "finished" && (
          <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-8 py-2 text-center">

            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-0 top-0 h-full w-1/3 bg-cyan-500/20 blur-3xl" />
              <div className="absolute right-0 top-0 h-full w-1/3 bg-purple-500/20 blur-3xl" />
              <div className="absolute left-1/3 top-1/4 h-1/2 w-1/3 bg-cyan-300/10 blur-3xl" />
            </div>

            <div className="pointer-events-none absolute inset-0 opacity-50">
              {Array.from({ length: 36 }).map((_, index) => (
                <div
                  key={index}
                  className={`absolute h-3 w-3 rotate-45 ${
                    index % 2 === 0
                      ? "bg-cyan-400"
                      : "bg-purple-400"
                  }`}
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                  }}
                />
              ))}
            </div>

            <div className="relative z-10 mb-1 text-6xl drop-shadow-[0_0_18px_rgba(34,211,238,0.75)]">
              🏆
            </div>

            <h2 className="relative z-10 mb-5 text-6xl font-black uppercase tracking-wider text-cyan-300">
              Winner
            </h2>

            <div className="relative z-10 flex w-full max-w-5xl items-end justify-center gap-4">

              {leaderboard[1] && (
                <div className="quiz-panel flex h-60 flex-1 flex-col items-center justify-center rounded-3xl border-4 border-purple-400/60 p-4 shadow-2xl">
                  <p className="text-4xl">🥈</p>
                  <p className="mt-2 text-5xl font-black text-purple-300">2</p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {leaderboard[1].score} Punkte
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-200">
                    {leaderboard[1].player_name}
                  </p>
                </div>
              )}

              {leaderboard[0] && (
                <div className="quiz-panel quiz-glow flex h-72 flex-[1.15] flex-col items-center justify-center rounded-3xl border-4 border-cyan-300 p-5 shadow-2xl">
                  <p className="text-5xl">👑</p>
                  <p className="mt-2 text-6xl font-black text-cyan-300">1</p>
                  <p className="mt-2 text-3xl font-black text-cyan-300">
                    {leaderboard[0].score} Punkte
                  </p>
                  <p className="mt-3 text-3xl font-black text-white">
                    {leaderboard[0].player_name}
                  </p>
                </div>
              )}

              {leaderboard[2] && (
                <div className="quiz-panel flex h-56 flex-1 flex-col items-center justify-center rounded-3xl border-4 border-cyan-400/40 p-4 shadow-2xl">
                  <p className="text-4xl">🥉</p>
                  <p className="mt-2 text-5xl font-black text-cyan-200">3</p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {leaderboard[2].score} Punkte
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-200">
                    {leaderboard[2].player_name}
                  </p>
                </div>
              )}

            </div>
          </div>
        )}

        <div className="quiz-panel rounded-3xl p-3">

{room.game_state !== "finished" && (
  <div
  className="mt-auto grid gap-3"
  style={{
    gridTemplateColumns: `repeat(${Math.max(
      leaderboard.length,
      1
    )}, minmax(0, 1fr))`,
  }}

>
  {leaderboard.map((player: any, index) => {
    
    return (
      <div
        key={player.id || index}
        className={`h-20 rounded-xl border px-3 py-2 text-center transition-all ${
          room?.turn_player ===
          player.player_name
            ? "bg-cyan-500 text-black border-cyan-300 quiz-glow"
            : "bg-slate-900/90 border-cyan-400/20 text-white"
        }`}
      >
        <p className="truncate text-base font-black">
          {player.player_name}
        </p>

        <p className="text-2xl font-black">
          {player.score}
        </p>
      </div>
    );
  })}
</div>
)}
</div>
      </div>
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 p-8"
        >
          <img
            src={zoomedImage}
            alt="Zoom"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </main>
  );
}

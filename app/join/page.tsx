"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Suspense } from "react";
import { useRouter } from "next/navigation";

function JoinPageContent() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [hasJoined, setHasJoined] = useState(false);

  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isBlocked, setIsBlocked] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const room = searchParams.get("room");

    if (room) {
      setRoomCode(room.toUpperCase());
    }
  }, [searchParams]);

  useEffect(() => {
    if (!hasJoined || !roomCode) return;

    loadRoomData();

    const interval = setInterval(() => {
      loadRoomData();
    }, 1000);

    return () => clearInterval(interval);
  }, [hasJoined, roomCode]);

  async function loadRoomData() {
    const { data: roomData } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", roomCode)
      .maybeSingle();

    if (!roomData) {
      setRoom(null);
      setIsBlocked(false);
      router.push("/join");
      return;
    }

setRoom(roomData);
      const { data: blockedBuzzes } = await supabase
  .from("buzzes")
  .select("*")
  .eq("room_code", roomCode)
  .eq("question_number", roomData.current_question)
  .eq("player_name", name)
  .eq("is_blocked", true)
  .limit(1);

setIsBlocked((blockedBuzzes?.length || 0) > 0);

    const { data: playerData } = await supabase
      .from("players")
      .select("*")
      .eq("room_code", roomCode)
      .order("score", { ascending: false });

    setPlayers(playerData || []);
    setLeaderboard(playerData || []);
  }

  async function joinRoom() {
    if (!name.trim()) {
      alert("Bitte Namen eingeben");
      return;
    }

    if (!roomCode.trim()) {
      alert("Bitte Raumcode eingeben");
      return;
    }

    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", roomCode)
      .single();

    if (roomError || !roomData) {
      alert("Raum nicht gefunden");
      return;
    }

    const { data: existingPlayer } = await supabase
      .from("players")
      .select("*")
      .eq("room_code", roomCode)
      .eq("player_name", name)
      .maybeSingle();

    if (existingPlayer) {
      alert("Name bereits vergeben");
      return;
    }

    const { error: insertError } = await supabase.from("players").insert([
      {
        room_code: roomCode,
        player_name: name,
        score: 0,
      },
    ]);

    if (insertError) {
      alert("Name bereits vergeben");
      return;
    }

    setRoom(roomData);
    setHasJoined(true);

    await loadRoomData();
  }

  async function buzz() {
  if (!room) return;

  if (
    room.buzz_locked ||
    room.active_player ||
    room.turn_player === name ||
    room.game_state !== "buzzing_open"
  ) {
    return;
  }

  const { data: existingBuzz } = await supabase
    .from("buzzes")
    .select("*")
    .eq("room_code", roomCode)
    .eq(
      "question_number",
      room.current_question
    )
    .eq("player_name", name)
    .maybeSingle();

  if (existingBuzz) {
    return;
  }

  await supabase
  .from("buzzes")
  .insert([
    {
      room_code: roomCode,
      question_number:
        room.current_question,
      player_name: name,
      is_blocked: false,
    },
  ]);
}

    return (
  <main className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-8">
    <div className="w-full max-w-md space-y-6">

      {!hasJoined ? (
        <>
          <h1 className="text-4xl font-bold text-center">
            Baud_iful Quizz
          </h1>

          <div className="space-y-2">
            <label className="text-sm block">
              Dein Name
            </label>

            <input
              className="w-full rounded-xl bg-slate-800 border border-slate-700 p-4"
              placeholder="Pascal"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm block font-mono tracking-[0.3em]">
              Raumcode
            </label>

            <input
              className="w-full rounded-xl bg-slate-800 border border-slate-700 p-4 uppercase"
              placeholder="ABC123"
              value={roomCode}
              onChange={(e) =>
                setRoomCode(e.target.value.toUpperCase())
              }
            />
          </div>

          <button
            onClick={joinRoom}
            className="w-full bg-white text-black rounded-xl px-6 py-4 font-semibold"
          >
            Beitreten
          </button>
        </>
      ) : (
        <>
          <div className="quiz-panel rounded-3xl p-6 text-center">
            <p className="text-sm text-slate-400">
              Spieler
            </p>

            <p className="text-4xl font-black text-cyan-300 tracking-wide">
              {name}
            </p>
          </div>

          <button
            onClick={buzz}
            disabled={
              isBlocked ||
              room?.buzz_locked ||
              room?.active_player ||
              room?.turn_player === name ||
              room?.game_state !== "buzzing_open"
            }
            className={`w-full aspect-square rounded-full text-5xl font-black font-mono tracking-[0.3em] transition ${
              isBlocked ||
              room?.buzz_locked ||
              room?.active_player ||
              room?.turn_player === name ||
              room?.game_state !== "buzzing_open"
                ? "bg-slate-900 border border-slate-700 text-slate-500 text-slate-500"
                : "bg-cyan-500 text-black quiz-button quiz-glow active:scale-95"
            }`}
          >
            BUZZ
          </button>

          <div className="bg-slate-800 rounded-3xl p-6 text-center">
            <p className="text-sm text-slate-400">
              Status
            </p>

            <p className="text-2xl font-bold">
              {room?.game_state || "Verbunden"}
            </p>
          </div>
        </>
      )}

    </div>
  </main>
);
}

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinPageContent />
    </Suspense>
  );
}
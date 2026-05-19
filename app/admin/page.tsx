"use client";

import { useEffect, useState } from "react";
import AdminButton from "@/components/AdminButton";
import AdminCard from "@/components/AdminCard";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";

type QuizSet = {
  id: string;
  title: string;
};

type Question = {
  id: string;
  quiz_set_id: string | null;
  category: string | null;
  points: number | null;
};

type AdminStats = {
  pools: number;
  activePoolQuestions: number;
  inactivePoolQuestions: number;
  quizSets: number;
  boardReadyQuizSets: number;
  incompleteQuizSets: number;
};

type BoardValidationResult = {
  isBoardReady: boolean;
};

const emptyStats: AdminStats = {
  pools: 0,
  activePoolQuestions: 0,
  inactivePoolQuestions: 0,
  quizSets: 0,
  boardReadyQuizSets: 0,
  incompleteQuizSets: 0,
};

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats>(emptyStats);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAdminStats();
  }, []);

  async function loadAdminStats() {
    setIsLoading(true);

    const [
      poolsResult,
      activePoolQuestionsResult,
      inactivePoolQuestionsResult,
      quizSetsResult,
      questionsResult,
    ] = await Promise.all([
      supabase.from("question_pools").select("id"),
      supabase.from("pool_questions").select("id").eq("is_active", true),
      supabase.from("pool_questions").select("id").eq("is_active", false),
      supabase.from("quiz_sets").select("id, title"),
      supabase.from("questions").select("id, quiz_set_id, category, points"),
    ]);

    const quizSets = (quizSetsResult.data || []) as QuizSet[];
    const questions = (questionsResult.data || []) as Question[];

    let boardReadyQuizSets = 0;
    let incompleteQuizSets = 0;

    for (const quizSet of quizSets) {
      const quizSetQuestions = questions.filter(
        (question) => question.quiz_set_id === quizSet.id
      );

      const validation = validateBoardQuestions(quizSetQuestions);

      if (validation.isBoardReady) {
        boardReadyQuizSets += 1;
      } else {
        incompleteQuizSets += 1;
      }
    }

    setStats({
      pools: poolsResult.data?.length || 0,
      activePoolQuestions: activePoolQuestionsResult.data?.length || 0,
      inactivePoolQuestions: inactivePoolQuestionsResult.data?.length || 0,
      quizSets: quizSets.length,
      boardReadyQuizSets,
      incompleteQuizSets,
    });

    setIsLoading(false);
  }

  return (
    <AdminLayout
      title="Admin-Dashboard"
      subtitle="Zentrale Verwaltung für Fragenpools, Generator, Quiz-Sets und Host-Bereich."
    >
      <AdminCard title="Schnellstatistiken">
        {isLoading ? (
          <p style={{ margin: 0, color: "#cbd5e1" }}>Statistiken werden geladen.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <StatCard label="Pools" value={stats.pools} />
            <StatCard
              label="Aktive Pool-Fragen"
              value={stats.activePoolQuestions}
            />
            <StatCard
              label="Inaktive Pool-Fragen"
              value={stats.inactivePoolQuestions}
            />
            <StatCard label="Quiz-Sets" value={stats.quizSets} />
            <StatCard
              label="Board-konforme Quiz-Sets"
              value={stats.boardReadyQuizSets}
            />
            <StatCard
              label="Nicht vollständige Quiz-Sets"
              value={stats.incompleteQuizSets}
            />
          </div>
        )}
      </AdminCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        <AdminCard
          title="Fragenpools"
          description="Pools verwalten, Fragen erfassen, Medien hochladen und CSV-Dateien importieren."
        >
          <AdminButton href="/pools" variant="primary">
            Pools öffnen
          </AdminButton>
        </AdminCard>

        <AdminCard
          title="Generator"
          description="Aus aktiven Pool-Fragen board-konforme Quiz-Sets erstellen."
        >
          <AdminButton href="/generator" variant="primary">
            Generator öffnen
          </AdminButton>
        </AdminCard>

        <AdminCard
          title="Quiz-Sets"
          description="Fertige Quiz-Sets prüfen, reparieren, duplizieren, umbenennen oder löschen."
        >
          <AdminButton href="/quiz-sets" variant="primary">
            Quiz-Sets öffnen
          </AdminButton>
        </AdminCard>

        <AdminCard
          title="Host"
          description="Board-konforme Quiz-Sets starten und den Spielraum erzeugen."
        >
          <AdminButton href="/host" variant="primary">
            Host öffnen
          </AdminButton>
        </AdminCard>
      </div>
    </AdminLayout>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: 16,
        borderRadius: 14,
        border: "1px solid rgba(148, 163, 184, 0.22)",
        background: "rgba(2, 6, 23, 0.45)",
      }}
    >
      <strong
        style={{
          color: "#ffffff",
          fontSize: 28,
          lineHeight: 1,
        }}
      >
        {value}
      </strong>
      <span
        style={{
          color: "#cbd5e1",
          fontSize: 13,
          lineHeight: 1.35,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function validateBoardQuestions(questions: Question[]): BoardValidationResult {
  if (questions.length === 0) {
    return { isBoardReady: false };
  }

  const categories = Array.from(
    new Set(
      questions
        .map((question) => question.category)
        .filter((category): category is string => Boolean(category))
    )
  );

  if (categories.length === 0 || categories.length > 6) {
    return { isBoardReady: false };
  }

  for (const category of categories) {
    const categoryQuestions = questions.filter(
      (question) => question.category === category
    );

    if (categoryQuestions.length !== 5) {
      return { isBoardReady: false };
    }

    const points = categoryQuestions.map((question) => question.points);
    const uniquePoints = new Set(points);

    if (uniquePoints.size !== points.length) {
      return { isBoardReady: false };
    }

    for (const requiredPoints of [100, 200, 300, 400, 500]) {
      if (!uniquePoints.has(requiredPoints)) {
        return { isBoardReady: false };
      }
    }
  }

  return { isBoardReady: true };
}
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type DashboardStats = {
  pools: number;
  activePoolQuestions: number;
  inactivePoolQuestions: number;
  quizSets: number;
  boardReadyQuizSets: number;
  incompleteQuizSets: number;
};

type QuizSetQuestion = {
  quiz_set_id: string | null;
  category: string | null;
  points: number | null;
};

function validateBoardQuestions(questions: QuizSetQuestion[]) {
  const warnings: string[] = [];

  if (questions.length === 0) {
    warnings.push("Keine Fragen vorhanden.");
    return {
      isBoardReady: false,
      warnings,
    };
  }

  const categories = Array.from(
    new Set(
      questions
        .map((question) => question.category)
        .filter((category): category is string => Boolean(category))
    )
  );

  if (categories.length > 6) {
    warnings.push("Mehr als 6 Kategorien vorhanden.");
  }

  for (const category of categories) {
    const categoryQuestions = questions.filter(
      (question) => question.category === category
    );

    if (categoryQuestions.length !== 5) {
      warnings.push(`${category}: ${categoryQuestions.length} statt 5 Fragen.`);
    }

    const points = categoryQuestions
      .map((question) => question.points)
      .filter((point): point is number => typeof point === "number");

    const requiredPoints = [100, 200, 300, 400, 500];

    for (const requiredPoint of requiredPoints) {
      if (!points.includes(requiredPoint)) {
        warnings.push(`${category}: ${requiredPoint} Punkte fehlen.`);
      }
    }

    const duplicatePoints = points.filter(
      (point, index) => points.indexOf(point) !== index
    );

    if (duplicatePoints.length > 0) {
      warnings.push(`${category}: doppelte Punkte vorhanden.`);
    }
  }

  return {
    isBoardReady: warnings.length === 0,
    warnings,
  };
}

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats>({
    pools: 0,
    activePoolQuestions: 0,
    inactivePoolQuestions: 0,
    quizSets: 0,
    boardReadyQuizSets: 0,
    incompleteQuizSets: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  async function loadDashboardStats() {
    setIsLoading(true);

    const [
      poolsResult,
      activeQuestionsResult,
      inactiveQuestionsResult,
      quizSetsResult,
      quizSetQuestionsResult,
    ] = await Promise.all([
      supabase.from("question_pools").select("id", { count: "exact" }),
      supabase
        .from("pool_questions")
        .select("id", { count: "exact" })
        .eq("is_active", true),
      supabase
        .from("pool_questions")
        .select("id", { count: "exact" })
        .eq("is_active", false),
      supabase.from("quiz_sets").select("id", { count: "exact" }),
      supabase
        .from("questions")
        .select("quiz_set_id, category, points")
        .not("quiz_set_id", "is", null),
    ]);

    const quizSetIds =
      quizSetsResult.data?.map((quizSet) => quizSet.id) ?? [];

    let boardReadyQuizSets = 0;
    let incompleteQuizSets = 0;

    for (const quizSetId of quizSetIds) {
      const questions =
        quizSetQuestionsResult.data?.filter(
          (question) => question.quiz_set_id === quizSetId
        ) ?? [];

      const validation = validateBoardQuestions(questions);

      if (validation.isBoardReady) {
        boardReadyQuizSets += 1;
      } else {
        incompleteQuizSets += 1;
      }
    }

    setStats({
      pools: poolsResult.count ?? 0,
      activePoolQuestions: activeQuestionsResult.count ?? 0,
      inactivePoolQuestions: inactiveQuestionsResult.count ?? 0,
      quizSets: quizSetsResult.count ?? 0,
      boardReadyQuizSets,
      incompleteQuizSets,
    });

    setIsLoading(false);
  }

  const adminCards = [
    {
      title: "Fragenpools",
      description:
        "Pools verwalten, Fragen erfassen, Medien hochladen und CSV-Dateien importieren.",
      href: "/pools",
      buttonLabel: "Pools öffnen",
    },
    {
      title: "Generator",
      description:
        "Aus aktiven Pool-Fragen board-konforme Quiz-Sets erstellen.",
      href: "/generator",
      buttonLabel: "Generator öffnen",
    },
    {
      title: "Quiz-Sets",
      description:
        "Fertige Quiz-Sets prüfen, reparieren, duplizieren, umbenennen oder löschen.",
      href: "/quiz-sets",
      buttonLabel: "Quiz-Sets öffnen",
    },
    {
      title: "Host",
      description:
        "Board-konforme Quiz-Sets starten und den Spielraum erzeugen.",
      href: "/host",
      buttonLabel: "Host öffnen",
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 32,
        background:
          "radial-gradient(circle at top, #1f2937 0, #020617 45%, #000 100%)",
        color: "white",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ marginBottom: 32 }}>
          <p
            style={{
              margin: 0,
              color: "#38bdf8",
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: 2,
              fontWeight: 700,
            }}
          >
            Quizfreunde Admin
          </p>

          <h1 style={{ margin: "10px 0 8px", fontSize: 42 }}>
            Admin-Dashboard
          </h1>

          <p style={{ margin: 0, color: "#cbd5e1", fontSize: 16 }}>
            Zentrale Verwaltung für Fragenpools, Generator, Quiz-Sets und Host.
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <StatCard
            label="Pools"
            value={stats.pools}
            isLoading={isLoading}
          />
          <StatCard
            label="Aktive Fragen"
            value={stats.activePoolQuestions}
            isLoading={isLoading}
          />
          <StatCard
            label="Inaktive Fragen"
            value={stats.inactivePoolQuestions}
            isLoading={isLoading}
          />
          <StatCard
            label="Quiz-Sets"
            value={stats.quizSets}
            isLoading={isLoading}
          />
          <StatCard
            label="Board-konform"
            value={stats.boardReadyQuizSets}
            isLoading={isLoading}
          />
          <StatCard
            label="Nicht vollständig"
            value={stats.incompleteQuizSets}
            isLoading={isLoading}
          />
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
          }}
        >
          {adminCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: 220,
                padding: 22,
                borderRadius: 18,
                border: "1px solid rgba(148, 163, 184, 0.35)",
                background: "rgba(15, 23, 42, 0.88)",
                color: "white",
                textDecoration: "none",
                boxShadow: "0 18px 40px rgba(0, 0, 0, 0.35)",
              }}
            >
              <div>
                <h2 style={{ margin: "0 0 10px", fontSize: 24 }}>
                  {card.title}
                </h2>
                <p
                  style={{
                    margin: 0,
                    color: "#cbd5e1",
                    lineHeight: 1.5,
                    fontSize: 15,
                  }}
                >
                  {card.description}
                </p>
              </div>

              <div
                style={{
                  marginTop: 24,
                  alignSelf: "flex-start",
                  padding: "10px 14px",
                  borderRadius: 999,
                  background: "#2563eb",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {card.buttonLabel}
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: number;
  isLoading: boolean;
}) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 16,
        border: "1px solid rgba(148, 163, 184, 0.3)",
        background: "rgba(15, 23, 42, 0.78)",
      }}
    >
      <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800 }}>
        {isLoading ? "..." : value}
      </div>
    </div>
  );
}
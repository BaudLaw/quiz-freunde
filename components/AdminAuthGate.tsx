"use client";

import { useEffect, useState } from "react";
import AdminCard from "@/components/AdminCard";
import AdminButton from "@/components/AdminButton";

type AdminAuthGateProps = {
  children: React.ReactNode;
};

const SESSION_KEY = "quizfreunde_admin_unlocked";

export default function AdminAuthGate({
  children,
}: AdminAuthGateProps) {
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const savedUnlock = sessionStorage.getItem(SESSION_KEY);

    if (savedUnlock === "true") {
      fetch("/api/admin/session", {
        cache: "no-store",
      })
        .then((response) => {
          if (response.ok) {
            setIsUnlocked(true);
            return;
          }

          sessionStorage.removeItem(SESSION_KEY);
        })
        .catch(() => {
          sessionStorage.removeItem(SESSION_KEY);
        });
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!password) {
      setError("Bitte Admin-Passwort eingeben.");
      return;
    }

    setIsChecking(true);
    setError("");

    let response: Response;

    try {
      response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });
    } catch {
      setIsChecking(false);
      setError("Login konnte nicht geprüft werden.");
      return;
    }

    if (response.ok) {
      setIsChecking(false);
      sessionStorage.setItem(SESSION_KEY, "true");
      setIsUnlocked(true);
      setError("");
      setPassword("");
      return;
    }

    const result = await response.json().catch(() => null);
    setIsChecking(false);
    setError(result?.error || "Falsches Passwort.");
  }

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <AdminCard
        title="Admin Login"
        description="Dieser Bereich ist geschützt."
      >
        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gap: 16,
          }}
        >
          <input
            type="password"
            value={password}
            disabled={isChecking}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            placeholder="Admin Passwort"
            autoComplete="current-password"
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid rgba(34, 211, 238, 0.35)",
              background: "#020617",
              color: "white",
              outline: "none",
            }}
          />

          {error && (
            <p
              style={{
                margin: 0,
                color: "#f87171",
                fontWeight: 700,
              }}
            >
              {error}
            </p>
          )}

          <AdminButton type="submit" variant="primary" disabled={isChecking}>
            {isChecking ? "Prüfe..." : "Entsperren"}
          </AdminButton>
        </form>
      </AdminCard>
    </div>
  );
}

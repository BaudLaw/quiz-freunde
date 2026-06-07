"use client";

import { useEffect, useRef, useState } from "react";

type NoticeKind = "info" | "success" | "warning" | "error";

type Notice = {
  id: number;
  message: string;
  kind: NoticeKind;
};

function getNoticeKind(message: string): NoticeKind {
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("fehler") ||
    normalizedMessage.includes("falsch") ||
    normalizedMessage.includes("fehlgeschlagen") ||
    normalizedMessage.includes("konnte nicht")
  ) {
    return "error";
  }

  if (
    normalizedMessage.includes("bitte") ||
    normalizedMessage.includes("keine") ||
    normalizedMessage.includes("fehlt")
  ) {
    return "warning";
  }

  if (
    normalizedMessage.includes("erstellt") ||
    normalizedMessage.includes("gespeichert") ||
    normalizedMessage.includes("importiert") ||
    normalizedMessage.includes("gelöscht") ||
    normalizedMessage.includes("zurückgesetzt") ||
    normalizedMessage.includes("ersetzt")
  ) {
    return "success";
  }

  return "info";
}

function getAccentColor(kind: NoticeKind) {
  if (kind === "error") return "#f87171";
  if (kind === "warning") return "#facc15";
  if (kind === "success") return "#22c55e";
  return "#38bdf8";
}

export default function AdminFeedbackLayer() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const nextIdRef = useRef(1);

  useEffect(() => {
    const nativeAlert = window.alert;

    window.alert = (message?: unknown) => {
      const text = String(message ?? "");
      const id = nextIdRef.current;
      nextIdRef.current += 1;

      setNotices((currentNotices) => [
        ...currentNotices.slice(-2),
        {
          id,
          message: text,
          kind: getNoticeKind(text),
        },
      ]);

      window.setTimeout(() => {
        setNotices((currentNotices) =>
          currentNotices.filter((notice) => notice.id !== id)
        );
      }, 5200);
    };

    return () => {
      window.alert = nativeAlert;
    };
  }, []);

  if (notices.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: "fixed",
        right: 20,
        top: 20,
        zIndex: 1000,
        display: "grid",
        gap: 10,
        width: "min(420px, calc(100vw - 40px))",
      }}
    >
      {notices.map((notice) => {
        const accentColor = getAccentColor(notice.kind);

        return (
          <div
            key={notice.id}
            style={{
              border: `1px solid ${accentColor}66`,
              borderLeft: `5px solid ${accentColor}`,
              borderRadius: 14,
              background: "rgba(2, 6, 23, 0.96)",
              boxShadow: "0 18px 50px rgba(0, 0, 0, 0.4)",
              color: "#f8fafc",
              display: "grid",
              gap: 8,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                alignItems: "start",
                display: "grid",
                gap: 12,
                gridTemplateColumns: "1fr auto",
              }}
            >
              <p
                style={{
                  color: accentColor,
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1.1,
                  margin: 0,
                  textTransform: "uppercase",
                }}
              >
                {notice.kind === "error"
                  ? "Fehler"
                  : notice.kind === "warning"
                    ? "Hinweis"
                    : notice.kind === "success"
                      ? "Erledigt"
                      : "Info"}
              </p>

              <button
                type="button"
                onClick={() =>
                  setNotices((currentNotices) =>
                    currentNotices.filter(
                      (currentNotice) => currentNotice.id !== notice.id
                    )
                  )
                }
                style={{
                  alignItems: "center",
                  background: "transparent",
                  border: 0,
                  color: "#cbd5e1",
                  cursor: "pointer",
                  display: "inline-flex",
                  fontSize: 18,
                  fontWeight: 800,
                  justifyContent: "center",
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                x
              </button>
            </div>

            <p
              style={{
                fontSize: 14,
                lineHeight: 1.45,
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {notice.message}
            </p>
          </div>
        );
      })}
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import AdminAuthGate from "@/components/AdminAuthGate";
import AdminFeedbackLayer from "@/components/AdminFeedbackLayer";
import AdminLogoutButton from "@/components/AdminLogoutButton";

type AdminLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export default function AdminLayout({
  title,
  subtitle,
  children,
}: AdminLayoutProps) {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background:
          "radial-gradient(circle at top, #0f2a44 0, #07111f 38%, #030712 100%)",
        color: "#f8fafc",
      }}
    >
      <AdminFeedbackLayer />
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gap: 24,
        }}
      >
        <header
          style={{
            display: "grid",
            gap: 16,
            padding: 24,
            border: "1px solid rgba(148, 163, 184, 0.25)",
            borderRadius: 18,
            background: "rgba(15, 23, 42, 0.82)",
            boxShadow: "0 24px 80px rgba(0, 0, 0, 0.35)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <p
                style={{
                  margin: 0,
                  color: "#38bdf8",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                }}
              >
                Quizfreunde Admin
              </p>

              <h1
                style={{
                  margin: 0,
                  fontSize: 34,
                  lineHeight: 1.1,
                  color: "#ffffff",
                }}
              >
                {title}
              </h1>

              {subtitle ? (
                <p
                  style={{
                    margin: 0,
                    maxWidth: 780,
                    color: "#cbd5e1",
                    fontSize: 16,
                    lineHeight: 1.5,
                  }}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>

            <nav
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              <Link href="/admin" style={navLinkStyle}>
                Admin
              </Link>
              <Link href="/pools" style={navLinkStyle}>
                Pools
              </Link>
              <Link href="/generator" style={navLinkStyle}>
                Generator
              </Link>
              <Link href="/quiz-sets" style={navLinkStyle}>
                Quiz-Sets
              </Link>
              <Link href="/host" style={navLinkStyle}>
                Host
              </Link>
              <AdminLogoutButton />
            </nav>
          </div>
        </header>

        <section
          style={{
            display: "grid",
            gap: 20,
          }}
        >
        <AdminAuthGate>{children}</AdminAuthGate>
        </section>
      </div>
    </main>
  );
}

const navLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 38,
  padding: "9px 13px",
  borderRadius: 999,
  border: "1px solid rgba(148, 163, 184, 0.35)",
  background: "rgba(15, 23, 42, 0.7)",
  color: "#e0f2fe",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 700,
} satisfies React.CSSProperties;

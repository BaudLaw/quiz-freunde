import type { ReactNode } from "react";

type AdminCardProps = {
  title?: string;
  description?: string;
  children?: ReactNode;
};

export default function AdminCard({
  title,
  description,
  children,
}: AdminCardProps) {
  return (
    <div
      style={{
        display: "grid",
        gap: 14,
        padding: 20,
        borderRadius: 18,
        border: "1px solid rgba(148, 163, 184, 0.24)",
        background: "rgba(15, 23, 42, 0.78)",
        boxShadow: "0 18px 50px rgba(0, 0, 0, 0.24)",
      }}
    >
      {title || description ? (
        <div style={{ display: "grid", gap: 6 }}>
          {title ? (
            <h2
              style={{
                margin: 0,
                color: "#ffffff",
                fontSize: 21,
                lineHeight: 1.2,
              }}
            >
              {title}
            </h2>
          ) : null}

          {description ? (
            <p
              style={{
                margin: 0,
                color: "#cbd5e1",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {description}
            </p>
          ) : null}
        </div>
      ) : null}

      {children}
    </div>
  );
}
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

type AdminButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type AdminButtonProps = {
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  children: ReactNode;
  variant?: AdminButtonVariant;
  disabled?: boolean;
};

export default function AdminButton({
  href,
  onClick,
  type = "button",
  children,
  variant = "secondary",
  disabled = false,
}: AdminButtonProps) {
  const style = getButtonStyle(variant, disabled);

  if (href) {
    return (
      <Link href={href} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} style={style}>
      {children}
    </button>
  );
}

function getButtonStyle(
  variant: AdminButtonVariant,
  disabled: boolean
): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(148, 163, 184, 0.32)",
    color: "#f8fafc",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };

  if (variant === "primary") {
    return {
      ...base,
      background: "linear-gradient(135deg, #0369a1, #0ea5e9)",
      border: "1px solid rgba(125, 211, 252, 0.55)",
      boxShadow: "0 14px 30px rgba(14, 165, 233, 0.22)",
    };
  }

  if (variant === "danger") {
    return {
      ...base,
      background: "rgba(127, 29, 29, 0.85)",
      border: "1px solid rgba(248, 113, 113, 0.5)",
      color: "#fee2e2",
    };
  }

  if (variant === "ghost") {
    return {
      ...base,
      background: "transparent",
      border: "1px solid rgba(148, 163, 184, 0.28)",
      color: "#bae6fd",
    };
  }

  return {
    ...base,
    background: "rgba(15, 23, 42, 0.78)",
    color: "#e0f2fe",
  };
}
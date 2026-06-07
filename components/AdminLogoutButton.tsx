"use client";

const SESSION_KEY = "quizfreunde_admin_unlocked";

export default function AdminLogoutButton() {
  async function handleLogout() {
    await fetch("/api/admin/logout", {
      method: "POST",
    }).catch(() => null);

    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = "/admin";
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 38,
        padding: "9px 13px",
        borderRadius: 999,
        border: "1px solid rgba(248, 113, 113, 0.45)",
        background: "rgba(127, 29, 29, 0.35)",
        color: "#fecaca",
        cursor: "pointer",
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      Logout
    </button>
  );
}

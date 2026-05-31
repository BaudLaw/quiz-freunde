type AdminDashboardResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

export async function getAdminDashboardStats<T>() {
  const response = await fetch("/api/admin/dashboard");
  const result = (await response.json().catch(() => null)) as
    | AdminDashboardResponse<T>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Statistiken konnten nicht geladen werden." },
    };
  }

  return result;
}

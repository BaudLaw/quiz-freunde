type AdminStorageResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

export type PoolMediaUploadType =
  | "pool-image"
  | "pool-audio"
  | "pool-solution-image"
  | "pool-solution-audio"
  | "host-image"
  | "host-audio";

export async function uploadAdminMedia(
  file: File,
  type: PoolMediaUploadType
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  const response = await fetch("/api/admin/storage", {
    method: "POST",
    body: formData,
  });

  const result = (await response.json().catch(() => null)) as
    | AdminStorageResponse<{ publicUrl: string; path: string }>
    | null;

  if (!result) {
    return {
      data: null,
      error: { message: "Datei konnte nicht hochgeladen werden." },
    };
  }

  return result;
}

export async function uploadPoolMedia(
  file: File,
  type: PoolMediaUploadType
) {
  return uploadAdminMedia(file, type);
}

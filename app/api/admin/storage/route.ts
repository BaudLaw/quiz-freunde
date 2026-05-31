import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminRequest";
import { supabase } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const uploadFolders = {
  "pool-image": "pool-images",
  "pool-audio": "pool-audio",
  "pool-solution-image": "pool-solution-images",
  "pool-solution-audio": "pool-solution-audio",
  "host-image": "images",
  "host-audio": "audio",
} as const;

function getFileExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() || "bin";
  return extension.replace(/[^a-z0-9]/g, "") || "bin";
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { data: null, error: { message: "Nicht autorisiert." } },
      { status: 401 }
    );
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json(
      { data: null, error: { message: "Ungueltige Anfrage." } },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const uploadType = formData.get("type");

  if (!(file instanceof File) || typeof uploadType !== "string") {
    return NextResponse.json(
      { data: null, error: { message: "Pflichtfelder fehlen." } },
      { status: 400 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json(
      { data: null, error: { message: "Datei ist leer." } },
      { status: 400 }
    );
  }

  const folder = uploadFolders[uploadType as keyof typeof uploadFolders];

  if (!folder) {
    return NextResponse.json(
      { data: null, error: { message: "Upload-Typ ist ungueltig." } },
      { status: 400 }
    );
  }

  const filePath = `${folder}/${Date.now()}-${randomUUID()}.${getFileExtension(
    file.name
  )}`;
  const fileBytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from("quiz-media")
    .upload(filePath, fileBytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    );
  }

  const { data } = supabase.storage.from("quiz-media").getPublicUrl(filePath);

  return NextResponse.json({
    data: { publicUrl: data.publicUrl, path: filePath },
    error: null,
  });
}

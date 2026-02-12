import { NextResponse } from "next/server";
import { createUploadRecord, getUploads } from "@/lib/ops-inventory-db";
import type { UploadStatus } from "@/lib/ticket-types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as UploadStatus | null;
    const uploads = await getUploads(status ?? undefined);
    return NextResponse.json({ success: true, data: uploads });
  } catch (error) {
    console.error("Error fetching uploads:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch uploads" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { filename, file_url, file_key, file_size, uploaded_by } = body;

    if (!filename || !file_url || !file_key) {
      return NextResponse.json(
        { success: false, error: "filename, file_url, and file_key are required" },
        { status: 400 }
      );
    }

    const upload = await createUploadRecord({
      filename,
      file_url,
      file_key,
      file_size: file_size ?? 0,
      uploaded_by: uploaded_by ?? "system",
    });

    return NextResponse.json({ success: true, data: upload });
  } catch (error) {
    console.error("Error creating upload:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create upload record" },
      { status: 500 }
    );
  }
}

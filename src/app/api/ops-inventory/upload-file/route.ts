import { NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";
import { createUploadRecord } from "@/lib/ops-inventory-db";

const utapi = new UTApi();

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { success: false, error: "Only PDF files are accepted" },
        { status: 400 }
      );
    }

    // Upload to UploadThing server-side
    const uploadResponse = await utapi.uploadFiles(file);

    if (uploadResponse.error) {
      return NextResponse.json(
        { success: false, error: `Upload failed: ${uploadResponse.error.message}` },
        { status: 500 }
      );
    }

    const { key, ufsUrl, name, size } = uploadResponse.data;

    // Create DB record with the real URL
    const upload = await createUploadRecord({
      filename: name,
      file_url: ufsUrl,
      file_key: key,
      file_size: size,
      uploaded_by: "manual",
    });

    return NextResponse.json({ success: true, data: upload });
  } catch (error) {
    console.error("Error uploading file:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getUploadById, updateUploadStatus, createTicket } from "@/lib/ops-inventory-db";
import { extractTicketFromPdfUrl, flattenExtractedData } from "@/lib/ticket-extractor";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { upload_id } = body;

    if (!upload_id) {
      return NextResponse.json(
        { success: false, error: "upload_id is required" },
        { status: 400 }
      );
    }

    const upload = await getUploadById(upload_id);
    if (!upload) {
      return NextResponse.json(
        { success: false, error: "Upload not found" },
        { status: 404 }
      );
    }

    if (upload.status === "processing") {
      return NextResponse.json(
        { success: false, error: "Upload is already being processed" },
        { status: 409 }
      );
    }

    // Mark as processing
    await updateUploadStatus(upload_id, "processing");

    try {
      // Extract data from PDF via Claude Haiku
      const extractedData = await extractTicketFromPdfUrl(upload.file_url);
      const flatData = flattenExtractedData(extractedData, upload_id);

      // Save ticket to database
      const ticket = await createTicket(flatData);

      // Mark upload as completed
      await updateUploadStatus(upload_id, "completed");

      return NextResponse.json({
        success: true,
        data: {
          upload_id,
          ticket,
          extracted: extractedData,
        },
      });
    } catch (extractionError) {
      const errorMessage = extractionError instanceof Error
        ? extractionError.message
        : "Unknown extraction error";

      await updateUploadStatus(upload_id, "failed", errorMessage);

      return NextResponse.json(
        { success: false, error: `Extraction failed: ${errorMessage}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error processing upload:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process upload" },
      { status: 500 }
    );
  }
}

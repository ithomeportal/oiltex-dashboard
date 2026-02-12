import { NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { createUploadRecord, updateUploadStatus, createTicket } from "@/lib/ops-inventory-db";
import { extractTicketFromBuffer, flattenExtractedData } from "@/lib/ticket-extractor";

const TICKETS_DIR = "/home/unlk-dfrv/BOT/oiltex-price/2026-02 OilTex Tickets";

export async function POST() {
  try {
    const files = await readdir(TICKETS_DIR);
    const pdfFiles = files.filter((f) => f.toLowerCase().endsWith(".pdf"));

    if (pdfFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: "No PDF files found in tickets directory" },
        { status: 404 }
      );
    }

    const results: Array<{
      filename: string;
      status: "success" | "failed";
      ticket_number?: string;
      error?: string;
    }> = [];

    for (const filename of pdfFiles) {
      const filePath = join(TICKETS_DIR, filename);

      try {
        // Read PDF file
        const pdfBuffer = await readFile(filePath);

        // Create upload record
        const upload = await createUploadRecord({
          filename,
          file_url: `file://${filePath}`,
          file_key: `batch-import-${filename}`,
          file_size: pdfBuffer.length,
          uploaded_by: "batch-import",
        });

        // Mark as processing
        await updateUploadStatus(upload.id, "processing");

        // Extract data via Claude Haiku
        const extractedData = await extractTicketFromBuffer(pdfBuffer);
        const flatData = flattenExtractedData(extractedData, upload.id);

        // Save ticket
        const ticket = await createTicket(flatData);

        // Mark as completed
        await updateUploadStatus(upload.id, "completed");

        results.push({
          filename,
          status: "success",
          ticket_number: ticket.ticket_number ?? undefined,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.push({
          filename,
          status: "failed",
          error: errorMessage,
        });
      }
    }

    const succeeded = results.filter((r) => r.status === "success").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return NextResponse.json({
      success: true,
      data: {
        processed: results.length,
        succeeded,
        failed,
        results,
      },
    });
  } catch (error) {
    console.error("Batch import error:", error);
    return NextResponse.json(
      { success: false, error: "Batch import failed" },
      { status: 500 }
    );
  }
}

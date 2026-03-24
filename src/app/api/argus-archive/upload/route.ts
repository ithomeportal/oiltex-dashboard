import { NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import { createArgusReport, getArgusReportByDate } from "@/lib/argus-db";
import { extractArgusPricingFromBuffer } from "@/lib/argus-extractor";
import { saveArgusPricing } from "@/lib/argus-pricing-db";
import { UTApi } from "uploadthing/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const utapi = new UTApi();

function extractReportDate(filename: string): string | null {
  // Try "Argus Americas Crude (2026-02-27).pdf" format
  const parenMatch = filename.match(/\((\d{4}-\d{2}-\d{2})\)/);
  if (parenMatch) return parenMatch[1];
  // Try "20260303acr.pdf" format
  const numMatch = filename.match(/^(\d{4})(\d{2})(\d{2})/);
  if (numMatch) return `${numMatch[1]}-${numMatch[2]}-${numMatch[3]}`;
  return null;
}

export async function POST(request: Request) {
  try {
    await initDatabase();

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json(
        { success: false, error: "No files provided" },
        { status: 400 }
      );
    }

    const results: Array<{
      filename: string;
      status: string;
      reportDate?: string;
      error?: string;
    }> = [];

    for (const file of files) {
      const reportDate = extractReportDate(file.name);
      if (!reportDate) {
        results.push({
          filename: file.name,
          status: "error",
          error: "Could not extract date from filename",
        });
        continue;
      }

      // Check if report already exists
      const existing = await getArgusReportByDate(reportDate);
      if (existing) {
        results.push({
          filename: file.name,
          status: "skipped",
          reportDate,
          error: "Report already exists for this date",
        });
        continue;
      }

      try {
        // Generate standard filename
        const stdFilename = `${reportDate.replace(/-/g, "")}acr.pdf`;

        // Upload to UploadThing
        const uploadFile = new File([file], stdFilename, {
          type: "application/pdf",
        });
        const uploadResponse = await utapi.uploadFiles(uploadFile);

        if (uploadResponse.error) {
          results.push({
            filename: file.name,
            status: "error",
            reportDate,
            error: `Upload failed: ${uploadResponse.error.message}`,
          });
          continue;
        }

        const { key, ufsUrl, size } = uploadResponse.data;

        // Save to argus_reports
        await createArgusReport({
          report_date: reportDate,
          report_type: "Americas Crude",
          subject: "Manual upload",
          filename: stdFilename,
          file_url: ufsUrl,
          file_key: key,
          file_size: size,
        });

        // Extract pricing
        let extractionStatus = "uploaded";
        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          const pricingData = await extractArgusPricingFromBuffer(buffer);
          await saveArgusPricing(
            reportDate,
            pricingData,
            pricingData as unknown as Record<string, unknown>
          );
          extractionStatus = "uploaded+extracted";
        } catch (extractErr) {
          const msg =
            extractErr instanceof Error ? extractErr.message : String(extractErr);
          extractionStatus = `uploaded (extraction failed: ${msg})`;
        }

        results.push({
          filename: file.name,
          status: extractionStatus,
          reportDate,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          filename: file.name,
          status: "error",
          reportDate,
          error: msg,
        });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Argus upload error:", error);
    return NextResponse.json(
      { success: false, error: "Upload failed" },
      { status: 500 }
    );
  }
}

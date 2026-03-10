import { NextResponse } from "next/server";
import pool, { initDatabase } from "@/lib/db";
import { fetchArgusReportAttachments } from "@/lib/graph-client";
import { createArgusReport, getArgusReportByDate } from "@/lib/argus-db";
import { extractArgusPricingFromBuffer } from "@/lib/argus-extractor";
import { saveArgusPricing } from "@/lib/argus-pricing-db";
import { UTApi } from "uploadthing/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const utapi = new UTApi();

function extractReportDate(filename: string, receivedDate: string): string {
  // Parse date from filename first (e.g. "20260303acr.pdf" → "2026-03-03")
  const match = filename.match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  // Fallback to email received date
  const date = new Date(receivedDate);
  return date.toISOString().split("T")[0];
}

async function logCron(
  jobName: string,
  status: string,
  message: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO cron_logs (job_name, status, message, details, completed_at)
       VALUES ($1, $2, $3, $4, CASE WHEN $2 != 'started' THEN NOW() ELSE NULL END)`,
      [jobName, status, message, details ? JSON.stringify(details) : null]
    );
  } catch {
    // Don't let logging failures break the cron
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    await logCron("fetch-argus", "auth_failed", "Invalid or missing authorization header");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await logCron("fetch-argus", "started", "Cron job started");

  try {
    await initDatabase();

    // Fetch recent Argus emails with PDF attachments (last 4 days for resilience)
    const attachments = await fetchArgusReportAttachments(4);

    await logCron("fetch-argus", "fetched_emails", `Found ${attachments.length} attachments`, {
      filenames: attachments.map((a) => a.filename),
    });

    let uploaded = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const attachment of attachments) {
      const reportDate = extractReportDate(attachment.filename, attachment.receivedDate);

      // Check if we already have this report
      const existing = await getArgusReportByDate(reportDate);
      if (existing) {
        skipped++;
        continue;
      }

      try {
        // Upload PDF to UploadThing
        const blob = new Blob([new Uint8Array(attachment.contentBytes)], {
          type: "application/pdf",
        });
        const file = new File([blob], attachment.filename, {
          type: "application/pdf",
        });

        const uploadResponse = await utapi.uploadFiles(file);

        if (uploadResponse.error) {
          errors.push(
            `Upload failed for ${attachment.filename}: ${uploadResponse.error.message}`
          );
          continue;
        }

        const { key, ufsUrl, size } = uploadResponse.data;

        // Save to database
        await createArgusReport({
          report_date: reportDate,
          report_type: "Americas Crude",
          subject: attachment.subject,
          filename: attachment.filename,
          file_url: ufsUrl,
          file_key: key,
          file_size: size,
        });

        // Extract pricing data from the PDF
        try {
          const pricingData = await extractArgusPricingFromBuffer(
            Buffer.from(attachment.contentBytes)
          );
          await saveArgusPricing(
            reportDate,
            pricingData,
            pricingData as unknown as Record<string, unknown>
          );
        } catch (extractErr) {
          const extractMsg =
            extractErr instanceof Error
              ? extractErr.message
              : String(extractErr);
          errors.push(
            `Pricing extraction failed for ${attachment.filename}: ${extractMsg}`
          );
        }

        uploaded++;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown upload error";
        errors.push(`Error processing ${attachment.filename}: ${message}`);
      }
    }

    const resultMessage = `Processed ${attachments.length} attachments: ${uploaded} uploaded, ${skipped} skipped`;
    await logCron("fetch-argus", "success", resultMessage, {
      uploaded,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });

    return NextResponse.json({
      success: true,
      message: resultMessage,
      uploaded,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    await logCron("fetch-argus", "error", message, { stack });

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

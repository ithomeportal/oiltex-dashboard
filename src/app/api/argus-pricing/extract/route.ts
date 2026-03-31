import { NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import { getArgusReports, getArgusReportByDate } from "@/lib/argus-db";
import { extractArgusPricingFromUrl } from "@/lib/argus-extractor";
import {
  saveArgusPricing,
  getArgusPricingWithNullNymex,
} from "@/lib/argus-pricing-db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initDatabase();

    const body = await request.json();
    const { all, date, backfill_nulls } = body as {
      all?: boolean;
      date?: string;
      backfill_nulls?: boolean;
    };

    // Backfill mode: re-extract only rows where nymex_cma_td is null
    if (backfill_nulls) {
      const nullRows = await getArgusPricingWithNullNymex();
      if (nullRows.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No rows with null nymex_cma_td found",
          fixed: 0,
          still_null: 0,
        });
      }

      let fixed = 0;
      let stillNull = 0;
      const errors: string[] = [];

      for (const row of nullRows) {
        const reportDate =
          typeof row.report_date === "string"
            ? row.report_date.split("T")[0]
            : new Date(row.report_date).toISOString().split("T")[0];

        // Find the corresponding argus_report to get the PDF URL
        const report = await getArgusReportByDate(reportDate);
        if (!report) {
          errors.push(`${reportDate}: no argus_report found`);
          stillNull++;
          continue;
        }

        try {
          const pricingData = await extractArgusPricingFromUrl(report.file_url);
          if (pricingData.nymex_cma_td !== null) {
            await saveArgusPricing(
              reportDate,
              pricingData,
              pricingData as unknown as Record<string, unknown>
            );
            fixed++;
          } else {
            stillNull++;
            errors.push(`${reportDate}: nymex_cma_td still null after retry`);
          }
        } catch (err) {
          stillNull++;
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${reportDate}: ${msg}`);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Backfill: ${nullRows.length} null rows found, ${fixed} fixed, ${stillNull} still null`,
        total: nullRows.length,
        fixed,
        still_null: stillNull,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    let reports;
    if (date) {
      const report = await getArgusReportByDate(date);
      reports = report ? [report] : [];
    } else if (all) {
      reports = await getArgusReports(100, 0);
    } else {
      return NextResponse.json(
        {
          error:
            "Provide { all: true }, { date: 'YYYY-MM-DD' }, or { backfill_nulls: true }",
        },
        { status: 400 }
      );
    }

    let extracted = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const report of reports) {
      try {
        const pricingData = await extractArgusPricingFromUrl(report.file_url);
        const reportDate =
          typeof report.report_date === "string"
            ? report.report_date.split("T")[0]
            : new Date(report.report_date).toISOString().split("T")[0];

        await saveArgusPricing(
          reportDate,
          pricingData,
          pricingData as unknown as Record<string, unknown>
        );
        extracted++;
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${report.report_date}: ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${reports.length} reports: ${extracted} extracted, ${failed} failed`,
      extracted,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Argus pricing extract error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

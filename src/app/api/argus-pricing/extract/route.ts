import { NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import { getArgusReports, getArgusReportByDate } from "@/lib/argus-db";
import { extractArgusPricingFromUrl } from "@/lib/argus-extractor";
import { saveArgusPricing } from "@/lib/argus-pricing-db";

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
    const { all, date } = body as { all?: boolean; date?: string };

    let reports;
    if (date) {
      const report = await getArgusReportByDate(date);
      reports = report ? [report] : [];
    } else if (all) {
      reports = await getArgusReports(100, 0);
    } else {
      return NextResponse.json(
        { error: "Provide { all: true } or { date: 'YYYY-MM-DD' }" },
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
          report.report_date.split("T")[0] || report.report_date;

        await saveArgusPricing(reportDate, pricingData, pricingData as unknown as Record<string, unknown>);
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

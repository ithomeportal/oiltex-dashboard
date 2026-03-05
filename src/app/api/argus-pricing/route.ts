import { NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import {
  getArgusPricingByMonth,
  getLatestArgusPricing,
  getAvailableContractMonths,
  getArgusPricingCount,
} from "@/lib/argus-pricing-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await initDatabase();

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "31", 10);
    const offset = (page - 1) * limit;

    const [rows, latest, months, total] = await Promise.all([
      month ? getArgusPricingByMonth(month, limit, offset) : Promise.resolve([]),
      getLatestArgusPricing(month),
      getAvailableContractMonths(),
      getArgusPricingCount(month),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        rows,
        latest,
        months,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Argus pricing API error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getTicketSummary } from "@/lib/ops-inventory-db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") ?? undefined;

    const summary = await getTicketSummary(month);

    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error("Error fetching ticket summary:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch summary" },
      { status: 500 }
    );
  }
}

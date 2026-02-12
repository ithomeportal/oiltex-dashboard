import { NextResponse } from "next/server";
import { getTickets } from "@/lib/ops-inventory-db";
import type { TicketFilters } from "@/lib/ticket-types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const filters: TicketFilters = {
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      shipper: searchParams.get("shipper") ?? undefined,
      operator: searchParams.get("operator") ?? undefined,
      county: searchParams.get("county") ?? undefined,
      state: searchParams.get("state") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50,
    };

    const { tickets, total } = await getTickets(filters);

    return NextResponse.json({
      success: true,
      data: tickets,
      meta: {
        total,
        page: filters.page ?? 1,
        limit: filters.limit ?? 50,
      },
    });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch tickets" },
      { status: 500 }
    );
  }
}

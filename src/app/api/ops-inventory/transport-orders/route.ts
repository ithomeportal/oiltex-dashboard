import { NextResponse } from "next/server";
import { getTransportOrders, getTransportOrderSummary } from "@/lib/mcleod-db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50,
    };

    const [{ orders, total }, summary] = await Promise.all([
      getTransportOrders(filters),
      getTransportOrderSummary({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        status: filters.status,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: orders,
      summary,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
      },
    });
  } catch (error) {
    console.error("Error fetching transport orders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch transport orders" },
      { status: 500 }
    );
  }
}

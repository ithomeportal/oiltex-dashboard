import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getTicketsForExport } from "@/lib/ops-inventory-db";
import pool from "@/lib/db";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

async function getMonthlyFieldPrice(dateFrom: string, dateTo: string): Promise<number | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT AVG(value) as avg_price FROM oil_prices
       WHERE date >= $1 AND date <= $2
         AND UPPER(price_type) IN ('WTI_FUTURES_SETTLE', 'NYMEX_SETTLE')
       LIMIT 1`,
      [dateFrom, dateTo]
    );
    const val = result.rows[0]?.avg_price;
    return val ? Math.round(parseFloat(val) * 100) / 100 : null;
  } finally {
    client.release();
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: "dateFrom and dateTo required" }, { status: 400 });
    }

    if (!DATE_REGEX.test(dateFrom) || !DATE_REGEX.test(dateTo)) {
      return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD." }, { status: 400 });
    }

    if (new Date(dateFrom) > new Date(dateTo)) {
      return NextResponse.json({ error: "dateFrom must be before dateTo" }, { status: 400 });
    }

    const tickets = await getTicketsForExport(dateFrom, dateTo);
    const fieldPrice = await getMonthlyFieldPrice(dateFrom, dateTo);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");

    sheet.columns = [
      { width: 12 },
      { width: 30 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 20 },
      { width: 14 },
      { width: 10 },
      { width: 14 },
      { width: 14 },
      { width: 12 },
      { width: 10 },
      { width: 14 },
    ];

    const headers = [
      "Date",
      "Well/Lease Property Name",
      "BOL #",
      "TANK#",
      "CONTRACT",
      "QUALITY",
      "Receiver",
      "FIELD PRICE",
      "Loaded",
      "NET VOLUME",
      "GROSS VOLUME",
      "Delivered",
      "Gravity",
      "GROSS VALUE",
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" },
      };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FF4472C4" } },
      };
    });

    for (const t of tickets) {
      const loaded = t.loaded_barrels != null ? parseFloat(String(t.loaded_barrels)) : null;
      const net = t.net_barrels != null ? parseFloat(String(t.net_barrels)) : null;
      const delivered = t.delivered_bbls != null ? parseFloat(String(t.delivered_bbls)) : null;
      const gravity = t.obs_gravity != null ? parseFloat(String(t.obs_gravity)) : null;
      const price = fieldPrice ?? null;
      const grossValue = price != null && net != null ? Math.round(price * net * 100) / 100 : null;

      const ticketDate = t.ticket_date ? new Date(t.ticket_date) : null;

      const row = sheet.addRow([
        ticketDate,
        t.shipper_name ?? "",
        t.bol_number ?? "",
        t.tank_id ?? "",
        "NA",
        "WTI",
        t.receiver_name ?? "",
        price,
        loaded,
        net,
        null,
        delivered,
        gravity,
        grossValue,
      ]);

      if (ticketDate) {
        row.getCell(1).numFmt = "m/d/yyyy";
      }
      row.getCell(8).numFmt = "#,##0.00";
      row.getCell(9).numFmt = "#,##0.00";
      row.getCell(10).numFmt = "#,##0.00";
      row.getCell(12).numFmt = "#,##0.00";
      row.getCell(13).numFmt = "0.0";
      row.getCell(14).numFmt = "#,##0.00";
    }

    const buffer = await workbook.xlsx.writeBuffer();

    const fromDate = new Date(dateFrom);
    const year = fromDate.getUTCFullYear();
    const monthName = MONTH_NAMES[fromDate.getUTCMonth()];
    const filename = `${year}-${monthName}-tickets.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate tickets summary:", error);
    return NextResponse.json(
      { error: "Failed to generate tickets summary" },
      { status: 500 }
    );
  }
}

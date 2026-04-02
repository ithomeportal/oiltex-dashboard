import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { getTicketPdfUrls } from "@/lib/ops-inventory-db";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  if (!dateFrom || !dateTo) {
    return NextResponse.json(
      { success: false, error: "dateFrom and dateTo are required" },
      { status: 400 }
    );
  }

  const tickets = await getTicketPdfUrls(dateFrom, dateTo);

  if (tickets.length === 0) {
    return NextResponse.json(
      { success: false, error: "No ticket PDFs found for the selected period" },
      { status: 404 }
    );
  }

  const mergedPdf = await PDFDocument.create();

  for (const ticket of tickets) {
    try {
      const res = await fetch(ticket.file_url);
      if (!res.ok) continue;
      const pdfBytes = await res.arrayBuffer();
      const sourcePdf = await PDFDocument.load(pdfBytes);
      const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
      for (const page of pages) {
        mergedPdf.addPage(page);
      }
    } catch {
      // Skip individual PDFs that fail to load/parse
      continue;
    }
  }

  if (mergedPdf.getPageCount() === 0) {
    return NextResponse.json(
      { success: false, error: "Could not process any ticket PDFs" },
      { status: 500 }
    );
  }

  const pdfBytes = await mergedPdf.save();
  const monthLabel = dateFrom.slice(0, 7);

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="OilTex_Tickets_${monthLabel}.pdf"`,
    },
  });
}

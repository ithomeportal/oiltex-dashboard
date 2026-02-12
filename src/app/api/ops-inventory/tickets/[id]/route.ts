import { NextResponse } from "next/server";
import { getTicketById, updateTicket } from "@/lib/ops-inventory-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ticketId = parseInt(id, 10);
    if (isNaN(ticketId)) {
      return NextResponse.json(
        { success: false, error: "Invalid ticket ID" },
        { status: 400 }
      );
    }

    const ticket = await getTicketById(ticketId);
    if (!ticket) {
      return NextResponse.json(
        { success: false, error: "Ticket not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    console.error("Error fetching ticket:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch ticket" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ticketId = parseInt(id, 10);
    if (isNaN(ticketId)) {
      return NextResponse.json(
        { success: false, error: "Invalid ticket ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const updatedTicket = await updateTicket(ticketId, {
      ...body,
      manually_corrected: true,
    });

    if (!updatedTicket) {
      return NextResponse.json(
        { success: false, error: "Ticket not found or no valid fields to update" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updatedTicket });
  } catch (error) {
    console.error("Error updating ticket:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update ticket" },
      { status: 500 }
    );
  }
}

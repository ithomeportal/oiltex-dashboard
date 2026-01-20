import { NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";

export async function POST(request: Request) {
  // Simple auth check - in production, make this more secure
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initDatabase();
    return NextResponse.json({
      success: true,
      message: "Database tables initialized successfully",
    });
  } catch (error) {
    console.error("Database init error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: "Failed to initialize database", details: errorMessage },
      { status: 500 }
    );
  }
}

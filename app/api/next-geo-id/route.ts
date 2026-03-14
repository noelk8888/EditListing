import { NextRequest, NextResponse } from "next/server";
import { generateNextGeoId } from "@/lib/google-sheets";

export const dynamic = "force-dynamic"; // never cache — GEO IDs must always be fresh

export async function GET(req: NextRequest) {
  try {
    const series = req.nextUrl.searchParams.get("series") || undefined;
    const nextGeoId = await generateNextGeoId(series ?? undefined);
    return NextResponse.json({ geoId: nextGeoId });
  } catch (error) {
    console.error("Error generating GEO ID:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate GEO ID" },
      { status: 500 }
    );
  }
}

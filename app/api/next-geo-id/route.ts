import { NextResponse } from "next/server";
import { generateNextGeoId } from "@/lib/google-sheets";

export async function GET() {
  try {
    const nextGeoId = await generateNextGeoId();
    return NextResponse.json({ geoId: nextGeoId });
  } catch (error) {
    console.error("Error generating GEO ID:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate GEO ID" },
      { status: 500 }
    );
  }
}

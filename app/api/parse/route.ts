import { NextRequest, NextResponse } from "next/server";
import { parseListingText, geocodeAddress } from "@/lib/claude-parser";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    const parsed = await parseListingText(text);

    // Try to geocode the address
    if (parsed.city || parsed.barangay || parsed.area) {
      const address = [
        parsed.building,
        parsed.area,
        parsed.barangay,
        parsed.city,
        parsed.province,
        parsed.region,
        "Philippines",
      ]
        .filter(Boolean)
        .join(", ");

      const coords = await geocodeAddress(address);
      if (coords.lat && coords.long) {
        parsed.lat = coords.lat;
        parsed.long = coords.long;
      }
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Parse error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse listing" },
      { status: 500 }
    );
  }
}

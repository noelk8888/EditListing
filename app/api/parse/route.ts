import { NextRequest, NextResponse } from "next/server";
import { parseListingText, geocodeAddress, extractCoordsFromMapLink } from "@/lib/claude-parser";
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

    let coordsFoundFromMap = false;

    // Try to extract LAT LONG directly from a Google Maps URL if present
    if (parsed.mapLink && (parsed.mapLink.includes('goo.gl') || parsed.mapLink.includes('google.com/maps'))) {
      const coords = await extractCoordsFromMapLink(parsed.mapLink);
      if (coords && coords.lat && coords.long) {
        parsed.lat = coords.lat;
        parsed.long = coords.long;
        parsed.locationVerified = true;
        parsed.mapLink = `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.long}`;
        coordsFoundFromMap = true;
      }
    }

    // Try to geocode — prefer AI-generated geocodableAddress for accuracy, but skip if we already found exact coords from a map link
    if (!coordsFoundFromMap && (parsed.geocodableAddress || parsed.city || parsed.barangay || parsed.area)) {
      const address = parsed.geocodableAddress || [
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

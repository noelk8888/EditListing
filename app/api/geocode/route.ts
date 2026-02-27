import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/claude-parser";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { address } = await request.json();

    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    const coords = await geocodeAddress(address + ", Philippines");

    if (!coords.lat || !coords.long) {
      return NextResponse.json(
        { error: "Could not find coordinates for this address" },
        { status: 404 }
      );
    }

    return NextResponse.json(coords);
  } catch (error) {
    console.error("Geocode error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to geocode address" },
      { status: 500 }
    );
  }
}

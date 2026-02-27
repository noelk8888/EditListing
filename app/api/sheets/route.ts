import { NextRequest, NextResponse } from "next/server";
import { getAllListings, addListing } from "@/lib/google-sheets";
import { auth } from "@/lib/auth";
import { Listing } from "@/types/listing";
import { generateId } from "@/lib/utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const listings = await getAllListings();
    return NextResponse.json(listings);
  } catch (error) {
    console.error("Get listings error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get listings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();

    const listing: Listing = {
      id: data.id || generateId(),
      region: data.region || "",
      province: data.province || "",
      city: data.city || "",
      barangay: data.barangay || "",
      area: data.area || "",
      building: data.building || "",
      residential: Boolean(data.residential),
      commercial: Boolean(data.commercial),
      industrial: Boolean(data.industrial),
      agricultural: Boolean(data.agricultural),
      lotArea: data.lotArea || "",
      floorArea: data.floorArea || "",
      status: data.status || "Available",
      type: data.type || "",
      salePrice: data.salePrice || "",
      salePricePerSqm: data.salePricePerSqm || "",
      leasePrice: data.leasePrice || "",
      leasePricePerSqm: data.leasePricePerSqm || "",
      lat: data.lat || "",
      long: data.long || "",
      bedrooms: data.bedrooms || "",
      toilets: data.toilets || "",
      garage: data.garage || "",
      amenities: data.amenities || "",
      corner: Boolean(data.corner),
      compound: Boolean(data.compound),
      photos: data.photos || "",
      mapLink: data.mapLink || "",
      rawListing: data.rawListing || "",
      withIncome: Boolean(data.withIncome),
      directOrCobroker: data.directOrCobroker || "",
      ownerBroker: data.ownerBroker || "",
      howManyAway: data.howManyAway || "",
      listingOwnership: data.listingOwnership || "",
    };

    const saved = await addListing(listing);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error("Add listing error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add listing" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getListingById, updateListing, deleteListing } from "@/lib/google-sheets";
import { auth } from "@/lib/auth";
import { Listing } from "@/types/listing";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const listing = await getListingById(id);

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    return NextResponse.json(listing);
  } catch (error) {
    console.error("Get listing error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get listing" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();

    const listing: Listing = {
      id,
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

    const updated = await updateListing(id, listing);

    if (!updated) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update listing error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update listing" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const deleted = await deleteListing(id);

    if (!deleted) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete listing error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete listing" },
      { status: 500 }
    );
  }
}

import { getAllListings } from "@/lib/google-sheets";
import { ListingTable } from "@/components/listing-table";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Listing } from "@/types/listing";

export const dynamic = "force-dynamic";

export default async function ListingsPage() {
  let listings: Listing[] = [];
  let error: string | null = null;

  try {
    listings = await getAllListings();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load listings";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Listings</h1>
          <p className="text-muted-foreground">
            Browse, search, and manage all property listings
          </p>
        </div>
        <Link href="/add">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Listing
          </Button>
        </Link>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            <strong>Error loading listings:</strong> {error}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Make sure your Google Sheets API credentials are configured correctly.
          </p>
        </div>
      ) : (
        <ListingTable listings={listings} />
      )}
    </div>
  );
}

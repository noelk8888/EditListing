import { getAllListings } from "@/lib/google-sheets";
import { auth } from "@/lib/auth";
import { getUserPermissions } from "@/lib/permissions";
import { ListingTable } from "@/components/listing-table";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Listing } from "@/types/listing";

export const dynamic = "force-dynamic";

export default async function ListingsPage() {
  const session = await auth();
  const permissions = session?.user
    ? await getUserPermissions(session.user.email!, session.user.role)
    : null;

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
        {permissions?.add_listing && (
          <Link href="/add">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Listing
            </Button>
          </Link>
        )}
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
        <ListingTable
          listings={listings}
          canEdit={permissions?.edit_listing ?? true}
          canDelete={permissions?.delete_listing ?? true}
          canViewPricing={permissions?.view_pricing ?? true}
          canViewPhotos={permissions?.view_photos ?? true}
        />
      )}
    </div>
  );
}

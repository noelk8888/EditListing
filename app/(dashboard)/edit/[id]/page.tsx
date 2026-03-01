import { getListingById } from "@/lib/google-sheets";
import { auth } from "@/lib/auth";
import { getUserPermissions } from "@/lib/permissions";
import { ListingForm } from "@/components/listing-form";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface EditPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditListingPage({ params }: EditPageProps) {
  const session = await auth();
  const permissions = session?.user
    ? await getUserPermissions(session.user.email!, session.user.role)
    : null;

  if (!permissions?.edit_listing) {
    redirect("/listings");
  }

  const { id } = await params;

  let listing = null;
  let error = null;

  try {
    listing = await getListingById(id);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load listing";
  }

  if (!listing && !error) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Listing</h1>
        <p className="text-muted-foreground">
          Update the property listing details
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            <strong>Error loading listing:</strong> {error}
          </p>
        </div>
      ) : (
        listing && <ListingForm listing={listing} mode="edit" />
      )}
    </div>
  );
}

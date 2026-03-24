"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Listing, PROPERTY_TYPES, STATUS_OPTIONS } from "@/types/listing";
import { formatPrice } from "@/lib/utils";
import { Edit, Trash2, Search, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ListingTableProps {
  listings: Listing[];
  canEdit?: boolean;
  canDelete?: boolean;
  canViewPricing?: boolean;
  canViewPhotos?: boolean;
}

export function ListingTable({
  listings: initialListings,
  canEdit = true,
  canDelete = true,
  canViewPricing = true,
  canViewPhotos = true,
}: ListingTableProps) {
  const router = useRouter();
  const [listings, setListings] = useState(initialListings);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredListings = listings.filter((listing) => {
    const matchesSearch =
      search === "" ||
      [listing.city, listing.barangay, listing.area, listing.building, listing.province]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(search.toLowerCase()));

    const matchesType = typeFilter === "all" || listing.type === typeFilter;
    const matchesStatus = statusFilter === "all" || (listing.status?.toUpperCase() === statusFilter.toUpperCase());

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleDelete = async () => {
    if (!deleteId) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/sheets/${deleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete listing");
      }

      setListings((prev) => prev.filter((l) => l.id !== deleteId));
      toast({
        title: "Listing deleted",
        description: "The listing has been removed from Google Sheets",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete listing",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Property Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {PROPERTY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredListings.length} of {listings.length} listings
      </p>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Location</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredListings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <p className="text-muted-foreground">No listings found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredListings.map((listing) => (
                <TableRow key={listing.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {[listing.city, listing.barangay]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {[listing.area, listing.building]
                          .filter(Boolean)
                          .join(" • ") || "—"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p>{listing.type || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          listing.residential && "Res",
                          listing.commercial && "Com",
                          listing.industrial && "Ind",
                          listing.agricultural && "Agr",
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      {listing.lotArea && <p>Lot: {listing.lotArea} sqm</p>}
                      {listing.floorArea && <p>Floor: {listing.floorArea} sqm</p>}
                      {!listing.lotArea && !listing.floorArea && "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {canViewPricing ? (
                      <div>
                        {listing.salePrice && (
                          <p>Sale: {formatPrice(listing.salePrice)}</p>
                        )}
                        {listing.leasePrice && (
                          <p>Lease: {formatPrice(listing.leasePrice)}/mo</p>
                        )}
                        {!listing.salePrice && !listing.leasePrice && "—"}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">Hidden</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        listing.status === "AVAILABLE"
                          ? "bg-green-100 text-green-800"
                          : listing.status === "SOLD"
                          ? "bg-red-100 text-red-800"
                          : listing.status === "LEASED OUT"
                          ? "bg-blue-100 text-blue-800"
                          : listing.status === "ON HOLD"
                          ? "bg-yellow-100 text-yellow-800"
                          : listing.status === "UNDER NEGO"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {listing.status || "Unknown"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canViewPhotos && listing.photos && (
                        <Button variant="ghost" size="icon" asChild>
                          <a
                            href={listing.photos}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {canEdit && (
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/edit/${listing.id}`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(listing.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Listing</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this listing? This action cannot be
              undone and will remove the entry from Google Sheets.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

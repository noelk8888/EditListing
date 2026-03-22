"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Listing, PROPERTY_TYPES, STATUS_OPTIONS, DIRECT_COBROKER_OPTIONS, LISTING_OWNERSHIP_OPTIONS } from "@/types/listing";
import { Loader2, Save, MapPin } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { fetchSpearheadedByNames } from "@/lib/supabase";

interface ListingFormProps {
  listing: Partial<Listing>;
  mode: "add" | "edit";
}

export function ListingForm({ listing: initialListing, mode }: ListingFormProps) {
  const router = useRouter();
  const [listing, setListing] = useState<Partial<Listing>>(initialListing);
  const [loading, setLoading] = useState(false);
  const [dynamicOptions, setDynamicOptions] = useState<string[]>([]);

  useEffect(() => {
    fetchSpearheadedByNames().then(setDynamicOptions);
  }, []);

  const allOwnershipOptions = Array.from(new Set([...LISTING_OWNERSHIP_OPTIONS, ...dynamicOptions]));
  const [geocoding, setGeocoding] = useState(false);

  const updateField = <K extends keyof Listing>(field: K, value: Listing[K]) => {
    setListing((prev) => ({ ...prev, [field]: value }));
  };

  const handleGeocode = async () => {
    const address = [
      listing.building,
      listing.area,
      listing.barangay,
      listing.city,
      listing.province,
      listing.region,
    ]
      .filter(Boolean)
      .join(", ");

    if (!address) {
      toast({
        title: "No address to geocode",
        description: "Please enter location details first",
        variant: "destructive",
      });
      return;
    }

    setGeocoding(true);
    try {
      const response = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) throw new Error("Geocoding failed");

      const { lat, long } = await response.json();
      setListing((prev) => ({ ...prev, lat, long }));
      toast({
        title: "Coordinates found",
        description: `Lat: ${lat}, Long: ${long}`,
      });
    } catch (err) {
      toast({
        title: "Geocoding failed",
        description: "Could not find coordinates for this address",
        variant: "destructive",
      });
    } finally {
      setGeocoding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = mode === "add" ? "/api/sheets" : `/api/sheets/${listing.id}`;
      const method = mode === "add" ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(listing),
      });

      if (!response.ok) {
        throw new Error("Failed to save listing");
      }

      toast({
        title: mode === "add" ? "Listing added!" : "Listing updated!",
        description: "The listing has been saved to Google Sheets",
      });

      router.push("/listings");
      router.refresh();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save listing",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const propertyTypes = [];
  if (listing.residential) propertyTypes.push("RESIDENTIAL");
  if (listing.commercial) propertyTypes.push("COMMERCIAL");
  if (listing.industrial) propertyTypes.push("INDUSTRIAL");
  if (listing.agricultural) propertyTypes.push("AGRICULTURAL");
  const propertyTypesDisplay = propertyTypes.join(", ");

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Location Section */}
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="region">Region</Label>
            <Input
              id="region"
              value={listing.region || ""}
              onChange={(e) => updateField("region", e.target.value)}
              placeholder="e.g., NCR, Region IV-A"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="province">Province</Label>
            <Input
              id="province"
              value={listing.province || ""}
              onChange={(e) => updateField("province", e.target.value)}
              placeholder="e.g., Metro Manila, Cavite"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City/Municipality</Label>
            <Input
              id="city"
              value={listing.city || ""}
              onChange={(e) => updateField("city", e.target.value)}
              placeholder="e.g., Quezon City, Makati"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="barangay">Barangay</Label>
            <Input
              id="barangay"
              value={listing.barangay || ""}
              onChange={(e) => updateField("barangay", e.target.value)}
              placeholder="e.g., Nagkaisang Nayon"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="area">Area/Subdivision</Label>
            <Input
              id="area"
              value={listing.area || ""}
              onChange={(e) => updateField("area", e.target.value)}
              placeholder="e.g., Sitio Gitna"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="building">Building/Project</Label>
            <Input
              id="building"
              value={listing.building || ""}
              onChange={(e) => updateField("building", e.target.value)}
              placeholder="e.g., Building name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lat">Latitude</Label>
            <Input
              id="lat"
              value={listing.lat || ""}
              onChange={(e) => updateField("lat", e.target.value)}
              placeholder="e.g., 14.6091"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="long">Longitude</Label>
            <Input
              id="long"
              value={listing.long || ""}
              onChange={(e) => updateField("long", e.target.value)}
              placeholder="e.g., 121.0223"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleGeocode}
              disabled={geocoding}
            >
              {geocoding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="mr-2 h-4 w-4" />
              )}
              Get Coordinates
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Property Details Section */}
      <Card>
        <CardHeader>
          <CardTitle>Property Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="type">Property Type</Label>
            <Select
              value={listing.type || ""}
              onValueChange={(value) => updateField("type", value as Listing["type"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={listing.status || ""}
              onValueChange={(value) => updateField("status", value as Listing["status"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lotArea">Lot Area (sqm)</Label>
            <Input
              id="lotArea"
              value={listing.lotArea || ""}
              onChange={(e) => updateField("lotArea", e.target.value)}
              placeholder="e.g., 15430"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="floorArea">Floor Area (sqm)</Label>
            <Input
              id="floorArea"
              value={listing.floorArea || ""}
              onChange={(e) => updateField("floorArea", e.target.value)}
              placeholder="e.g., 500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bedrooms">Bedrooms</Label>
            <Input
              id="bedrooms"
              value={listing.bedrooms || ""}
              onChange={(e) => updateField("bedrooms", e.target.value)}
              placeholder="e.g., 3"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="toilets">Toilets/Bathrooms</Label>
            <Input
              id="toilets"
              value={listing.toilets || ""}
              onChange={(e) => updateField("toilets", e.target.value)}
              placeholder="e.g., 2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="garage">Garage/Parking</Label>
            <Input
              id="garage"
              value={listing.garage || ""}
              onChange={(e) => updateField("garage", e.target.value)}
              placeholder="e.g., 2"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="amenities">Amenities</Label>
            <Input
              id="amenities"
              value={listing.amenities || ""}
              onChange={(e) => updateField("amenities", e.target.value)}
              placeholder="e.g., Pool, Gym, Security"
            />
          </div>
        </CardContent>
      </Card>

      {/* Categories Section */}
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <span className="font-semibold">TYPE: </span>
            <span>{propertyTypesDisplay || "NONE"}</span>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="corner"
                checked={listing.corner || false}
                onCheckedChange={(checked) =>
                  updateField("corner", checked as boolean)
                }
              />
              <Label htmlFor="corner">Corner Lot</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="compound"
                checked={listing.compound || false}
                onCheckedChange={(checked) =>
                  updateField("compound", checked as boolean)
                }
              />
              <Label htmlFor="compound">Inside Compound</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Section */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="salePrice">Sale Price (PHP)</Label>
            <Input
              id="salePrice"
              value={listing.salePrice || ""}
              onChange={(e) => updateField("salePrice", e.target.value)}
              placeholder="e.g., 617200000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="salePricePerSqm">Sale Price/sqm</Label>
            <Input
              id="salePricePerSqm"
              value={listing.salePricePerSqm || ""}
              onChange={(e) => updateField("salePricePerSqm", e.target.value)}
              placeholder="e.g., 40000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="leasePrice">Lease Price (PHP/mo)</Label>
            <Input
              id="leasePrice"
              value={listing.leasePrice || ""}
              onChange={(e) => updateField("leasePrice", e.target.value)}
              placeholder="e.g., 50000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="leasePricePerSqm">Lease Price/sqm</Label>
            <Input
              id="leasePricePerSqm"
              value={listing.leasePricePerSqm || ""}
              onChange={(e) => updateField("leasePricePerSqm", e.target.value)}
              placeholder="e.g., 500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Listing Info Section */}
      <Card>
        <CardHeader>
          <CardTitle>Listing Info</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="withIncome"
              checked={listing.withIncome || false}
              onCheckedChange={(checked) =>
                updateField("withIncome", checked as boolean)
              }
            />
            <Label htmlFor="withIncome">With Income</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="directOrCobroker">Direct or Cobroker</Label>
            <Select
              value={listing.directOrCobroker || ""}
              onValueChange={(value) => updateField("directOrCobroker", value as Listing["directOrCobroker"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {DIRECT_COBROKER_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerBroker">Owner/Broker</Label>
            <Input
              id="ownerBroker"
              value={listing.ownerBroker || ""}
              onChange={(e) => updateField("ownerBroker", e.target.value)}
              placeholder="Name of owner or broker"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="howManyAway">How Many AWAY</Label>
            <Input
              id="howManyAway"
              value={listing.howManyAway || ""}
              onChange={(e) => updateField("howManyAway", e.target.value)}
              placeholder="e.g., 1, 2, 3..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="listingOwnership">Listing Ownership</Label>
            <Select
              value={listing.listingOwnership || ""}
              onValueChange={(value) => updateField("listingOwnership", value)}
            >
              <SelectTrigger>
                <span className={listing.listingOwnership === "" ? "opacity-0" : ""}>
                  <SelectValue placeholder="Select ownership..." />
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">&lt;blank&gt;</SelectItem>
                {allOwnershipOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Additional Info Section */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="photos">Photo URL</Label>
            <Input
              id="photos"
              value={listing.photos || ""}
              onChange={(e) => updateField("photos", e.target.value)}
              placeholder="e.g., https://photos.google.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rawListing">Original Listing Text</Label>
            <Textarea
              id="rawListing"
              value={listing.rawListing || ""}
              onChange={(e) => updateField("rawListing", e.target.value)}
              rows={5}
              className="font-mono text-sm placeholder:text-gray-300"
              placeholder="Original listing text for reference"
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {mode === "add" ? "Add Listing" : "Save Changes"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

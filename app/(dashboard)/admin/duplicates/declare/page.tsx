"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, 
  Copy, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowUpDown, 
  ExternalLink,
  RefreshCw,
  Scale
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface ListingDetail {
  id: string; // GEO ID
  summary: string | null;
  city: string | null;
  barangay: string | null;
  lot_area: number | null;
  floor_area: number | null;
  price: number | null;
  lease_price: number | null;
  photo_link: string | null;
  status: string | null;
  row_index: number | null;
  direct_or_broker: string | null;
  owner_broker: string | null;
  sale_or_lease: string | null;
  listing_ownership: string | null;
}

export default function DeclareDuplicatePage() {
  const router = useRouter();

  const [geoIdA, setGeoIdA] = useState("");
  const [geoIdB, setGeoIdB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [listingA, setListingA] = useState<ListingDetail | null>(null);
  const [listingB, setListingB] = useState<ListingDetail | null>(null);
  const [descA, setDescA] = useState("");
  const [descB, setDescB] = useState("");

  const [selectedOriginal, setSelectedOriginal] = useState<"A" | "B" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editedDuplicateText, setEditedDuplicateText] = useState("");

  // Fetch listing helper
  const fetchListing = async (input: string): Promise<ListingDetail> => {
    const cleanInput = input.trim();
    if (!cleanInput) {
      throw new Error("Input identifier is empty");
    }

    const isRowNumber = /^\d+$/.test(cleanInput);
    const bodyPayload = isRowNumber
      ? { rowNumber: parseInt(cleanInput, 10), isDuplicateTagging: true }
      : { listingId: cleanInput.toUpperCase(), isDuplicateTagging: true };

    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch listing for ${cleanInput}`);
    }

    const data = await res.json();
    if (!data.result) {
      throw new Error(`Listing "${cleanInput}" was not found in Supabase or Google Sheets.`);
    }

    return data.result;
  };

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geoIdA.trim() || !geoIdB.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Identifiers",
        description: "Please enter both GEO IDs or GSheet Row Numbers to compare.",
      });
      return;
    }

    if (geoIdA.trim().toUpperCase() === geoIdB.trim().toUpperCase()) {
      toast({
        variant: "destructive",
        title: "Duplicate Input",
        description: "Cannot compare a listing with itself. Please enter two different identifiers.",
      });
      return;
    }

    setLoading(true);
    setError(null);
    setListingA(null);
    setListingB(null);
    setDescA("");
    setDescB("");
    setSelectedOriginal(null);
    setSaveSuccess(false);

    try {
      const [resA, resB] = await Promise.all([
        fetchListing(geoIdA),
        fetchListing(geoIdB),
      ]);

      setListingA(resA);
      setListingB(resB);
      setDescA(resA.summary || "");
      setDescB(resB.summary || "");

      toast({
        title: "Listings Loaded",
        description: `Successfully retrieved details for ${resA.id} and ${resB.id}.`,
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while loading listings.");
      toast({
        variant: "destructive",
        title: "Error Loading Listings",
        description: err.message || "Please check the GEO IDs and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = () => {
    const temp = geoIdA;
    setGeoIdA(geoIdB);
    setGeoIdB(temp);

    const tempListing = listingA;
    setListingA(listingB);
    setListingB(tempListing);

    const tempDesc = descA;
    setDescA(descB);
    setDescB(tempDesc);

    if (selectedOriginal === "A") setSelectedOriginal("B");
    else if (selectedOriginal === "B") setSelectedOriginal("A");
  };

  const handleReset = () => {
    setGeoIdA("");
    setGeoIdB("");
    setListingA(null);
    setListingB(null);
    setDescA("");
    setDescB("");
    setSelectedOriginal(null);
    setError(null);
    setSaveSuccess(false);
  };

  const getUpdatedDuplicateDescription = (duplicateDesc: string, duplicateId: string, originalRowIndex: number, originalId: string) => {
    if (!duplicateDesc) return "";
    
    const lines = duplicateDesc.split("\n");
    const firstLine = lines[0]?.trim();
    const duplicateTag = `*DUPLICATE Row ${originalRowIndex} - ${originalId}*`;
    
    // Clean existing duplicate tags first (case-insensitive check)
    const cleanLines = lines.filter(line => !line.toUpperCase().includes("*DUPLICATE ROW"));

    if (firstLine.toUpperCase() === duplicateId.toUpperCase()) {
      cleanLines.splice(1, 0, duplicateTag);
    } else {
      cleanLines.unshift(duplicateTag);
    }
    return cleanLines.join("\n");
  };

  const handleSelectOriginal = (selection: "A" | "B") => {
    setSelectedOriginal(selection);
    const original = selection === "A" ? listingA : listingB;
    const duplicate = selection === "A" ? listingB : listingA;
    const duplicateDesc = selection === "A" ? descB : descA;
    if (duplicate && original && original.row_index) {
      const initialText = getUpdatedDuplicateDescription(duplicateDesc, duplicate.id, original.row_index, original.id);
      setEditedDuplicateText(initialText);
    }
  };

  const handleSaveDuplicate = async () => {
    if (!selectedOriginal || !listingA || !listingB) return;

    const original = selectedOriginal === "A" ? listingA : listingB;
    const duplicate = selectedOriginal === "A" ? listingB : listingA;

    if (!original.row_index) {
      toast({
        variant: "destructive",
        title: "Original Row Missing",
        description: `Could not resolve Google Sheets row index for original listing ${original.id}.`,
      });
      return;
    }

    if (!duplicate.row_index) {
      toast({
        variant: "destructive",
        title: "Duplicate Row Missing",
        description: `Could not resolve Google Sheets row index for duplicate listing ${duplicate.id}.`,
      });
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch("/api/duplicates/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalRowNumber: original.row_index,
          originalGeoId: original.id,
          originalText: selectedOriginal === "A" ? descA : descB,
          duplicateRowNumbers: [duplicate.row_index],
          duplicateTexts: {
            [duplicate.row_index]: editedDuplicateText
          }
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save operation failed.");

      setSaveSuccess(true);
      toast({
        title: "Success",
        description: `Successfully marked ${duplicate.id} as a duplicate of ${original.id} in GSheets and Supabase.`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Error Marking Duplicate",
        description: err.message || "Failed to save duplicate status.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const originalListing = selectedOriginal === "A" ? listingA : selectedOriginal === "B" ? listingB : null;
  const duplicateListing = selectedOriginal === "A" ? listingB : selectedOriginal === "B" ? listingA : null;

  return (
    <div className="container max-w-7xl py-8 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push("/admin/duplicates")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Duplicate Gsheet
          </Button>
          <div className="h-4 border-l" />
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent dark:from-purple-400 dark:to-indigo-400">
            Duplicate Tagging
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} className="text-xs">
          Reset Page
        </Button>
      </div>

      {/* Input Form */}
      {!listingA || !listingB ? (
        <Card className="border-2 border-purple-500/20 shadow-xl shadow-purple-500/5 bg-background/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Scale className="h-5 w-5 text-purple-600" />
              Compare Two Listings Side-by-Side
            </CardTitle>
            <CardDescription>
              Enter the GEO ID or GSheet Row Number of two listings. We will fetch their current data from Supabase and Google Sheets to let you verify and mark one as duplicate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCompare} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="geoIdA" className="text-sm font-semibold">Listing A (GEO ID or Row Number)</Label>
                  <Input
                    id="geoIdA"
                    placeholder="e.g. G03865 or 3824"
                    value={geoIdA}
                    onChange={(e) => setGeoIdA(e.target.value)}
                    disabled={loading}
                    className="font-mono uppercase h-11 text-base tracking-widest border-purple-500/30 focus-visible:ring-purple-600"
                  />
                </div>
                
                <div className="flex justify-center md:col-span-1 pb-1">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleSwap} 
                    disabled={loading}
                    title="Swap inputs"
                    className="rounded-full hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-950"
                  >
                    <ArrowUpDown className="h-5 w-5 rotate-90 md:rotate-0" />
                  </Button>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="geoIdB" className="text-sm font-semibold">Listing B (GEO ID or Row Number)</Label>
                  <Input
                    id="geoIdB"
                    placeholder="e.g. G02447 or 3825"
                    value={geoIdB}
                    onChange={(e) => setGeoIdB(e.target.value)}
                    disabled={loading}
                    className="font-mono uppercase h-11 text-base tracking-widest border-purple-500/30 focus-visible:ring-purple-600"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300 rounded-lg flex items-start gap-2.5 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <Button 
                type="submit" 
                disabled={loading} 
                className="w-full h-11 text-base bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/10"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching Listings from DBASE...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Load Listings & Compare
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {/* Side by Side Comparison Cards */}
      {listingA && listingB && !saveSuccess ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Listing A Card */}
            <div className={cn(
              "rounded-xl border-2 flex flex-col transition-all duration-300 overflow-hidden bg-card",
              selectedOriginal === "A"
                ? "border-green-500 shadow-xl shadow-green-500/5"
                : selectedOriginal === "B"
                ? "border-border opacity-50 bg-muted/20"
                : "border-purple-500/20 hover:border-purple-400"
            )}>
              {/* Header */}
              <div className={cn(
                "px-4 py-3 flex items-center justify-between border-b transition-colors",
                selectedOriginal === "A" ? "bg-green-50 dark:bg-green-950/20" : "bg-muted/40"
              )}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-muted-foreground">
                    Row {listingA.row_index || "—"}
                  </span>
                  <span className="font-mono text-sm font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 px-2 py-0.5 rounded">
                    {listingA.id}
                  </span>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded font-semibold",
                    listingA.status?.toUpperCase() === "AVAILABLE" 
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                  )}>
                    {listingA.status || "UNKNOWN"}
                  </span>
                </div>

                {selectedOriginal === "A" ? (
                  <span className="inline-flex items-center gap-1 rounded bg-green-600 text-white text-xs font-bold px-2.5 py-1">
                    <CheckCircle2 className="h-3 w-3" />
                    ORIGINAL
                  </span>
                ) : selectedOriginal === "B" ? (
                  <span className="inline-flex items-center gap-1 rounded bg-red-600 text-white text-xs font-bold px-2.5 py-1">
                    DUPLICATE
                  </span>
                ) : (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleSelectOriginal("A")}
                    className="h-7 text-xs border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                  >
                    Mark as Original
                  </Button>
                )}
              </div>

              {/* Listing Details */}
              <CardContent className="p-4 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm border-b pb-3">
                    <div>
                      <span className="text-xs text-muted-foreground block">Location</span>
                      <span className="font-medium">{listingA.barangay || listingA.city ? `${listingA.barangay || ""}, ${listingA.city || ""}` : "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Price / Lease</span>
                      <span className="font-medium">
                        {listingA.price ? `₱${listingA.price.toLocaleString()}` : listingA.lease_price ? `₱${listingA.lease_price.toLocaleString()}/mo` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Lot / Floor Area</span>
                      <span className="font-medium">
                        {listingA.lot_area ? `${listingA.lot_area} sqm` : "—"} / {listingA.floor_area ? `${listingA.floor_area} sqm` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Ownership / Contact</span>
                      <span className="font-medium text-xs truncate max-w-full block">
                        {listingA.listing_ownership || "—"} ({listingA.owner_broker || "Direct"})
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block font-semibold">Description Text:</span>
                    <Textarea
                      value={descA}
                      onChange={(e) => {
                        const newVal = e.target.value;
                        setDescA(newVal);
                        if (selectedOriginal === "B" && listingA && listingB && listingB.row_index) {
                          const initialText = getUpdatedDuplicateDescription(newVal, listingA.id, listingB.row_index, listingB.id);
                          setEditedDuplicateText(initialText);
                        }
                      }}
                      className="font-mono text-xs min-h-[250px] bg-background border-purple-500/20 focus-visible:ring-purple-600"
                      placeholder="Edit description text here..."
                    />
                  </div>
                </div>

                {listingA.photo_link && (
                  <div className="pt-2 border-t flex justify-end">
                    <Button variant="link" size="sm" asChild className="p-0 h-auto text-purple-600">
                      <a href={listingA.photo_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> View Google Photos
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </div>

            {/* Listing B Card */}
            <div className={cn(
              "rounded-xl border-2 flex flex-col transition-all duration-300 overflow-hidden bg-card",
              selectedOriginal === "B"
                ? "border-green-500 shadow-xl shadow-green-500/5"
                : selectedOriginal === "A"
                ? "border-border opacity-50 bg-muted/20"
                : "border-purple-500/20 hover:border-purple-400"
            )}>
              {/* Header */}
              <div className={cn(
                "px-4 py-3 flex items-center justify-between border-b transition-colors",
                selectedOriginal === "B" ? "bg-green-50 dark:bg-green-950/20" : "bg-muted/40"
              )}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-muted-foreground">
                    Row {listingB.row_index || "—"}
                  </span>
                  <span className="font-mono text-sm font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 px-2 py-0.5 rounded">
                    {listingB.id}
                  </span>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded font-semibold",
                    listingB.status?.toUpperCase() === "AVAILABLE" 
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                  )}>
                    {listingB.status || "UNKNOWN"}
                  </span>
                </div>

                {selectedOriginal === "B" ? (
                  <span className="inline-flex items-center gap-1 rounded bg-green-600 text-white text-xs font-bold px-2.5 py-1">
                    <CheckCircle2 className="h-3 w-3" />
                    ORIGINAL
                  </span>
                ) : selectedOriginal === "A" ? (
                  <span className="inline-flex items-center gap-1 rounded bg-red-600 text-white text-xs font-bold px-2.5 py-1">
                    DUPLICATE
                  </span>
                ) : (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleSelectOriginal("B")}
                    className="h-7 text-xs border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                  >
                    Mark as Original
                  </Button>
                )}
              </div>

              {/* Listing Details */}
              <CardContent className="p-4 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm border-b pb-3">
                    <div>
                      <span className="text-xs text-muted-foreground block">Location</span>
                      <span className="font-medium">{listingB.barangay || listingB.city ? `${listingB.barangay || ""}, ${listingB.city || ""}` : "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Price / Lease</span>
                      <span className="font-medium">
                        {listingB.price ? `₱${listingB.price.toLocaleString()}` : listingB.lease_price ? `₱${listingB.lease_price.toLocaleString()}/mo` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Lot / Floor Area</span>
                      <span className="font-medium">
                        {listingB.lot_area ? `${listingB.lot_area} sqm` : "—"} / {listingB.floor_area ? `${listingB.floor_area} sqm` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Ownership / Contact</span>
                      <span className="font-medium text-xs truncate max-w-full block">
                        {listingB.listing_ownership || "—"} ({listingB.owner_broker || "Direct"})
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block font-semibold">Description Text:</span>
                    <Textarea
                      value={descB}
                      onChange={(e) => {
                        const newVal = e.target.value;
                        setDescB(newVal);
                        if (selectedOriginal === "A" && listingA && listingB && listingA.row_index) {
                          const initialText = getUpdatedDuplicateDescription(newVal, listingB.id, listingA.row_index, listingA.id);
                          setEditedDuplicateText(initialText);
                        }
                      }}
                      className="font-mono text-xs min-h-[250px] bg-background border-purple-500/20 focus-visible:ring-purple-600"
                      placeholder="Edit description text here..."
                    />
                  </div>
                </div>

                {listingB.photo_link && (
                  <div className="pt-2 border-t flex justify-end">
                    <Button variant="link" size="sm" asChild className="p-0 h-auto text-purple-600">
                      <a href={listingB.photo_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> View Google Photos
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </div>
          </div>

          {/* Action Confirmation Panel */}
          {selectedOriginal && originalListing && duplicateListing && (
            <Card className="border-2 border-orange-500/30 bg-orange-50/10 dark:bg-orange-950/10 shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-foreground font-bold">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  Confirm Duplicate Declaration
                </CardTitle>
                <CardDescription>
                  You are marking <strong>{duplicateListing.id}</strong> (Row {duplicateListing.row_index}) as a duplicate of original listing <strong>{originalListing.id}</strong> (Row {originalListing.row_index}).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground block font-semibold">
                    Preview of Duplicate's New GSheet and Database Text:
                  </span>
                  <Textarea
                    value={editedDuplicateText}
                    onChange={(e) => setEditedDuplicateText(e.target.value)}
                    className="font-mono text-xs min-h-[160px] bg-background border-orange-200/50 dark:border-orange-900/50 focus-visible:ring-orange-500"
                    placeholder="Edit duplicate's description text here..."
                  />
                  <p className="text-xs text-foreground">
                    ℹ️ Prepending this duplicate tag will automatically filter this listing out from all dashboard search panels. It will also format Row {duplicateListing.row_index} in the Google Sheet (A:Q) to have a black background and bold white text.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedOriginal(null)}
                    disabled={isSaving}
                    className="flex-1 h-11"
                  >
                    Change Selection
                  </Button>
                  <Button
                    onClick={handleSaveDuplicate}
                    disabled={isSaving}
                    className="flex-1 h-11 bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-600/10"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Writing to DBASE & Supabase...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Confirm & Save Duplicate
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {/* Success Page State */}
      {saveSuccess && originalListing && duplicateListing && (
        <Card className="border-2 border-green-500 shadow-xl max-w-2xl mx-auto bg-green-50/5">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center pb-4">
              <div className="p-3 bg-green-100 dark:bg-green-950/50 rounded-full text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-12 w-12" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-green-700 dark:text-green-400">
              Duplicates Marked Successfully!
            </CardTitle>
            <CardDescription className="text-base">
              Listing <strong>{duplicateListing.id}</strong> (Row {duplicateListing.row_index}) is now labeled as a duplicate of <strong>{originalListing.id}</strong> (Row {originalListing.row_index}).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4 text-center">
            <div className="text-sm space-y-2 border-t border-b py-4 px-2 bg-muted/30 rounded-lg max-w-md mx-auto text-left">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Original ID:</span>
                <span className="font-mono font-bold">{originalListing.id} (Row {originalListing.row_index})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duplicate ID:</span>
                <span className="font-mono font-bold text-red-600 dark:text-red-400">{duplicateListing.id} (Row {duplicateListing.row_index})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status in Supabase:</span>
                <span className="font-semibold text-green-600">Updated</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status in Google Sheets:</span>
                <span className="font-semibold text-green-600">Formatted & Tagged</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto pt-2">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => {
                  // Keep the original GEO ID but clear the duplicate input to compare against a new duplicate
                  if (selectedOriginal === "B") {
                    setGeoIdA(geoIdB);
                    setListingA(listingB);
                    setDescA(descB);
                  }
                  setGeoIdB("");
                  setListingB(null);
                  setDescB("");
                  setSelectedOriginal(null);
                  setSaveSuccess(false);
                }}
              >
                Keep {originalListing.id} & Compare Another
              </Button>
              <Button
                className="flex-1 h-11 bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleReset}
              >
                Compare New Pair
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

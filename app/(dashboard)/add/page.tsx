"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ArrowRight, Check, ClipboardPaste, Search, Loader2, Sparkles, AlertCircle, CheckCircle2, Copy, Save, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import { SupabaseListing } from "@/lib/supabase";
import { APP_VERSION } from "@/lib/version";

type Step = "paste" | "check" | "review";

const STATUS_MAP: Record<string, string> = {
  "available": "AVAILABLE",
  "sold": "SOLD",
  "leased": "LEASED OUT",
  "leased out": "LEASED OUT",
  "on hold": "ON HOLD",
  "off market": "OFF MARKET",
};
const normalizeStatus = (raw: string): string =>
  STATUS_MAP[raw.toLowerCase().trim()] ?? raw.toUpperCase();

// Format number with commas for display
const formatNumber = (value: string | number | null): string => {
  if (!value) return "";
  const num = typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
  if (isNaN(num)) return String(value);
  return num.toLocaleString("en-US");
};

// Parse formatted number back to plain number string
const parseFormattedNumber = (value: string): string => {
  return value.replace(/,/g, "");
};

// Get today's date in YYYY-MM-DD format
const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

export default function AddListingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("paste");
  const [rawText, setRawText] = useState("");
  const [photosLink, setPhotosLink] = useState("");
  const [previewLines, setPreviewLines] = useState("");

  // Property type checkboxes
  const [residential, setResidential] = useState(false);
  const [commercial, setCommercial] = useState(false);
  const [industrial, setIndustrial] = useState(false);
  const [agricultural, setAgricultural] = useState(false);

  // Additional Info fields
  const [withIncome, setWithIncome] = useState("");
  const [directOrCobroker, setDirectOrCobroker] = useState<"Direct to Owner" | "With Cobroker" | "">("");
  const [ownerBroker, setOwnerBroker] = useState("");
  const [howManyAway, setHowManyAway] = useState("");
  const [listingOwnership, setListingOwnership] = useState("");
  const [saleOrLease, setSaleOrLease] = useState<"Sale" | "Lease" | "Sale/Lease" | "">("");
  const [dateReceived, setDateReceived] = useState("");
  const [dateUpdated, setDateUpdated] = useState(() => new Date().toISOString().split('T')[0]);
  const [originalDateUpdated, setOriginalDateUpdated] = useState("");
  const [available, setAvailable] = useState("");
  const [todayToggle, setTodayToggle] = useState(false);

  // MORE INFO fields (Supabase only)
  const [fbLink, setFbLink] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [salePricePerSqm, setSalePricePerSqm] = useState("");
  const [leasePricePerSqm, setLeasePricePerSqm] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [lat, setLat] = useState("");
  const [long, setLong] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [toilet, setToilet] = useState("");
  const [garage, setGarage] = useState("");
  const [amenities, setAmenities] = useState("");
  const [corner, setCorner] = useState("");
  const [compound, setCompound] = useState("");
  const [comments, setComments] = useState("");
  const [sponsorStart, setSponsorStart] = useState("");
  const [sponsorEnd, setSponsorEnd] = useState("");

  // Editable listing fields (from search result)
  const [editSummary, setEditSummary] = useState("");
  const [useExistingMain, setUseExistingMain] = useState(false);
  const [editArea, setEditArea] = useState("");
  const [editBarangay, setEditBarangay] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editLotArea, setEditLotArea] = useState("");
  const [editFloorArea, setEditFloorArea] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editLeasePrice, setEditLeasePrice] = useState("");
  // Keep these for update API but don't show in compact view
  const [editRegion, setEditRegion] = useState("");
  const [editProvince, setEditProvince] = useState("");
  const [editBuilding, setEditBuilding] = useState("");
  const [editType, setEditType] = useState("");
  const [editStatus, setEditStatus] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SupabaseListing | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [listingId, setListingId] = useState("");
  const [matchedBy, setMatchedBy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [suggestedGeoId, setSuggestedGeoId] = useState("");
  const [newGeoId, setNewGeoId] = useState("");
  const [geoIdConfirmed, setGeoIdConfirmed] = useState(false);

  const steps: { key: Step; label: string; number: number }[] = [
    { key: "paste", label: "Paste Listing", number: 1 },
    { key: "check", label: "Check & Info", number: 2 },
    { key: "review", label: "Review & Save", number: 3 },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      setRawText(clipboardText);
    } catch (err) {
      setError("Failed to read from clipboard");
    }
  };

  const handleExtractData = async () => {
    if (!rawText.trim()) {
      setError("Please enter a listing to parse");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to parse listing");
      }

      // Populate edit fields from parsed data.
      // For existing listings: only override if Claude actually extracted a value,
      // so we don't blank out fields that were already loaded from the existing record.
      const overrideIfFound = (extracted: string, setter: (v: string) => void, current: string) => {
        if (extracted) setter(extracted);
        else if (!current) setter(""); // only blank if it was already blank
      };

      if (!useExistingMain) setEditSummary(rawText);
      overrideIfFound(data.region, setEditRegion, editRegion);
      if (data.region?.trim().toUpperCase() === "NCR") setEditProvince("Metro Manila");
      else overrideIfFound(data.province, setEditProvince, editProvince);
      overrideIfFound(data.city, setEditCity, editCity);
      overrideIfFound(data.barangay, setEditBarangay, editBarangay);
      overrideIfFound(data.area, setEditArea, editArea);
      overrideIfFound(data.building, setEditBuilding, editBuilding);
      overrideIfFound(data.lotArea, setEditLotArea, editLotArea);
      overrideIfFound(data.floorArea, setEditFloorArea, editFloorArea);
      overrideIfFound(data.salePrice, setEditPrice, editPrice);
      overrideIfFound(data.leasePrice, setEditLeasePrice, editLeasePrice);
      overrideIfFound(data.type, setEditType, editType);
      if (data.status) setEditStatus(normalizeStatus(data.status));
      overrideIfFound(data.type, setPropertyType, propertyType);
      overrideIfFound(data.bedrooms, setBedrooms, bedrooms);
      overrideIfFound(data.toilets, setToilet, toilet);
      overrideIfFound(data.garage, setGarage, garage);
      overrideIfFound(data.amenities, setAmenities, amenities);
      if (data.corner) setCorner("Yes");
      if (data.compound) setCompound("Yes");
      if (data.withIncome === true) setWithIncome("With Income");
      else if (data.withIncome === false) setWithIncome("NO");
      overrideIfFound(data.salePricePerSqm, setSalePricePerSqm, salePricePerSqm);
      overrideIfFound(data.leasePricePerSqm, setLeasePricePerSqm, leasePricePerSqm);
      overrideIfFound(data.lat, setLat, lat);
      overrideIfFound(data.long, setLong, long);
      overrideIfFound(data.mapLink, setMapLink, mapLink);

      // Set property type checkboxes from parsed data (only enable, never disable existing)
      if (data.residential) setResidential(true);
      if (data.commercial) setCommercial(true);
      if (data.industrial) setIndustrial(true);
      if (data.agricultural) setAgricultural(true);

      // Re-detect Sale/Lease from raw text if still empty (handleSearch resets it)
      setSaleOrLease(prev => {
        if (prev) return prev;
        if (/\*?FOR\s+(SALE\s*(AND|\/|&)\s*LEASE|SALE\/LEASE)\*?/i.test(rawText)) return "Sale/Lease";
        if (/\*?FOR\s+LEASE\*?/i.test(rawText)) return "Lease";
        if (/\*?FOR\s+SALE\*?/i.test(rawText)) return "Sale";
        return "";
      });

      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse listing");
    } finally {
      setLoading(false);
    }
  };

  const extractPhotosAndPreview = () => {
    // Try to find photos link (prefer URLs with photos/photo/goo.gl in them)
    const photosUrlMatch = rawText.match(/https?:\/\/[^\s]*(?:photos|photo|goo\.gl)[^\s]*/i);
    const anyUrlMatch = rawText.match(/https?:\/\/[^\s]+/i);
    const foundLink = photosUrlMatch ? photosUrlMatch[0] : (anyUrlMatch ? anyUrlMatch[0] : "");
    setPhotosLink(foundLink);

    // Try to extract listing ID (pattern like G09893, L12345, etc.)
    const idMatch = rawText.match(/^([A-Z]\d{4,6})\b/m);
    if (idMatch) {
      setListingId(idMatch[1]);
    } else {
      setListingId("");
    }

    // Extract Sale/Lease from raw text (look for *FOR SALE*, *FOR LEASE*, etc.)
    if (/\*?FOR\s+(SALE\s*(AND|\/|&)\s*LEASE|SALE\/LEASE)\*?/i.test(rawText)) {
      setSaleOrLease("Sale/Lease");
    } else if (/\*?FOR\s+LEASE\*?/i.test(rawText)) {
      setSaleOrLease("Lease");
    } else if (/\*?FOR\s+SALE\*?/i.test(rawText)) {
      setSaleOrLease("Sale");
    }

    // Get first 10 non-empty lines for search (prioritizes 5th, 4th, 3rd lines)
    const lines = rawText.split('\n').filter(line => line.trim()).slice(0, 10);
    setPreviewLines(lines.join('\n'));
  };

  // Clear all editable fields
  const clearEditFields = () => {
    setEditSummary("");
    setEditArea("");
    setEditBarangay("");
    setEditCity("");
    setEditLotArea("");
    setEditFloorArea("");
    setEditPrice("");
    setEditLeasePrice("");
    setEditRegion("");
    setEditProvince("");
    setEditBuilding("");
    setEditType("");
    setEditStatus("");
    setResidential(false);
    setCommercial(false);
    setIndustrial(false);
    setAgricultural(false);
    setWithIncome("");
    setDirectOrCobroker("");
    setOwnerBroker("");
    setHowManyAway("");
    setListingOwnership("");
    setSaleOrLease("");
    setDateReceived("");
    setDateUpdated(new Date().toISOString().split('T')[0]);
    setOriginalDateUpdated("");
    setAvailable("");
    setTodayToggle(false);
    // MORE INFO fields
    setFbLink("");
    setMapLink("");
    setSalePricePerSqm("");
    setLeasePricePerSqm("");
    setPropertyType("");
    setLat("");
    setLong("");
    setBedrooms("");
    setToilet("");
    setGarage("");
    setAmenities("");
    setCorner("");
    setCompound("");
    setComments("");
    setSponsorStart("");
    setSponsorEnd("");
  };

  const goToStep = (targetStep: Step) => {
    if (targetStep === "check") {
      extractPhotosAndPreview();
      setSearchResult(null);
      setSearchPerformed(false);
      setMatchedBy(null);
      clearEditFields();
    }
    if (targetStep === "paste") {
      clearEditFields();
      setUseExistingMain(false);
    }
    setStep(targetStep);
    setError(null);
  };

  const handleSearch = useCallback(async () => {
    if (!photosLink && !listingId && !previewLines) {
      setError("No data available to search");
      return;
    }

    setSearching(true);
    setError(null);
    setSearchResult(null);
    setMatchedBy(null);

    // Clear edit fields before new search
    setEditSummary("");
    setEditArea("");
    setEditBarangay("");
    setEditCity("");
    setEditLotArea("");
    setEditFloorArea("");
    setEditPrice("");
    setEditLeasePrice("");
    setEditRegion("");
    setEditProvince("");
    setEditBuilding("");
    setEditType("");
    setEditStatus("");
    setResidential(false);
    setCommercial(false);
    setIndustrial(false);
    setAgricultural(false);
    setWithIncome("");
    setDirectOrCobroker("");
    setOwnerBroker("");
    setHowManyAway("");
    setListingOwnership("");
    setSaleOrLease("");
    setDateReceived("");
    setDateUpdated(new Date().toISOString().split('T')[0]);
    setOriginalDateUpdated("");
    setAvailable("");
    setTodayToggle(false);
    // MORE INFO fields
    setFbLink("");
    setMapLink("");
    setSalePricePerSqm("");
    setLeasePricePerSqm("");
    setPropertyType("");
    setLat("");
    setLong("");
    setBedrooms("");
    setToilet("");
    setGarage("");
    setAmenities("");
    setCorner("");
    setCompound("");
    setComments("");
    setSponsorStart("");
    setSponsorEnd("");
    setSuggestedGeoId("");
    setNewGeoId("");
    setGeoIdConfirmed(false);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoLink: photosLink,
          listingId: listingId,
          previewText: previewLines,
        }),
      });
      const data = await response.json();
      console.log("Search response:", data);
      setSearchResult(data.result);
      setMatchedBy(data.matchedBy || null);
      setSearchPerformed(true);

      // If no match found, fetch the next suggested GEO ID
      if (!data.result) {
        try {
          const geoRes = await fetch("/api/next-geo-id");
          const geoData = await geoRes.json();
          if (geoData.geoId) {
            setSuggestedGeoId(geoData.geoId);
            setNewGeoId(geoData.geoId);
          }
        } catch {
          // Non-critical — silently ignore
        }
      }
    } catch (err) {
      setError("Failed to search. Please try again.");
    } finally {
      setSearching(false);
    }
  }, [photosLink, listingId, previewLines]);

  // Keep Map Link in sync with lat/long coordinates
  useEffect(() => {
    if (lat && long) {
      setMapLink(`https://www.google.com/maps/search/?api=1&query=${lat},${long}`);
    }
  }, [lat, long]);

  // Auto-trigger search when entering Step 2
  useEffect(() => {
    if (step === "check" && !searchPerformed && (photosLink || listingId || previewLines)) {
      handleSearch();
    }
  }, [step, searchPerformed, photosLink, listingId, previewLines, handleSearch]);

  // Auto-fill fields from search result
  useEffect(() => {
    if (searchResult) {
      // Populate editable listing fields
      setEditSummary(searchResult.summary || "");
      setUseExistingMain(false);
      setEditArea(searchResult.area || "");
      setEditBarangay(searchResult.barangay || "");
      setEditCity(searchResult.city || "");
      setEditLotArea(searchResult.lot_area ? searchResult.lot_area.toString() : "");
      setEditFloorArea(searchResult.floor_area ? searchResult.floor_area.toString() : "");
      // Route price to correct field based on sale_or_lease
      if (searchResult.sale_or_lease === "Lease") {
        setEditPrice("");
        setEditLeasePrice(
          searchResult.lease_price ? searchResult.lease_price.toString() :
          searchResult.price ? searchResult.price.toString() : ""
        );
      } else {
        setEditPrice(searchResult.price ? searchResult.price.toString() : "");
        setEditLeasePrice(searchResult.lease_price ? searchResult.lease_price.toString() : "");
      }
      setEditRegion(searchResult.region || "");
      setEditProvince(searchResult.province || "");
      setEditBuilding(searchResult.building || "");
      setEditStatus(normalizeStatus(searchResult.status || ""));

      // Property type - build from individual fields or use type_description
      const propertyTypes = [
        searchResult.residential && "RESIDENTIAL",
        searchResult.commercial && "COMMERCIAL",
        searchResult.industrial && "INDUSTRIAL",
        searchResult.agricultural && "AGRICULTURAL"
      ].filter(Boolean).join(", ");
      setEditType(propertyTypes || searchResult.type_description || "");

      // Property type checkboxes - values can be "Yes", "TRUE", or the type name itself (e.g., "RESIDENTIAL")
      setResidential(!!searchResult.residential && searchResult.residential.length > 0);
      setCommercial(!!searchResult.commercial && searchResult.commercial.length > 0);
      setIndustrial(!!searchResult.industrial && searchResult.industrial.length > 0);
      setAgricultural(!!searchResult.agricultural && searchResult.agricultural.length > 0);

      // Sale or Lease
      if (searchResult.sale_or_lease) {
        const val = searchResult.sale_or_lease.toLowerCase();
        if (val.includes('sale') && val.includes('lease')) setSaleOrLease('Sale/Lease');
        else if (val.includes('lease')) setSaleOrLease('Lease');
        else if (val.includes('sale')) setSaleOrLease('Sale');
        else setSaleOrLease('');
      } else {
        setSaleOrLease('');
      }

      // Populate additional info fields
      setWithIncome(searchResult.with_income || "");

      if (searchResult.direct_or_broker) {
        const val = searchResult.direct_or_broker.toLowerCase();
        if (val.includes('direct')) setDirectOrCobroker('Direct to Owner');
        else if (val.includes('cobroker') || val.includes('broker')) setDirectOrCobroker('With Cobroker');
        else setDirectOrCobroker('');
      } else {
        setDirectOrCobroker('');
      }

      setOwnerBroker(searchResult.owner_broker || '');
      setHowManyAway(searchResult.how_many_away || '');
      setListingOwnership(searchResult.listing_ownership || '');
      setDateReceived(searchResult.date_received || '');
      const originalDate = searchResult.date_updated || new Date().toISOString().split('T')[0];
      setDateUpdated(originalDate);
      setOriginalDateUpdated(originalDate);
      setAvailable(searchResult.available || "");

      // MORE INFO fields
      setFbLink(searchResult.fb_link || "");
      const loadedLat = searchResult.lat || "";
      const loadedLong = searchResult.long || "";
      setLat(loadedLat);
      setLong(loadedLong);
      // Derive map link from coordinates; fall back to stored value
      setMapLink(
        loadedLat && loadedLong
          ? `https://www.google.com/maps/search/?api=1&query=${loadedLat},${loadedLong}`
          : searchResult.map_link || ""
      );
      setSalePricePerSqm(searchResult.sale_price_per_sqm ? searchResult.sale_price_per_sqm.toString() : "");
      setLeasePricePerSqm(searchResult.lease_price_per_sqm ? searchResult.lease_price_per_sqm.toString() : "");
      setPropertyType(searchResult.property_type || "");
      setBedrooms(searchResult.bedrooms || "");
      setToilet(searchResult.toilet || "");
      setGarage(searchResult.garage || "");
      setAmenities(searchResult.amenities || "");
      setCorner(searchResult.corner || "");
      setCompound(searchResult.compound || "");
      setComments(searchResult.comments || "");
      setSponsorStart(searchResult.sponsor_start || "");
      setSponsorEnd(searchResult.sponsor_end || "");
    }
  }, [searchResult]);

  const canProceedFromPaste = rawText.trim().length > 0;

  // Auto-toggle today and set date when any input changes
  const handleInputChange = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    if (!todayToggle) {
      setTodayToggle(true);
      setDateUpdated(getTodayDate());
    }
  };

  // Toggle today button manually
  const handleTodayToggle = () => {
    if (todayToggle) {
      setTodayToggle(false);
      // Restore original date when toggled off
      setDateUpdated(originalDateUpdated || getTodayDate());
    } else {
      setTodayToggle(true);
      setDateUpdated(getTodayDate());
    }
  };

  // Directly perform the update without confirmation
  const handleUpdateExisting = () => {
    if (!searchResult) return;
    confirmUpdate();
  };

  // Actually perform the update after confirmation
  const confirmUpdate = async () => {
    if (!searchResult) return;

    setUpdating(true);
    setError(null);

    try {
      const response = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: searchResult.id,
          region: editRegion,
          province: editProvince,
          city: editCity,
          barangay: editBarangay,
          area: editArea,
          building: editBuilding,
          type_description: editType,
          status: editStatus,
          lot_area: editLotArea ? parseFloat(editLotArea) : null,
          floor_area: editFloorArea ? parseFloat(editFloorArea) : null,
          price: editPrice ? parseFloat(editPrice) : null,
          lease_price: editLeasePrice ? parseFloat(editLeasePrice) : null,
          summary: useExistingMain ? editSummary : (rawText || editSummary),
          residential: residential ? "RESIDENTIAL" : "",
          commercial: commercial ? "COMMERCIAL" : "",
          industrial: industrial ? "INDUSTRIAL" : "",
          agricultural: agricultural ? "AGRICULTURAL" : "",
          with_income: withIncome,
          direct_or_broker: directOrCobroker,
          owner_broker: ownerBroker,
          how_many_away: howManyAway,
          listing_ownership: listingOwnership,
          sale_or_lease: saleOrLease,
          date_received: dateReceived,
          date_updated: dateUpdated,
          available: available,
          // MORE INFO fields
          fb_link: fbLink,
          map_link: mapLink,
          sale_price_per_sqm: salePricePerSqm ? parseFloat(salePricePerSqm) : null,
          lease_price_per_sqm: leasePricePerSqm ? parseFloat(leasePricePerSqm) : null,
          property_type: propertyType,
          lat: lat,
          long: long,
          bedrooms: bedrooms,
          toilet: toilet,
          garage: garage,
          amenities: amenities,
          corner: corner,
          compound: compound,
          comments: comments,
          sponsor_start: sponsorStart,
          sponsor_end: sponsorEnd,
          photo_link: photosLink,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update listing");
      }

      if (result.warning) {
        console.warn("Update warning:", result.warning);
      }

      // Success - redirect
      alert(`✅ Listing ${searchResult.id} updated successfully in GSheet and Supabase.`);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update listing");
    } finally {
      setUpdating(false);
    }
  };

  // Add the new listing
  const confirmAddNew = async () => {
    setAdding(true);
    setError(null);

    try {
      const response = await fetch("/api/add-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: editRegion,
          province: editProvince,
          city: editCity,
          barangay: editBarangay,
          area: editArea,
          building: editBuilding,
          type_description: editType || propertyType,
          status: editStatus || "AVAILABLE",
          lot_area: editLotArea ? parseFloat(editLotArea) : null,
          floor_area: editFloorArea ? parseFloat(editFloorArea) : null,
          price: editPrice ? parseFloat(editPrice) : null,
          lease_price: editLeasePrice ? parseFloat(editLeasePrice) : null,
          summary: rawText, // Use the raw pasted text
          residential: residential ? "RESIDENTIAL" : "",
          commercial: commercial ? "COMMERCIAL" : "",
          industrial: industrial ? "INDUSTRIAL" : "",
          agricultural: agricultural ? "AGRICULTURAL" : "",
          with_income: withIncome,
          direct_or_broker: directOrCobroker,
          owner_broker: ownerBroker,
          how_many_away: howManyAway,
          listing_ownership: listingOwnership,
          sale_or_lease: saleOrLease,
          date_received: dateReceived || new Date().toISOString().split("T")[0],
          date_updated: dateUpdated || new Date().toISOString().split("T")[0],
          fb_link: fbLink,
          map_link: mapLink,
          sale_price_per_sqm: salePricePerSqm ? parseFloat(salePricePerSqm) : null,
          lease_price_per_sqm: leasePricePerSqm ? parseFloat(leasePricePerSqm) : null,
          lat: lat,
          long: long,
          bedrooms: bedrooms,
          toilet: toilet,
          garage: garage,
          amenities: amenities,
          corner: corner,
          compound: compound,
          comments: comments,
          photo_link: photosLink,
          geo_id: newGeoId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add listing");
      }

      // Success - go to main page
      alert(`New listing created: ${data.geoId}`);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add listing");
    } finally {
      setAdding(false);
    }
  };

  const handleDone = () => {
    // Clear all state
    setRawText("");
    setPhotosLink("");
    setPreviewLines("");
    setResidential(false);
    setCommercial(false);
    setIndustrial(false);
    setAgricultural(false);
    setWithIncome("");
    setDirectOrCobroker("");
    setOwnerBroker("");
    setHowManyAway("");
    setListingOwnership("");
    setSaleOrLease("");
    setDateReceived("");
    setDateUpdated(new Date().toISOString().split('T')[0]);
    setOriginalDateUpdated("");
    setAvailable("");
    setTodayToggle(false);
    setEditSummary("");
    setEditArea("");
    setEditBarangay("");
    setEditCity("");
    setEditLotArea("");
    setEditFloorArea("");
    setEditPrice("");
    setEditLeasePrice("");
    setEditRegion("");
    setEditProvince("");
    setEditBuilding("");
    setEditType("");
    setEditStatus("");
    // MORE INFO fields
    setFbLink("");
    setMapLink("");
    setSalePricePerSqm("");
    setLeasePricePerSqm("");
    setPropertyType("");
    setLat("");
    setLong("");
    setBedrooms("");
    setToilet("");
    setGarage("");
    setAmenities("");
    setCorner("");
    setCompound("");
    setComments("");
    setSponsorStart("");
    setSponsorEnd("");
    setSearchResult(null);
    setSearchPerformed(false);
    setListingId("");
    setMatchedBy(null);
    setUseExistingMain(false);
    setError(null);

    // Go to main page
    router.push("/");
  };

  // Line-by-line diff: renders targetText (DB) with red for lines not found in sourceText (raw paste)
  const renderDiffText = (sourceText: string, targetText: string) => {
    const srcLineSet = new Set(
      sourceText.split("\n").map((l) => l.trim()).filter(Boolean)
    );
    const tgtLines = targetText.split("\n");
    return tgtLines.map((line, i) => {
      const isDiff = line.trim() !== "" && !srcLineSet.has(line.trim());
      return (
        <div key={i} className={isDiff ? "text-red-500 font-medium" : ""}>
          {line || "\u00A0"}
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add New Listing {APP_VERSION}</h1>
        <p className="text-muted-foreground">
          {step === "paste" && "Paste your raw listing text"}
          {step === "check" && "Verify listing and enter additional info"}
          {step === "review" && "Review and edit the extracted data before saving"}
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <div
              className={`flex items-center gap-2 ${step === s.key ? "text-primary" : currentStepIndex > i ? "text-primary" : "text-muted-foreground"
                }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${step === s.key
                  ? "bg-primary text-primary-foreground"
                  : currentStepIndex > i
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                  }`}
              >
                {currentStepIndex > i ? <Check className="h-4 w-4" /> : s.number}
              </span>
              <span className="font-medium hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className="h-px w-8 sm:w-16 bg-border mx-2" />}
          </div>
        ))}
      </div>

      {/* Step 1: Paste */}
      {step === "paste" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardPaste className="h-5 w-5" />
              Step 1: Paste Raw Listing
            </CardTitle>
            <CardDescription>
              Paste the raw property listing text from your source
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Textarea
                placeholder={`G04339
*FOR SALE*
1421 M. Hizon St., Sta. Cruz, Manila
Four Storey Building with an Ongoing Dormitory Business
Price: Php39,000,000
Photos: https://photos.app.goo.gl/example`}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={12}
                className="resize-none font-mono text-sm"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={handlePaste}
                type="button"
              >
                <ClipboardPaste className="h-4 w-4 mr-1" />
                Paste
              </Button>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setRawText("");
                  setError(null);
                }}
              >
                Clear
              </Button>
              <Button onClick={() => goToStep("check")} disabled={!canProceedFromPaste}>
                Next: Check & Info
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Check if New + Additional Info */}
      {step === "check" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 items-start">
          {/* LEFT: Search / Listing Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Check if Existing Listing
              </CardTitle>
              <CardDescription>
                Verify this is a new listing before proceeding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preview of listing */}
              <div className="space-y-2">
                <Label>Listing Preview</Label>
                <div className="bg-muted p-3 rounded-md font-mono text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {rawText || "No preview available"}
                </div>
                {listingId && (
                  <p className="text-sm text-muted-foreground">
                    Detected Listing ID: <span className="font-semibold text-foreground">{listingId}</span>
                  </p>
                )}
              </div>

              {/* Search Result */}
              {searching && (
                <div className="p-4 rounded-md border border-blue-300 bg-blue-50">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="font-semibold">Searching for existing listing...</span>
                  </div>
                </div>
              )}
              {searchPerformed && !searching && (
                <>
                  {searchResult ? (
                    <div className="p-4 rounded-md border border-yellow-500 bg-yellow-50">
                      <div className="flex items-center gap-2 text-yellow-700">
                        <AlertCircle className="h-5 w-5" />
                        <div>
                          <span className="font-semibold">
                            Existing Listing Found!
                            {matchedBy && <span className="font-normal text-xs ml-2">(matched by {matchedBy})</span>}
                          </span>
                          <p className="text-sm font-normal mt-1">Pre-filled from existing listing - modify if needed</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-md border border-green-500 bg-green-50">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-semibold">No existing listing found - this appears to be new!</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleSearch} disabled={searching || (!photosLink && !listingId && !previewLines)}>
                  {searching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Search Again
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => goToStep("paste")}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* RIGHT: Existing Listing Info */}
          {searchResult && (
            <Card className={useExistingMain ? "border-green-500 ring-1 ring-green-500" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Listing ID: {searchResult.id}</CardTitle>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="mainSource"
                      checked={useExistingMain}
                      onChange={() => setUseExistingMain(true)}
                      className="h-4 w-4 accent-green-600 cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-green-700">USE THIS LISTING</span>
                  </label>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* MAIN: diff view or editable textarea */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">MAIN</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(editSummary);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      type="button"
                      className={`h-6 px-2 ${copied ? "text-green-600" : ""}`}
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  {useExistingMain ? (
                    <Textarea
                      value={editSummary}
                      onChange={(e) => setEditSummary(e.target.value)}
                      className="font-mono text-xs min-h-64 leading-relaxed resize-y"
                    />
                  ) : (
                    <div className="bg-muted p-3 rounded-md font-mono text-xs max-h-64 overflow-y-auto leading-relaxed">
                      {renderDiffText(rawText, editSummary)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          </div>{/* end grid */}

          {/* Full-width: form fields for existing listing */}
          {searchResult && (
            <Card>
              <CardContent className="space-y-3 pt-4">
                {/* Compact Form Grid - Horizontal Layout */}
                <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                  {/* Row 1 - Type checkboxes span full width */}
                  <div className="col-span-3 flex items-center gap-6 flex-wrap">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Type</Label>
                    <div className="flex items-center gap-2">
                      <Checkbox id="residential" checked={residential} onCheckedChange={(checked) => handleInputChange(setResidential)(!!checked)} />
                      <label htmlFor="residential" className="text-xs font-medium cursor-pointer">RESIDENTIAL</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="commercial" checked={commercial} onCheckedChange={(checked) => handleInputChange(setCommercial)(!!checked)} />
                      <label htmlFor="commercial" className="text-xs font-medium cursor-pointer">COMMERCIAL</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="industrial" checked={industrial} onCheckedChange={(checked) => handleInputChange(setIndustrial)(!!checked)} />
                      <label htmlFor="industrial" className="text-xs font-medium cursor-pointer">INDUSTRIAL</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="agricultural" checked={agricultural} onCheckedChange={(checked) => handleInputChange(setAgricultural)(!!checked)} />
                      <label htmlFor="agricultural" className="text-xs font-medium cursor-pointer">AGRICULTURAL</label>
                    </div>
                  </div>
                  {/* Row 1: SALE/LEASE, AREA, CITY */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Sale/Lease</Label>
                    <Select value={saleOrLease} onValueChange={(v) => handleInputChange(setSaleOrLease)(v as "Sale" | "Lease" | "Sale/Lease" | "")}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sale">Sale</SelectItem>
                        <SelectItem value="Lease">Lease</SelectItem>
                        <SelectItem value="Sale/Lease">Sale/Lease</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Area</Label>
                    <Input value={[editBarangay, editArea].filter(Boolean).join(", ")} onChange={(e) => handleInputChange(setEditArea)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">City</Label>
                    <Input value={editCity} onChange={(e) => handleInputChange(setEditCity)(e.target.value)} className="h-8 text-sm" />
                  </div>

                  {/* Row 2: LOT AREA, FLOOR AREA, PRICE */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Lot Area</Label>
                    <Input value={formatNumber(editLotArea)} onChange={(e) => handleInputChange(setEditLotArea)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Floor Area</Label>
                    <Input value={formatNumber(editFloorArea)} onChange={(e) => handleInputChange(setEditFloorArea)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Price</Label>
                    <Input value={formatNumber(editPrice || editLeasePrice)} onChange={(e) => handleInputChange(setEditPrice)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>

                  {/* Row 3 */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Direct/Co</Label>
                    <Select value={directOrCobroker} onValueChange={(v) => handleInputChange(setDirectOrCobroker)(v as "Direct to Owner" | "With Cobroker" | "")}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Direct to Owner">Direct</SelectItem>
                        <SelectItem value="With Cobroker">Cobroker</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Broker</Label>
                    <Input value={ownerBroker} onChange={(e) => handleInputChange(setOwnerBroker)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Away</Label>
                    <Input value={howManyAway} onChange={(e) => handleInputChange(setHowManyAway)(e.target.value)} className="h-8 text-sm" />
                  </div>

                  {/* Row 4 */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Received</Label>
                    <Input type="date" value={dateReceived} onChange={(e) => handleInputChange(setDateReceived)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Updated</Label>
                    <Input type="date" value={dateUpdated} onChange={(e) => setDateUpdated(e.target.value)} className="h-8 text-sm flex-1" />
                    <Button
                      type="button"
                      variant={todayToggle ? "default" : "outline"}
                      size="sm"
                      onClick={handleTodayToggle}
                      className="h-8 px-2 text-xs shrink-0"
                    >
                      TODAY
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Ownership</Label>
                    <Input value={listingOwnership} onChange={(e) => handleInputChange(setListingOwnership)(e.target.value)} className="h-8 text-sm" />
                  </div>

                  {/* Row 5: Income + Photos Link */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Income</Label>
                    <Select value={withIncome} onValueChange={(v) => handleInputChange(setWithIncome)(v)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="With Income">With Income</SelectItem>
                        <SelectItem value="NO">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">
                      {photosLink ? "Photos (extracted)" : "Photos Link"}
                    </Label>
                    <Input
                      type="url"
                      placeholder="https://photos.app.goo.gl/..."
                      value={photosLink}
                      onChange={(e) => {
                        setPhotosLink(e.target.value);
                        setSearchPerformed(false);
                        setSearchResult(null);
                      }}
                      className="h-8 text-sm"
                    />
                  </div>
                  {/* Status radio buttons span full width */}
                  <div className="col-span-3 flex items-center gap-4 flex-wrap">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Status</Label>
                    <span className="text-xs min-w-[100px] font-medium">
                      {editStatus || "—"}
                    </span>
                    {["AVAILABLE", "LEASED OUT", "SOLD", "ON HOLD", "OFF MARKET"].map((status) => (
                      <div key={status} className="flex items-center gap-1">
                        <input
                          type="radio"
                          id={`status-${status}`}
                          name="status"
                          checked={editStatus === status}
                          onChange={() => handleInputChange(setEditStatus)(status)}
                          className="h-3 w-3 cursor-pointer"
                        />
                        <label htmlFor={`status-${status}`} className="text-xs cursor-pointer whitespace-nowrap">
                          {status}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* MORE INFO Section */}
                <div className="pt-3 border-t">
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground">MORE INFO</h4>
                  <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                  {/* Row 1: GEO ID | FB LINK */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">GEO ID</Label>
                    <span className="text-sm font-semibold font-mono">{searchResult.id}</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">FB Link</Label>
                    <Input value={fbLink} onChange={(e) => handleInputChange(setFbLink)(e.target.value)} className="h-8 text-sm" />
                  </div>

                  {/* Row 2: TYPE | MAP LINK */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Type</Label>
                    <Select value={propertyType} onValueChange={(v) => handleInputChange(setPropertyType)(v)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TOWNHOUSE">TOWNHOUSE</SelectItem>
                        <SelectItem value="WAREHOUSE">WAREHOUSE</SelectItem>
                        <SelectItem value="VACANT LOT">VACANT LOT</SelectItem>
                        <SelectItem value="HOUSE AND LOT">HOUSE AND LOT</SelectItem>
                        <SelectItem value="CONDO">CONDO</SelectItem>
                        <SelectItem value="OFFICE/COMMERCIAL">OFFICE/COMMERCIAL</SelectItem>
                        <SelectItem value="BUILDING">BUILDING</SelectItem>
                        <SelectItem value="CLUB SHARE">CLUB SHARE</SelectItem>
                        <SelectItem value="BUSINESS">BUSINESS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Map Link</Label>
                    <Input value={mapLink} onChange={(e) => handleInputChange(setMapLink)(e.target.value)} className="h-8 text-sm" />
                  </div>

                  {/* Row 3: REGION, PROVINCE, CITY */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Region</Label>
                    <Input value={editRegion} onChange={(e) => { const v = e.target.value; handleInputChange(setEditRegion)(v); if (v.trim().toUpperCase() === "NCR") handleInputChange(setEditProvince)("Metro Manila"); }} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Province</Label>
                    <Input value={editProvince} onChange={(e) => handleInputChange(setEditProvince)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">City</Label>
                    <Input value={editCity} onChange={(e) => handleInputChange(setEditCity)(e.target.value)} className="h-8 text-sm" />
                  </div>

                  {/* Row 3: BARANGAY, AREA, BUILDING */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Barangay</Label>
                    <Input value={editBarangay} onChange={(e) => handleInputChange(setEditBarangay)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Area</Label>
                    <Input value={editArea} onChange={(e) => handleInputChange(setEditArea)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Building</Label>
                    <Input value={editBuilding} onChange={(e) => handleInputChange(setEditBuilding)(e.target.value)} className="h-8 text-sm" />
                  </div>

                  {/* Row 5: LOT AREA, EXTRACTED SALE PRICE, SALE/SQM */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Lot Area</Label>
                    <Input value={formatNumber(editLotArea)} onChange={(e) => handleInputChange(setEditLotArea)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Sale Price</Label>
                    <Input value={formatNumber(editPrice)} onChange={(e) => handleInputChange(setEditPrice)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Sale/Sqm</Label>
                    <Input value={formatNumber(salePricePerSqm)} onChange={(e) => handleInputChange(setSalePricePerSqm)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>

                  {/* Row 6: FLOOR AREA, EXTRACTED LEASE PRICE, LEASE/SQM */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Floor Area</Label>
                    <Input value={formatNumber(editFloorArea)} onChange={(e) => handleInputChange(setEditFloorArea)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Lease Price</Label>
                    <Input value={formatNumber(editLeasePrice)} onChange={(e) => handleInputChange(setEditLeasePrice)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Lease/Sqm</Label>
                    <Input value={formatNumber(leasePricePerSqm)} onChange={(e) => handleInputChange(setLeasePricePerSqm)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>

                  {/* Row 7: LAT, LONG, LAT LONG */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Lat</Label>
                    <Input value={lat} onChange={(e) => handleInputChange(setLat)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Long</Label>
                    <Input value={long} onChange={(e) => handleInputChange(setLong)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Lat/Long</Label>
                    <span className="text-xs">{lat && long ? `${lat}, ${long}` : "—"}</span>
                  </div>

                  {/* Row 8: bedrooms, toilet, garage */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Bedrooms</Label>
                    <Input value={bedrooms} onChange={(e) => handleInputChange(setBedrooms)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Toilet</Label>
                    <Input value={toilet} onChange={(e) => handleInputChange(setToilet)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Garage</Label>
                    <Input value={garage} onChange={(e) => handleInputChange(setGarage)(e.target.value)} className="h-8 text-sm" />
                  </div>

                  {/* Row 9: amenities, corner, compound */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Amenities</Label>
                    <Input value={amenities} onChange={(e) => handleInputChange(setAmenities)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Corner</Label>
                    <Input value={corner} onChange={(e) => handleInputChange(setCorner)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Compound</Label>
                    <Input value={compound} onChange={(e) => handleInputChange(setCompound)(e.target.value)} className="h-8 text-sm" />
                  </div>

                  {/* Row 10: COMMENTS, SPONSOR START, SPONSOR END */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Comments</Label>
                    <Input value={comments} onChange={(e) => handleInputChange(setComments)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Sponsor Start</Label>
                    <Input type="date" value={sponsorStart} onChange={(e) => handleInputChange(setSponsorStart)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Sponsor End</Label>
                    <Input type="date" value={sponsorEnd} onChange={(e) => handleInputChange(setSponsorEnd)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Additional Info Section - Only show if NO search result */}
          {!searchResult && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">New Listing Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Compact Form Grid */}
                <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                  {/* Type checkboxes span full width */}
                  <div className="col-span-3 flex items-center gap-6 flex-wrap">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Type</Label>
                    <div className="flex items-center gap-2">
                      <Checkbox id="new-residential" checked={residential} onCheckedChange={(checked) => handleInputChange(setResidential)(!!checked)} />
                      <label htmlFor="new-residential" className="text-xs font-medium cursor-pointer">RESIDENTIAL</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="new-commercial" checked={commercial} onCheckedChange={(checked) => handleInputChange(setCommercial)(!!checked)} />
                      <label htmlFor="new-commercial" className="text-xs font-medium cursor-pointer">COMMERCIAL</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="new-industrial" checked={industrial} onCheckedChange={(checked) => handleInputChange(setIndustrial)(!!checked)} />
                      <label htmlFor="new-industrial" className="text-xs font-medium cursor-pointer">INDUSTRIAL</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="new-agricultural" checked={agricultural} onCheckedChange={(checked) => handleInputChange(setAgricultural)(!!checked)} />
                      <label htmlFor="new-agricultural" className="text-xs font-medium cursor-pointer">AGRICULTURAL</label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Sale/Lease</Label>
                    <Select value={saleOrLease} onValueChange={(v) => handleInputChange(setSaleOrLease)(v as "Sale" | "Lease" | "Sale/Lease" | "")}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sale">Sale</SelectItem>
                        <SelectItem value="Lease">Lease</SelectItem>
                        <SelectItem value="Sale/Lease">Sale/Lease</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Direct/Co</Label>
                    <Select value={directOrCobroker} onValueChange={(v) => handleInputChange(setDirectOrCobroker)(v as "Direct to Owner" | "With Cobroker" | "")}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Direct to Owner">Direct</SelectItem>
                        <SelectItem value="With Cobroker">Cobroker</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Broker</Label>
                    <Input value={ownerBroker} onChange={(e) => handleInputChange(setOwnerBroker)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Away</Label>
                    <Input value={howManyAway} onChange={(e) => handleInputChange(setHowManyAway)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Received</Label>
                    <Input type="date" value={dateReceived} onChange={(e) => handleInputChange(setDateReceived)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Ownership</Label>
                    <Input value={listingOwnership} onChange={(e) => handleInputChange(setListingOwnership)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Income</Label>
                    <Select value={withIncome} onValueChange={(v) => handleInputChange(setWithIncome)(v)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="With Income">With Income</SelectItem>
                        <SelectItem value="NO">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">
                      {photosLink ? "Photos (extracted)" : "Photos Link"}
                    </Label>
                    <Input
                      type="url"
                      placeholder="https://photos.app.goo.gl/..."
                      value={photosLink}
                      onChange={(e) => setPhotosLink(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  {/* Status radio buttons span full width */}
                  <div className="col-span-3 flex items-center gap-4 flex-wrap">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Status</Label>
                    <span className="text-xs min-w-[100px] font-medium">
                      {editStatus || "—"}
                    </span>
                    {["AVAILABLE", "LEASED OUT", "SOLD", "ON HOLD", "OFF MARKET"].map((status) => (
                      <div key={status} className="flex items-center gap-1">
                        <input
                          type="radio"
                          id={`new-status-${status}`}
                          name="new-status"
                          checked={editStatus === status}
                          onChange={() => handleInputChange(setEditStatus)(status)}
                          className="h-3 w-3 cursor-pointer"
                        />
                        <label htmlFor={`new-status-${status}`} className="text-xs cursor-pointer whitespace-nowrap">
                          {status}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* MORE INFO Section */}
                <div className="pt-3 border-t">
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground">MORE INFO</h4>
                  <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                  {/* Row 1: GEO ID | FB LINK */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">GEO ID</Label>
                    <span className="text-sm font-semibold font-mono">{newGeoId || "—"}</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">FB Link</Label>
                    <Input value={fbLink} onChange={(e) => handleInputChange(setFbLink)(e.target.value)} className="h-8 text-sm" />
                  </div>

                  {/* Row 2: TYPE | MAP LINK */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Type</Label>
                    <Select value={propertyType} onValueChange={(v) => handleInputChange(setPropertyType)(v)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TOWNHOUSE">TOWNHOUSE</SelectItem>
                        <SelectItem value="WAREHOUSE">WAREHOUSE</SelectItem>
                        <SelectItem value="VACANT LOT">VACANT LOT</SelectItem>
                        <SelectItem value="HOUSE AND LOT">HOUSE AND LOT</SelectItem>
                        <SelectItem value="CONDO">CONDO</SelectItem>
                        <SelectItem value="OFFICE/COMMERCIAL">OFFICE/COMMERCIAL</SelectItem>
                        <SelectItem value="BUILDING">BUILDING</SelectItem>
                        <SelectItem value="CLUB SHARE">CLUB SHARE</SelectItem>
                        <SelectItem value="BUSINESS">BUSINESS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Map Link</Label>
                    <Input value={mapLink} onChange={(e) => handleInputChange(setMapLink)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  {/* Row 3: REGION, PROVINCE, CITY */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Region</Label>
                    <Input value={editRegion} onChange={(e) => { const v = e.target.value; handleInputChange(setEditRegion)(v); if (v.trim().toUpperCase() === "NCR") handleInputChange(setEditProvince)("Metro Manila"); }} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Province</Label>
                    <Input value={editProvince} onChange={(e) => handleInputChange(setEditProvince)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">City</Label>
                    <Input value={editCity} onChange={(e) => handleInputChange(setEditCity)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  {/* Row 3: BARANGAY, AREA, BUILDING */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Barangay</Label>
                    <Input value={editBarangay} onChange={(e) => handleInputChange(setEditBarangay)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Area</Label>
                    <Input value={editArea} onChange={(e) => handleInputChange(setEditArea)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Building</Label>
                    <Input value={editBuilding} onChange={(e) => handleInputChange(setEditBuilding)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  {/* Row 4: LOT AREA, SALE PRICE, SALE/SQM */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Lot Area</Label>
                    <Input value={formatNumber(editLotArea)} onChange={(e) => handleInputChange(setEditLotArea)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Sale Price</Label>
                    <Input value={formatNumber(editPrice)} onChange={(e) => handleInputChange(setEditPrice)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Sale/Sqm</Label>
                    <Input value={formatNumber(salePricePerSqm)} onChange={(e) => handleInputChange(setSalePricePerSqm)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>
                  {/* Row 5: FLOOR AREA, LEASE PRICE, LEASE/SQM */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Floor Area</Label>
                    <Input value={formatNumber(editFloorArea)} onChange={(e) => handleInputChange(setEditFloorArea)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Lease Price</Label>
                    <Input value={formatNumber(editLeasePrice)} onChange={(e) => handleInputChange(setEditLeasePrice)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Lease/Sqm</Label>
                    <Input value={formatNumber(leasePricePerSqm)} onChange={(e) => handleInputChange(setLeasePricePerSqm)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>
                  {/* Row 6: LAT, LONG, LAT/LONG */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Lat</Label>
                    <Input value={lat} onChange={(e) => handleInputChange(setLat)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Long</Label>
                    <Input value={long} onChange={(e) => handleInputChange(setLong)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Lat/Long</Label>
                    <span className="text-xs">{lat && long ? `${lat}, ${long}` : "—"}</span>
                  </div>
                  {/* Row 7: BEDROOMS, TOILET, GARAGE */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Bedrooms</Label>
                    <Input value={bedrooms} onChange={(e) => handleInputChange(setBedrooms)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Toilet</Label>
                    <Input value={toilet} onChange={(e) => handleInputChange(setToilet)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Garage</Label>
                    <Input value={garage} onChange={(e) => handleInputChange(setGarage)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  {/* Row 8: AMENITIES, CORNER, COMPOUND */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Amenities</Label>
                    <Input value={amenities} onChange={(e) => handleInputChange(setAmenities)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Corner</Label>
                    <Input value={corner} onChange={(e) => handleInputChange(setCorner)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Compound</Label>
                    <Input value={compound} onChange={(e) => handleInputChange(setCompound)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  {/* Row 9: COMMENTS, SPONSOR START, SPONSOR END */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Comments</Label>
                    <Input value={comments} onChange={(e) => handleInputChange(setComments)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Sponsor Start</Label>
                    <Input type="date" value={sponsorStart} onChange={(e) => handleInputChange(setSponsorStart)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Sponsor End</Label>
                    <Input type="date" value={sponsorEnd} onChange={(e) => handleInputChange(setSponsorEnd)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="flex justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => goToStep("paste")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button variant="secondary" onClick={handleDone}>
                <Home className="mr-2 h-4 w-4" />
                Done
              </Button>
            </div>
            <div className="flex gap-2">
              {searchResult && (
                <Button
                  onClick={handleUpdateExisting}
                  disabled={updating}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {updating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Update Existing
                    </>
                  )}
                </Button>
              )}
              {!searchResult && searchPerformed && (
                <div className="flex flex-col gap-2 items-end">
                  {/* GEO ID row with confirm checkbox */}
                  <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/40">
                    <Checkbox
                      id="geo-id-confirm"
                      checked={geoIdConfirmed}
                      onCheckedChange={(c) => setGeoIdConfirmed(!!c)}
                    />
                    <label htmlFor="geo-id-confirm" className="text-xs text-muted-foreground font-medium cursor-pointer whitespace-nowrap">
                      GEO ID
                    </label>
                    <Input
                      value={newGeoId}
                      onChange={(e) => { setNewGeoId(e.target.value.toUpperCase()); setGeoIdConfirmed(false); }}
                      className="h-8 w-28 text-sm font-mono font-bold"
                      placeholder="G00000"
                    />
                    {suggestedGeoId && newGeoId !== suggestedGeoId && (
                      <button
                        type="button"
                        onClick={() => { setNewGeoId(suggestedGeoId); setGeoIdConfirmed(false); }}
                        className="text-xs text-muted-foreground hover:text-foreground underline whitespace-nowrap"
                      >
                        use {suggestedGeoId}
                      </button>
                    )}
                    {geoIdConfirmed && (
                      <span className="text-xs text-green-600 font-medium whitespace-nowrap">✓ NEW LISTING CONFIRMED</span>
                    )}
                  </div>
                </div>
              )}
              <Button onClick={handleExtractData} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Extract & Review
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Review & Save */}
      {step === "review" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-lg">
                Review Extracted Data
                {(searchResult?.id || newGeoId) && (
                  <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-bold rounded font-mono">
                    {searchResult?.id || newGeoId}
                  </span>
                )}
              </CardTitle>
              <CardDescription>Review and edit the extracted data before saving</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* MAIN Summary with Copy */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">MAIN</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(editSummary);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    type="button"
                    className={`h-6 px-2 ${copied ? "text-green-600" : ""}`}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  value={editSummary}
                  onChange={(e) => handleInputChange(setEditSummary)(e.target.value)}
                  rows={12}
                  className="font-mono text-xs"
                />
              </div>

              {/* Compact Form Grid */}
              <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                {/* Type checkboxes span full width */}
                <div className="col-span-3 flex items-center gap-6 flex-wrap">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Type</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox id="review-residential" checked={residential} onCheckedChange={(checked) => handleInputChange(setResidential)(!!checked)} />
                    <label htmlFor="review-residential" className="text-xs font-medium cursor-pointer">RESIDENTIAL</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="review-commercial" checked={commercial} onCheckedChange={(checked) => handleInputChange(setCommercial)(!!checked)} />
                    <label htmlFor="review-commercial" className="text-xs font-medium cursor-pointer">COMMERCIAL</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="review-industrial" checked={industrial} onCheckedChange={(checked) => handleInputChange(setIndustrial)(!!checked)} />
                    <label htmlFor="review-industrial" className="text-xs font-medium cursor-pointer">INDUSTRIAL</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="review-agricultural" checked={agricultural} onCheckedChange={(checked) => handleInputChange(setAgricultural)(!!checked)} />
                    <label htmlFor="review-agricultural" className="text-xs font-medium cursor-pointer">AGRICULTURAL</label>
                  </div>
                </div>

                {/* Row 1: SALE/LEASE, AREA, CITY */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Sale/Lease</Label>
                  <Select value={saleOrLease} onValueChange={(v) => handleInputChange(setSaleOrLease)(v as "Sale" | "Lease" | "Sale/Lease" | "")}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sale">Sale</SelectItem>
                      <SelectItem value="Lease">Lease</SelectItem>
                      <SelectItem value="Sale/Lease">Sale/Lease</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Area</Label>
                  <Input value={[editBarangay, editArea].filter(Boolean).join(", ")} onChange={(e) => handleInputChange(setEditArea)(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">City</Label>
                  <Input value={editCity} onChange={(e) => handleInputChange(setEditCity)(e.target.value)} className="h-8 text-sm" />
                </div>

                {/* Row 2: LOT AREA, FLOOR AREA, PRICE */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Lot Area</Label>
                  <Input value={formatNumber(editLotArea)} onChange={(e) => handleInputChange(setEditLotArea)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Floor Area</Label>
                  <Input value={formatNumber(editFloorArea)} onChange={(e) => handleInputChange(setEditFloorArea)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Price</Label>
                  <Input value={formatNumber(editPrice || editLeasePrice)} onChange={(e) => handleInputChange(setEditPrice)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                </div>

                {/* Row 3 */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Direct/Co</Label>
                  <Select value={directOrCobroker} onValueChange={(v) => handleInputChange(setDirectOrCobroker)(v as "Direct to Owner" | "With Cobroker" | "")}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Direct to Owner">Direct</SelectItem>
                      <SelectItem value="With Cobroker">Cobroker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Broker</Label>
                  <Input value={ownerBroker} onChange={(e) => handleInputChange(setOwnerBroker)(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Away</Label>
                  <Input value={howManyAway} onChange={(e) => handleInputChange(setHowManyAway)(e.target.value)} className="h-8 text-sm" />
                </div>

                {/* Row 4 */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Received</Label>
                  <Input type="date" value={dateReceived} onChange={(e) => handleInputChange(setDateReceived)(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Updated</Label>
                  <Input type="date" value={dateUpdated} onChange={(e) => setDateUpdated(e.target.value)} className="h-8 text-sm flex-1" />
                  <Button
                    type="button"
                    variant={todayToggle ? "default" : "outline"}
                    size="sm"
                    onClick={handleTodayToggle}
                    className="h-8 px-2 text-xs shrink-0"
                  >
                    TODAY
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Ownership</Label>
                  <Input value={listingOwnership} onChange={(e) => handleInputChange(setListingOwnership)(e.target.value)} className="h-8 text-sm" />
                </div>

                {/* Row 5 */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Income</Label>
                  <Select value={withIncome} onValueChange={(v) => handleInputChange(setWithIncome)(v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="With Income">With Income</SelectItem>
                      <SelectItem value="NO">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">
                    {photosLink ? "Photos (extracted)" : "Photos Link"}
                  </Label>
                  <Input
                    type="url"
                    placeholder="https://photos.app.goo.gl/..."
                    value={photosLink}
                    onChange={(e) => setPhotosLink(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                {/* Status radio buttons span full width */}
                <div className="col-span-3 flex items-center gap-4 flex-wrap">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Status</Label>
                  <span className="text-xs min-w-[100px] font-medium">
                    {editStatus || "—"}
                  </span>
                  {["AVAILABLE", "LEASED OUT", "SOLD", "ON HOLD", "OFF MARKET"].map((status) => (
                    <div key={status} className="flex items-center gap-1">
                      <input
                        type="radio"
                        id={`review-status-${status}`}
                        name="review-status"
                        checked={editStatus === status}
                        onChange={() => handleInputChange(setEditStatus)(status)}
                        className="h-3 w-3 cursor-pointer"
                      />
                      <label htmlFor={`review-status-${status}`} className="text-xs cursor-pointer whitespace-nowrap">
                        {status}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* MORE INFO Section */}
              <div className="pt-3 border-t">
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground">MORE INFO</h4>
                <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                  {/* Row 1: GEO ID | FB LINK */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">GEO ID</Label>
                    <span className="text-sm font-semibold font-mono">{searchResult?.id || newGeoId || "—"}</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">FB Link</Label>
                    <Input value={fbLink} onChange={(e) => handleInputChange(setFbLink)(e.target.value)} className="h-8 text-sm" />
                  </div>

                  {/* Row 2: TYPE | MAP LINK */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Type</Label>
                    <Select value={propertyType} onValueChange={(v) => handleInputChange(setPropertyType)(v)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TOWNHOUSE">TOWNHOUSE</SelectItem>
                        <SelectItem value="WAREHOUSE">WAREHOUSE</SelectItem>
                        <SelectItem value="VACANT LOT">VACANT LOT</SelectItem>
                        <SelectItem value="HOUSE AND LOT">HOUSE AND LOT</SelectItem>
                        <SelectItem value="CONDO">CONDO</SelectItem>
                        <SelectItem value="OFFICE/COMMERCIAL">OFFICE/COMMERCIAL</SelectItem>
                        <SelectItem value="BUILDING">BUILDING</SelectItem>
                        <SelectItem value="CLUB SHARE">CLUB SHARE</SelectItem>
                        <SelectItem value="BUSINESS">BUSINESS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Map Link</Label>
                    <Input value={mapLink} onChange={(e) => handleInputChange(setMapLink)(e.target.value)} className="h-8 text-sm" />
                  </div>

                  {/* Row 3: REGION, PROVINCE, CITY */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Region</Label>
                    <Input value={editRegion} onChange={(e) => { const v = e.target.value; handleInputChange(setEditRegion)(v); if (v.trim().toUpperCase() === "NCR") handleInputChange(setEditProvince)("Metro Manila"); }} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Province</Label>
                    <Input value={editProvince} onChange={(e) => handleInputChange(setEditProvince)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">City</Label>
                    <Input value={editCity} onChange={(e) => handleInputChange(setEditCity)(e.target.value)} className="h-8 text-sm" />
                  </div>

                  {/* Row 3: BARANGAY, AREA, BUILDING */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Barangay</Label>
                    <Input value={editBarangay} onChange={(e) => handleInputChange(setEditBarangay)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Area</Label>
                    <Input value={editArea} onChange={(e) => handleInputChange(setEditArea)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Building</Label>
                    <Input value={editBuilding} onChange={(e) => handleInputChange(setEditBuilding)(e.target.value)} className="h-8 text-sm" />
                  </div>

                  {/* Row 4: LOT AREA, SALE PRICE, SALE/SQM */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Lot Area</Label>
                    <Input value={formatNumber(editLotArea)} onChange={(e) => handleInputChange(setEditLotArea)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Sale Price</Label>
                    <Input value={formatNumber(editPrice)} onChange={(e) => handleInputChange(setEditPrice)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Sale/Sqm</Label>
                    <Input value={formatNumber(salePricePerSqm)} onChange={(e) => handleInputChange(setSalePricePerSqm)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>

                  {/* Row 5: FLOOR AREA, LEASE PRICE, LEASE/SQM */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Floor Area</Label>
                    <Input value={formatNumber(editFloorArea)} onChange={(e) => handleInputChange(setEditFloorArea)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Lease Price</Label>
                    <Input value={formatNumber(editLeasePrice)} onChange={(e) => handleInputChange(setEditLeasePrice)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Lease/Sqm</Label>
                    <Input value={formatNumber(leasePricePerSqm)} onChange={(e) => handleInputChange(setLeasePricePerSqm)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>

                  {/* Row 6: LAT, LONG, LAT LONG */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Lat</Label>
                    <Input value={lat} onChange={(e) => handleInputChange(setLat)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Long</Label>
                    <Input value={long} onChange={(e) => handleInputChange(setLong)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Lat/Long</Label>
                    <span className="text-xs">{lat && long ? `${lat}, ${long}` : "—"}</span>
                  </div>

                  {/* Row 7: bedrooms, toilet, garage */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Bedrooms</Label>
                    <Input value={bedrooms} onChange={(e) => handleInputChange(setBedrooms)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Toilet</Label>
                    <Input value={toilet} onChange={(e) => handleInputChange(setToilet)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Garage</Label>
                    <Input value={garage} onChange={(e) => handleInputChange(setGarage)(e.target.value)} className="h-8 text-sm" />
                  </div>

                  {/* Row 8: amenities, corner, compound */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Amenities</Label>
                    <Input value={amenities} onChange={(e) => handleInputChange(setAmenities)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Corner</Label>
                    <Input value={corner} onChange={(e) => handleInputChange(setCorner)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Compound</Label>
                    <Input value={compound} onChange={(e) => handleInputChange(setCompound)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  {/* Row 9: comments, sponsor start, sponsor end */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Comments</Label>
                    <Input value={comments} onChange={(e) => handleInputChange(setComments)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Sponsor Start</Label>
                    <Input type="date" value={sponsorStart} onChange={(e) => handleInputChange(setSponsorStart)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Sponsor End</Label>
                    <Input type="date" value={sponsorEnd} onChange={(e) => handleInputChange(setSponsorEnd)(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => goToStep("check")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Check & Info
            </Button>
            <div className="flex gap-2">
              <Button
                onClick={() => { searchResult ? confirmUpdate() : confirmAddNew(); }}
                disabled={updating || adding}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {(updating || adding) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Update Listing
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

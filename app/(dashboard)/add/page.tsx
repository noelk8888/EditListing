"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ArrowRight, Check, ClipboardPaste, Search, Loader2, Sparkles, AlertCircle, CheckCircle2, Copy, Save, Home, Plus, X, Send, Trash2, Play, Pause } from "lucide-react";
import { useRouter } from "next/navigation";
import { SupabaseListing } from "@/lib/supabase";
import { APP_VERSION } from "@/lib/version";

type Step = "paste" | "check" | "review";

const STATUS_MAP: Record<string, string> = {
  "available": "AVAILABLE",
  "sold": "SOLD",
  "leased": "LEASED OUT",
  "leased out": "LEASED OUT",
  "off market": "OFF MARKET",
  "on hold": "ON HOLD",
  "under nego": "UNDER NEGO",
  "under negotiation": "UNDER NEGO",
  "undecisive seller": "UNDECISIVE SELLER",
  "undecisive": "UNDECISIVE SELLER",
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
  const [dateUpdated, setDateUpdated] = useState("");
  const [originalDateUpdated, setOriginalDateUpdated] = useState("");
  const [available, setAvailable] = useState("");
  const [todayToggle, setTodayToggle] = useState(false);

  // MORE INFO fields (Supabase only)
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
  const [originalEditSummary, setOriginalEditSummary] = useState(""); // snapshot of DB text for toggle-off revert
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [suggestedGeoId, setSuggestedGeoId] = useState("");
  const [newGeoId, setNewGeoId] = useState("");
  const [geoIdConfirmed, setGeoIdConfirmed] = useState(false);

  // === BATCH MODE STATE ===
  type BatchRow = { rowNumber: number; colA: string; colB: string; colC: string; colD: string; colE: string; colF: string; colG: string; colH: string; colI: string; colJ: string; colK: string; colL: string; colM: string; colN: string; colO: string; colP: string; colAC: string };
  const [batchMode, setBatchMode] = useState(false);      // setup panel open
  const [batchSheetUrl, setBatchSheetUrl] = useState("https://docs.google.com/spreadsheets/d/1T-LUc3cKn0ojq1p3VvgpFs4NzB8Z6ZKV4iJaoEhfwKM/edit?gid=1361278820#gid=1361278820");
  const [batchStartRow, setBatchStartRow] = useState("2");
  const [batchEndRow, setBatchEndRow] = useState("50");
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchActive, setBatchActive] = useState(false);      // processing in progress
  const [batchSkips, setBatchSkips] = useState<number[]>([]);
  const [batchPaused, setBatchPaused] = useState(false);
  const batchCurrentRowRef = useRef<BatchRow | null>(null); // GSheet data for current row

  // === TELEGRAM POST STATE ===
  const [telegramPostEnabled, setTelegramPostEnabled] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramLine1, setTelegramLine1] = useState("");
  const [telegramLine2, setTelegramLine2] = useState("");
  const [telegramLine3, setTelegramLine3] = useState("");
  const [telegramGroups, setTelegramGroups] = useState<string[]>(["RESIDENTIAL"]);

  // === PERMISSIONS ===
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // Normalize MM/DD/YYYY or "Month DD, YYYY" → YYYY-MM-DD for date inputs
  const normalizeGSheetDate = (d: string) => {
    if (!d) return "";
    const slash = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slash) return `${slash[3]}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`;
    const MONTH_MAP: Record<string, string> = {
      january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
      july: "07", august: "08", september: "09", october: "10", november: "11", december: "12"
    };
    const spelled = d.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
    if (spelled) {
      const mo = MONTH_MAP[spelled[1].toLowerCase()];
      if (mo) return `${spelled[3]}-${mo}-${spelled[2].padStart(2, '0')}`;
    }
    return d; // already YYYY-MM-DD or unknown format
  };

  useEffect(() => {
    fetch("/api/my-permissions")
      .then((r) => r.json())
      .then((d) => { setPermissions(d.permissions || {}); setPermissionsLoaded(true); })
      .catch(() => setPermissionsLoaded(true));
  }, []);

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
    // When USE THIS LISTING is active, extract from the editable MAIN textarea (editSummary).
    // Otherwise extract from the newly pasted text (rawText).
    const textToExtract = useExistingMain ? editSummary : rawText;
    if (!textToExtract.trim()) {
      setError("Please enter a listing to parse");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToExtract }),
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
      if (data.directOrCobroker === "Direct to Owner" || data.directOrCobroker === "With Cobroker") {
        setDirectOrCobroker(prev => prev || data.directOrCobroker as "Direct to Owner" | "With Cobroker");
      }
      // Use functional setters for fields that may not appear in raw text —
      // preserves Supabase/GSheet values even when called with a stale closure.
      setOwnerBroker(prev => data.ownerBroker || prev);
      setHowManyAway(prev => data.howManyAway || prev);
      setSalePricePerSqm(prev => data.salePricePerSqm || prev);
      setLeasePricePerSqm(prev => data.leasePricePerSqm || prev);
      setLat(prev => data.lat || prev);
      setLong(prev => data.long || prev);
      setMapLink(prev => data.mapLink || prev);

      // Set property type checkboxes from parsed data (only enable, never disable existing)
      if (data.residential) setResidential(true);
      if (data.commercial) setCommercial(true);
      if (data.industrial) setIndustrial(true);
      if (data.agricultural) setAgricultural(true);

      // Detect Sale/Lease from the extracted text (always overrides — uses textToExtract for USE THIS LISTING support)
      setSaleOrLease(prev => {
        if (/\*?FOR\s+(SALE\s*(AND|\/|&)\s*LEASE|SALE\/LEASE)\*?/i.test(textToExtract)) return "Sale/Lease";
        if (/\*?FOR\s+LEASE\*?/i.test(textToExtract)) return "Lease";
        if (/\*?FOR\s+SALE\*?/i.test(textToExtract)) return "Sale";
        return prev;
      });

      // Apply GSheet fallbacks for Columns J-N if in batch mode and AI didn't find them
      const gsheet = batchCurrentRowRef.current;
      if (gsheet) {
        if (!data.dateReceived && gsheet.colM) setDateReceived(normalizeGSheetDate(gsheet.colM));
        if (!data.dateResorted && gsheet.colN) setDateUpdated(normalizeGSheetDate(gsheet.colN));
        if (!data.directOrCobroker && gsheet.colJ) {
          const val = gsheet.colJ.toLowerCase();
          if (val.includes('direct')) setDirectOrCobroker('Direct to Owner');
          else if (val.includes('cobroker') || val.includes('broker')) setDirectOrCobroker('With Cobroker');
        }
        if (!data.ownerBroker && gsheet.colK) setOwnerBroker(gsheet.colK);
        if (!data.howManyAway && gsheet.colL) setHowManyAway(gsheet.colL);
        if (!data.listingOwnership && gsheet.colP) setListingOwnership(gsheet.colP);
        if (!data.status && gsheet.colO) {
          setEditStatus(normalizeStatus(gsheet.colO));
          setAvailable(gsheet.colO);
        }
      }

      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse listing");
    } finally {
      setLoading(false);
    }
  };

  const extractPhotosAndPreview = (sourceText?: string) => {
    const text = sourceText ?? rawText;
    // Try to find photos link (prefer URLs with photos/photo/goo.gl in them)
    const photosUrlMatch = text.match(/https?:\/\/[^\s]*(?:photos|photo|goo\.gl)[^\s]*/i);
    const anyUrlMatch = text.match(/https?:\/\/[^\s]+/i);
    const foundLink = photosUrlMatch ? photosUrlMatch[0] : (anyUrlMatch ? anyUrlMatch[0] : "");
    setPhotosLink(foundLink);

    // Try to extract listing ID (pattern like G09893, L12345, etc.)
    const idMatch = text.match(/^([A-Z]\d{4,6})\b/m);
    if (idMatch) {
      setListingId(idMatch[1]);
    } else {
      setListingId("");
    }

    // Extract Sale/Lease from raw text (look for *FOR SALE*, *FOR LEASE*, etc.)
    if (/\*?FOR\s+(SALE\s*(AND|\/|&)\s*LEASE|SALE\/LEASE)\*?/i.test(text)) {
      setSaleOrLease("Sale/Lease");
    } else if (/\*?FOR\s+LEASE\*?/i.test(text)) {
      setSaleOrLease("Lease");
    } else if (/\*?FOR\s+SALE\*?/i.test(text)) {
      setSaleOrLease("Sale");
    }

    // Get first 10 non-empty lines for search (prioritizes 5th, 4th, 3rd lines)
    const lines = text.split('\n').filter(line => line.trim()).slice(0, 10);
    setPreviewLines(lines.join('\n'));
  };

  // Clear all editable fields
  const clearEditFields = () => {
    setNewGeoId("");
    setSuggestedGeoId("");
    setGeoIdConfirmed(false);
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
    setDateUpdated("");
    setOriginalDateUpdated("");
    setAvailable("");
    setTodayToggle(false);
    // MORE INFO fields
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

  const goToStep = (targetStep: Step, overrideText?: string) => {
    if (targetStep === "check") {
      extractPhotosAndPreview(overrideText);
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
    setNewGeoId("");
    setSuggestedGeoId("");

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
    setDateUpdated("");
    setOriginalDateUpdated("");
    setAvailable("");
    setTodayToggle(false);
    // MORE INFO fields
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

  // BATCH Effect A: load next row when batchIndex changes
  useEffect(() => {
    if (!batchActive || batchRows.length === 0) return;

    // Skip empty colA rows
    let idx = batchIndex;
    const newSkips: number[] = [];
    while (idx < batchRows.length && !batchRows[idx].colA.trim()) {
      newSkips.push(batchRows[idx].rowNumber);
      idx++;
    }
    if (newSkips.length > 0) {
      setBatchSkips(prev => [...prev, ...newSkips]);
      if (idx !== batchIndex) { setBatchIndex(idx); return; }
    }

    if (idx >= batchRows.length) {
      alert(`Batch complete! Processed rows. Skipped ${batchSkips.length + newSkips.length} empty rows.`);
      setBatchActive(false);
      return;
    }

    const row = batchRows[idx];
    batchCurrentRowRef.current = row;     // store GSheet data for fallback
    setRawText(row.colA);
    goToStep("check", row.colA);

    // Pre-fill dates from GSheet col M (Date Received) and col N (Date Updated).
    // Must come AFTER goToStep because goToStep → clearEditFields resets these fields.
    // React batches all setState calls in this effect; last write wins.
    if (row.colM) setDateReceived(normalizeGSheetDate(row.colM));
    if (row.colN) setDateUpdated(normalizeGSheetDate(row.colN));

    // Pre-fill additional fields from GSheet columns B-I, O-P
    if (row.colB) {
      const t = row.colB.toLowerCase();
      if (t.includes('residential')) setResidential(true);
      if (t.includes('commercial')) setCommercial(true);
      if (t.includes('industrial')) setIndustrial(true);
      if (t.includes('agricultural')) setAgricultural(true);
    }
    if (row.colC) setEditArea(row.colC);
    if (row.colD) setEditCity(row.colD);
    if (row.colE) setEditLotArea(row.colE);
    if (row.colF) setEditFloorArea(row.colF);
    if (row.colG) setEditPrice(row.colG);
    if (row.colH) {
      const h = row.colH.toLowerCase();
      if (h.includes('sale') && h.includes('lease')) setSaleOrLease('Sale/Lease');
      else if (h.includes('lease')) setSaleOrLease('Lease');
      else if (h.includes('sale')) setSaleOrLease('Sale');
    }
    if (row.colI) setWithIncome(row.colI);
    if (row.colJ) {
      const val = row.colJ.toLowerCase();
      if (val.includes('direct')) setDirectOrCobroker('Direct to Owner');
      else if (val.includes('cobroker') || val.includes('broker')) setDirectOrCobroker('With Cobroker');
    }
    if (row.colK) setOwnerBroker(row.colK);
    if (row.colL) setHowManyAway(row.colL);
    if (row.colO) setAvailable(row.colO);
    if (row.colO) setEditStatus(normalizeStatus(row.colO));
    if (row.colP) setListingOwnership(row.colP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchActive, batchIndex, batchRows]);

  // Auto-fill fields from search result
  useEffect(() => {
    if (searchResult) {
      // Populate editable listing fields
      setEditSummary(searchResult.summary || "");
      setOriginalEditSummary(searchResult.summary || ""); // snapshot for toggle-off revert
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

      // Apply GSheet display columns as fallbacks when Supabase fields are empty (batch mode)
      const gsheet = batchCurrentRowRef.current;
      setOwnerBroker(searchResult.owner_broker || gsheet?.colK || '');
      setHowManyAway(searchResult.how_many_away || gsheet?.colL || '');
      setListingOwnership(searchResult.listing_ownership || gsheet?.colP || '');
      // Apply GSheet fallbacks for fields B-I, O when Supabase is empty
      if (!searchResult.area && gsheet?.colC) setEditArea(gsheet.colC);
      if (!searchResult.city && gsheet?.colD) setEditCity(gsheet.colD);
      if (!searchResult.lot_area && gsheet?.colE) setEditLotArea(gsheet.colE);
      if (!searchResult.floor_area && gsheet?.colF) setEditFloorArea(gsheet.colF);
      if (!searchResult.price && !searchResult.lease_price && gsheet?.colG) {
        setEditPrice(gsheet.colG);
      }
      if (!searchResult.sale_or_lease && gsheet?.colH) {
        const h = gsheet.colH.toLowerCase();
        if (h.includes('sale') && h.includes('lease')) setSaleOrLease('Sale/Lease');
        else if (h.includes('lease')) setSaleOrLease('Lease');
        else if (h.includes('sale')) setSaleOrLease('Sale');
      }
      if (!searchResult.with_income && gsheet?.colI) setWithIncome(gsheet.colI);
      if (!searchResult.status && gsheet?.colO) {
        setEditStatus(normalizeStatus(gsheet.colO));
        setAvailable(gsheet.colO);
      }
      // Apply GSheet direct_or_broker fallback if Supabase field is empty
      if (!searchResult.direct_or_broker && gsheet?.colJ) {
        const val = gsheet.colJ.toLowerCase();
        if (val.includes('direct')) setDirectOrCobroker('Direct to Owner');
        else if (val.includes('cobroker') || val.includes('broker')) setDirectOrCobroker('With Cobroker');
      }
      setDateReceived(searchResult.date_received || normalizeGSheetDate(gsheet?.colM || '') || '');
      const originalDate = searchResult.date_updated || normalizeGSheetDate(gsheet?.colN || '') || new Date().toISOString().split('T')[0];
      setDateUpdated(originalDate);
      setOriginalDateUpdated(originalDate);
      setAvailable(searchResult.available || "");

      // MORE INFO fields
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

  // Helper: compare if a value is significantly different from Supabase (used in UI highlighting)
  const isDifferent = (current: any, original: any) => {
    if (!original && !current) return false;
    const c = String(current || "").trim().toLowerCase();
    const o = String(original || "").trim().toLowerCase();
    return c !== o;
  };

  // BATCH Auto-Advance Logic — mirrors renderDiffText(rawText, editSummary) exactly
  useEffect(() => {
    if (!batchActive || step !== "check" || !searchResult || searching || batchPaused) return;

    const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
    const isGeoId = (s: string) => /^[A-Z]\d{4,6}$/.test(s.trim());

    // Check DB lines against rawText (the paste) — same logic as renderDiffText
    const normalizedRaw = norm(rawText);
    const dbLines = (searchResult.summary || "")
      .split("\n")
      .filter(l => l.trim() && !isGeoId(l.trim()));
    const textDiff = dbLines.some(line => !normalizedRaw.includes(norm(line)));

    // Also pause when Lot Area, Floor Area, or Price fields are red
    const lotDiff = isDifferent(editLotArea, searchResult.lot_area);
    const floorDiff = isDifferent(editFloorArea, searchResult.floor_area);
    const priceDiff = isDifferent(
      editPrice || editLeasePrice,
      saleOrLease === "Lease" ? searchResult.lease_price : searchResult.price
    );
    const hasDiff = textDiff || lotDiff || floorDiff || priceDiff;

    if (!hasDiff) {
      console.log("⚡ Auto-advancing: no red fields.");
      const timer = setTimeout(() => {
        setBatchIndex(prev => prev + 1);
        setError(null);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      console.log("🛑 Pausing — red fields:", { textDiff, lotDiff, floorDiff, priceDiff });
    }
  }, [batchActive, step, searchResult, searching, rawText, batchPaused, editLotArea, editFloorArea, editPrice, editLeasePrice, saleOrLease]);

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
    if (telegramPostEnabled) {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, "0");
      const month = now.toLocaleDateString("en-US", { month: "short" });
      const year = now.getFullYear();
      const today = `${month} ${day}, ${year}`;
      setTelegramLine1(`*Update ${today}*`);
      setTelegramLine2(editStatus || "");
      setTelegramLine3(ownerBroker);
      const isDirect = directOrCobroker?.toLowerCase().includes("direct");
      const isBusiness = editType?.toLowerCase().includes("business") || propertyType?.toLowerCase().includes("business");
      const autoGroups = [
        ...(isDirect ? ["DIRECT"] : []),
        ...(residential ? ["RESIDENTIAL"] : []),
        ...(commercial ? ["COMMERCIAL"] : []),
        ...(industrial ? ["INDUSTRIAL"] : []),
        ...(agricultural ? ["AGRICULTURAL"] : []),
        ...(isBusiness ? ["BUSINESS FOR SALE"] : []),
      ];
      setTelegramGroups(autoGroups.length > 0 ? autoGroups : ["RESIDENTIAL"]);
      setShowTelegramModal(true);
    } else {
      confirmUpdate();
    }
  };

  const handleTelegramConfirm = () => {
    setShowTelegramModal(false);
    const msg = [telegramLine1, telegramLine2, telegramLine3].filter(Boolean).join("\n");
    if (searchResult) {
      confirmUpdate(msg);
    } else {
      confirmAddNew(msg);
    }
  };

  // Actually perform the update after confirmation
  const confirmUpdate = async (telegramMsg?: string) => {
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
          send_telegram: telegramPostEnabled,
          telegram_post_message: telegramMsg || undefined,
          telegram_groups: telegramGroups,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || "Failed to update listing");
      }

      if (result.warning) {
        console.warn("Update warning:", result.warning);
      }

      // Success
      if (batchActive) {
        setError(null);
        setBatchIndex(prev => prev + 1);
      } else {
        alert(`✅ Listing ${searchResult.id} updated successfully in GSheet and Supabase.`);
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update listing");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteListing = async () => {
    if (!searchResult) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: searchResult.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      alert(`🗑️ Listing ${searchResult.id} has been permanently deleted.`);
      router.push("/add");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  // Directly perform the save without confirmation OR trigger modal
  const handleSaveNew = () => {
    if (telegramPostEnabled) {
      const now = new Date();
      const today = now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
      setTelegramLine1(`*New Listing ${today}*`);
      setTelegramLine2(editStatus || "");
      setTelegramLine3(ownerBroker);
      const isDirect = directOrCobroker?.toLowerCase().includes("direct");
      const isBusiness = editType?.toLowerCase().includes("business") || propertyType?.toLowerCase().includes("business");
      const autoGroups = [
        ...(isDirect ? ["DIRECT"] : []),
        ...(residential ? ["RESIDENTIAL"] : []),
        ...(commercial ? ["COMMERCIAL"] : []),
        ...(industrial ? ["INDUSTRIAL"] : []),
        ...(agricultural ? ["AGRICULTURAL"] : []),
        ...(isBusiness ? ["BUSINESS FOR SALE"] : []),
      ];
      setTelegramGroups(autoGroups.length > 0 ? autoGroups : ["RESIDENTIAL"]);
      setShowTelegramModal(true);
    } else {
      confirmAddNew();
    }
  };

  // Add the new listing
  const confirmAddNew = async (telegramMsg?: string) => {
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
          geo_id: undefined, // always let server generate the correct highest+1
          send_telegram: telegramPostEnabled,
          telegram_post_message: telegramMsg || undefined,
          telegram_groups: telegramGroups,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "Failed to add listing");
      }

      // Success
      if (batchActive) {
        setError(null);
        if (data.geoId) setNewGeoId(data.geoId); // show the actual server-assigned GEO ID briefly
        setBatchIndex(prev => prev + 1);
      } else {
        alert(`New listing created: ${data.geoId}`);
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add listing");
    } finally {
      setAdding(false);
    }
  };

  const handleStartBatch = async () => {
    const start = parseInt(batchStartRow, 10);
    const end = parseInt(batchEndRow, 10);
    if (isNaN(start) || isNaN(end) || start < 2 || end < start) {
      setError("Start row must be ≥ 2 and end row must be ≥ start row");
      return;
    }
    setBatchLoading(true);
    setError(null);
    try {
      const url = new URL("/api/batch-rows", window.location.origin);
      url.searchParams.set("startRow", String(start));
      url.searchParams.set("endRow", String(end));
      if (batchSheetUrl.trim()) url.searchParams.set("sheetUrl", batchSheetUrl.trim());
      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch rows");
      setBatchRows(data.rows);
      setBatchIndex(0);
      setBatchSkips([]);
      setBatchActive(true);
      setBatchMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start batch");
    } finally {
      setBatchLoading(false);
    }
  };

  const handleExitBatch = () => {
    setBatchActive(false);
    setBatchRows([]);
    setBatchIndex(0);
    setBatchSkips([]);
    setRawText("");
    setStep("paste");
    setError(null);
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
    setDateUpdated("");
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
    // Helper to collapse whitespace for comparison
    const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
    const isGeoIdLine = (s: string) => /^[A-Z]\d{4,6}$/.test(s.trim());

    // For better matching, treat the whole source text as one normalized bag of words/phrases
    // but line-by-line for the target display
    const normalizedSource = norm(sourceText);
    const tgtLines = targetText.split("\n");

    return tgtLines.map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i}>&nbsp;</div>;

      // Skip GEO ID line from highlighting
      if (isGeoIdLine(trimmed)) {
        return <div key={i}>{line}</div>;
      }

      // Check if this line (normalized) exists within the normalized source text
      const nLine = norm(trimmed);
      const isDiff = !normalizedSource.includes(nLine);

      return (
        <div key={i} className={isDiff ? "text-red-500 font-medium" : ""}>
          {line}
        </div>
      );
    });
  };

  if (permissionsLoaded && permissions.add_listing === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
        <p className="text-xl font-semibold text-muted-foreground">Access Restricted</p>
        <p className="text-sm text-muted-foreground">You do not have permission to add listings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Batch Progress Banner */}
      {batchActive && (
        <div className="sticky top-0 z-50 bg-slate-900 text-white px-3 py-2 rounded-md shadow-lg">
          <div className="flex items-center justify-between gap-3">
            {/* Left cluster */}
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[12px] font-bold tracking-widest text-slate-300 shrink-0">BATCH</span>
              <div className="w-28 h-1.5 bg-slate-700 rounded-full overflow-hidden shrink-0">
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${Math.round(((batchIndex + 1) / batchRows.length) * 100)}%` }}
                />
              </div>
              <span className="text-[12px] font-mono text-slate-400 shrink-0">
                {batchIndex + 1} / {batchRows.length}{" "}
                <span className="text-[14px] font-bold text-white">(Row {batchRows[batchIndex]?.rowNumber})</span>
              </span>
              {batchRows[batchIndex] && (
                <span className="text-[12px] text-slate-400 shrink-0">
                  <span className="text-slate-600 mx-1">·</span>
                  GEO ID: <span className="font-mono font-bold text-white">{batchRows[batchIndex].colAC || "(new)"}</span>
                  <span className="text-slate-600 mx-1">·</span>
                  Sheet row <span className="font-mono font-bold text-white text-[14px]">#{batchRows[batchIndex].rowNumber}</span>
                </span>
              )}
              {batchSkips.length > 0 && (
                <span className="text-[11px] text-yellow-400 shrink-0">
                  ⚠ Skipped: {batchSkips.join(", ")}
                </span>
              )}
            </div>
            {/* Right cluster */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant={batchPaused ? "default" : "secondary"}
                onClick={() => setBatchPaused(!batchPaused)}
                className="h-7 px-3 text-[12px] font-bold uppercase tracking-wider"
              >
                {batchPaused ? (
                  <>
                    <Play className="mr-1.5 h-3 w-3 fill-current" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="mr-1.5 h-3 w-3 fill-current" />
                    Pause
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white hover:bg-slate-700 h-7 px-2 text-[12px]"
                onClick={handleExitBatch}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Exit Batch
              </Button>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Add New Listing {APP_VERSION}</h1>
          {!batchActive && permissions.batch_review !== false && (
            <button
              onClick={() => setBatchMode(v => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Batch Review Mode"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="text-muted-foreground">
          {step === "paste" && "Paste your raw listing text"}
          {step === "check" && "Verify listing and enter additional info"}
          {step === "review" && "Review and edit the extracted data before saving"}
        </p>
      </div>

      {/* Batch Setup Panel */}
      {batchMode && !batchActive && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold tracking-wide">BATCH REVIEW MODE</span>
            <button onClick={() => setBatchMode(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Fetches col A text from a GSheet row range. Auto-pastes, searches, and extracts each row — you only press Update Listing.
          </p>
          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0">Sheet URL</Label>
            <Input
              type="url"
              placeholder="Paste GSheet URL (leave blank to use default sheet)"
              value={batchSheetUrl}
              onChange={e => setBatchSheetUrl(e.target.value)}
              className="h-8 text-sm flex-1"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">Start Row</Label>
              <Input
                type="number"
                min={2}
                value={batchStartRow}
                onChange={e => setBatchStartRow(e.target.value)}
                className="h-8 w-24 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">End Row</Label>
              <Input
                type="number"
                min={2}
                value={batchEndRow}
                onChange={e => setBatchEndRow(e.target.value)}
                className="h-8 w-24 text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={handleStartBatch}
              disabled={batchLoading}
              className="h-8"
            >
              {batchLoading ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Loading...</>
              ) : (
                <>Start Batch ({Math.max(0, parseInt(batchEndRow || "0") - parseInt(batchStartRow || "0") + 1)} rows)</>
              )}
            </Button>
          </div>
        </div>
      )}

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
                placeholder={`*FOR SALE/LEASE*
Unit 0907 SMDC Blue Residences, Katipunan Ave., Brgy. Loyola Heights, Quezon City
Semi Furnished Studio Unit
Floor Area: 23.12 sqm
Corner Unit, No parking slot
Lease Price: 19,500/month
Price: P4,500,000 gross negotiable
CASH BUYER ONLY
Direct to owner
Photos: https://photos.app.goo.gl/ZVu4EMZiPJkZnrXq6`}
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
                  <div className="bg-muted p-3 rounded-md font-mono text-sm whitespace-pre-wrap">
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
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  {permissions.telegram_send !== false && (
                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm font-medium mr-1">
                      <input
                        type="checkbox"
                        checked={telegramPostEnabled}
                        onChange={() => setTelegramPostEnabled(v => !v)}
                        className="h-4 w-4 accent-blue-600 cursor-pointer"
                      />
                      <Send className="h-3.5 w-3.5 text-blue-600" />
                      TELEGRAM POST
                    </label>
                  )}
                  <Button
                    onClick={handleUpdateExisting}
                    disabled={updating}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {updating ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>
                    ) : (
                      <><Save className="mr-2 h-4 w-4" />Update Existing</>
                    )}
                  </Button>
                  {permissions.ai_extract !== false && (
                    <Button onClick={handleExtractData} disabled={loading} variant="default">
                      {loading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Extracting...</>
                      ) : (
                        <><Sparkles className="mr-2 h-4 w-4" />Extract & Review</>
                      )}
                    </Button>
                  )}
                  {batchActive && batchIndex > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setError(null);
                        setBatchIndex(prev => prev - 1);
                      }}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                  )}
                  {batchActive && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const current = batchRows[batchIndex];
                        if (current) setBatchSkips(prev => [...prev, current.rowNumber]);
                        setError(null);
                        setBatchIndex(prev => prev + 1);
                      }}
                    >
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Card className={useExistingMain ? "border-green-500 ring-1 ring-green-500" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Listing ID: {searchResult.id}</CardTitle>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="mainSource"
                          checked={useExistingMain}
                          onChange={() => { }} // controlled by onClick below
                          onClick={() => {
                            if (useExistingMain) {
                              // Toggle OFF: revert to original DB text
                              setUseExistingMain(false);
                              setEditSummary(originalEditSummary);
                            } else {
                              // Toggle ON: show existing DB text in editable textarea
                              setUseExistingMain(true);
                              // editSummary already = DB text (originalEditSummary), no change needed
                            }
                          }}
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
                        <div className="bg-muted p-3 rounded-md font-mono text-xs leading-relaxed">
                          {renderDiffText(rawText, editSummary)}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
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
                    <Label className={`text-xs w-16 shrink-0 ${searchResult && isDifferent(saleOrLease, searchResult.sale_or_lease) ? "text-red-600 font-bold" : "text-muted-foreground"}`}>Sale/Lease</Label>
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
                    <Label className={`text-xs w-16 shrink-0 ${searchResult && isDifferent(editArea, searchResult.area) ? "text-red-600 font-bold" : "text-muted-foreground"}`}>Area</Label>
                    <Input value={editArea} onChange={(e) => handleInputChange(setEditArea)(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className={`text-xs w-16 shrink-0 ${searchResult && isDifferent(editCity, searchResult.city) ? "text-red-600 font-bold" : "text-muted-foreground"}`}>City</Label>
                    <Input value={editCity} onChange={(e) => handleInputChange(setEditCity)(e.target.value)} className="h-8 text-sm" />
                  </div>

                  {/* Row 2: LOT AREA, FLOOR AREA, PRICE */}
                  <div className="flex items-center gap-2">
                    <Label className={`text-xs w-16 shrink-0 ${searchResult && isDifferent(editLotArea, searchResult.lot_area) ? "text-red-600 font-bold" : "text-muted-foreground"}`}>Lot Area</Label>
                    <Input value={formatNumber(editLotArea)} onChange={(e) => handleInputChange(setEditLotArea)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className={`text-xs w-16 shrink-0 ${searchResult && isDifferent(editFloorArea, searchResult.floor_area) ? "text-red-600 font-bold" : "text-muted-foreground"}`}>Floor Area</Label>
                    <Input value={formatNumber(editFloorArea)} onChange={(e) => handleInputChange(setEditFloorArea)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                  </div>
                  {permissions.view_pricing !== false && (
                    <div className="flex items-center gap-2">
                      <Label className={`text-xs w-16 shrink-0 ${searchResult && isDifferent(editPrice || editLeasePrice, saleOrLease === "Lease" ? searchResult.lease_price : searchResult.price) ? "text-red-600 font-bold" : "text-muted-foreground"}`}>Price</Label>
                      <Input value={formatNumber(editPrice || editLeasePrice)} onChange={(e) => handleInputChange(setEditPrice)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                    </div>
                  )}

                  {/* Row 3 */}
                  {permissions.view_contact !== false && (
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
                  )}
                  {permissions.view_contact !== false && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-16 shrink-0">Broker</Label>
                      <Input value={ownerBroker} onChange={(e) => handleInputChange(setOwnerBroker)(e.target.value)} className="h-8 text-sm" />
                    </div>
                  )}
                  {permissions.view_contact !== false && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-16 shrink-0">Away</Label>
                      <Input value={howManyAway} onChange={(e) => handleInputChange(setHowManyAway)(e.target.value)} className="h-8 text-sm" />
                    </div>
                  )}

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
                    <Label className={`text-xs w-16 shrink-0 ${searchResult && normalizeStatus(editStatus) !== normalizeStatus(searchResult.status || "") ? "text-red-600 font-bold" : "text-muted-foreground"}`}>Status</Label>
                    <span className={`text-xs min-w-[100px] font-medium ${searchResult && normalizeStatus(editStatus) !== normalizeStatus(searchResult.status || "") ? "text-red-600 font-bold" : ""}`}>
                      {editStatus || "—"}
                    </span>
                    {["AVAILABLE", "SOLD", "LEASED OUT", "OFF MARKET", "ON HOLD", "UNDER NEGO", "UNDECISIVE SELLER"].map((status) => (
                      <div key={status} className="flex items-center gap-1">
                        <input
                          type="radio"
                          id={`status-${status}`}
                          name="status"
                          checked={editStatus === status}
                          onChange={() => handleInputChange(setEditStatus)(status)}
                          className="h-3 w-3 cursor-pointer"
                        />
                        <label htmlFor={`status-${status}`} className={`text-xs cursor-pointer whitespace-nowrap ${searchResult && normalizeStatus(status) === normalizeStatus(editStatus) && normalizeStatus(editStatus) !== normalizeStatus(searchResult.status || "") ? "text-red-600 font-bold" : ""}`}>
                          {status}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* MORE INFO Section */}
                <div className="pt-3 border-t">
                  <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                    {/* Row 1: GEO ID | TYPE | MAP LINK */}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-16 shrink-0">GEO ID</Label>
                      <span className="text-sm font-semibold font-mono">{searchResult.id}</span>
                    </div>

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
                    <div className="flex items-center gap-2">
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
                    {permissions.view_pricing !== false && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-16 shrink-0">Sale Price</Label>
                        <Input value={formatNumber(editPrice)} onChange={(e) => handleInputChange(setEditPrice)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                      </div>
                    )}
                    {permissions.view_pricing !== false && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-16 shrink-0">Sale/Sqm</Label>
                        <Input value={formatNumber(salePricePerSqm)} onChange={(e) => handleInputChange(setSalePricePerSqm)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                      </div>
                    )}

                    {/* Row 6: FLOOR AREA, EXTRACTED LEASE PRICE, LEASE/SQM */}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-16 shrink-0">Floor Area</Label>
                      <Input value={formatNumber(editFloorArea)} onChange={(e) => handleInputChange(setEditFloorArea)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                    </div>
                    {permissions.view_pricing !== false && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-16 shrink-0">Lease Price</Label>
                        <Input value={formatNumber(editLeasePrice)} onChange={(e) => handleInputChange(setEditLeasePrice)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                      </div>
                    )}
                    {permissions.view_pricing !== false && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-16 shrink-0">Lease/Sqm</Label>
                        <Input value={formatNumber(leasePricePerSqm)} onChange={(e) => handleInputChange(setLeasePricePerSqm)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                      </div>
                    )}

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
                  {permissions.view_contact !== false && (
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
                  )}
                  {permissions.view_contact !== false && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-16 shrink-0">Broker</Label>
                      <Input value={ownerBroker} onChange={(e) => handleInputChange(setOwnerBroker)(e.target.value)} className="h-8 text-sm" />
                    </div>
                  )}
                  {permissions.view_contact !== false && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-16 shrink-0">Away</Label>
                      <Input value={howManyAway} onChange={(e) => handleInputChange(setHowManyAway)(e.target.value)} className="h-8 text-sm" />
                    </div>
                  )}
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
                    {["AVAILABLE", "SOLD", "LEASED OUT", "OFF MARKET", "ON HOLD", "UNDER NEGO", "UNDECISIVE SELLER"].map((status) => (
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
                  <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                    {/* Row 1: GEO ID | TYPE | MAP LINK */}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-16 shrink-0">GEO ID</Label>
                      <span className="text-sm font-semibold font-mono">{newGeoId || "—"}</span>
                    </div>

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
                    <div className="flex items-center gap-2">
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
                    {permissions.view_pricing !== false && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-16 shrink-0">Sale Price</Label>
                        <Input value={formatNumber(editPrice)} onChange={(e) => handleInputChange(setEditPrice)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                      </div>
                    )}
                    {permissions.view_pricing !== false && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-16 shrink-0">Sale/Sqm</Label>
                        <Input value={formatNumber(salePricePerSqm)} onChange={(e) => handleInputChange(setSalePricePerSqm)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                      </div>
                    )}
                    {/* Row 5: FLOOR AREA, LEASE PRICE, LEASE/SQM */}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-16 shrink-0">Floor Area</Label>
                      <Input value={formatNumber(editFloorArea)} onChange={(e) => handleInputChange(setEditFloorArea)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                    </div>
                    {permissions.view_pricing !== false && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-16 shrink-0">Lease Price</Label>
                        <Input value={formatNumber(editLeasePrice)} onChange={(e) => handleInputChange(setEditLeasePrice)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                      </div>
                    )}
                    {permissions.view_pricing !== false && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-16 shrink-0">Lease/Sqm</Label>
                        <Input value={formatNumber(leasePricePerSqm)} onChange={(e) => handleInputChange(setLeasePricePerSqm)(parseFormattedNumber(e.target.value))} className="h-8 text-sm" />
                      </div>
                    )}
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
            <div className="flex gap-2 items-center">
              {searchResult && permissions.telegram_send !== false && (
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm font-medium mr-1">
                  <input
                    type="checkbox"
                    checked={telegramPostEnabled}
                    onChange={() => setTelegramPostEnabled(v => !v)}
                    className="h-4 w-4 accent-blue-600 cursor-pointer"
                  />
                  <Send className="h-3.5 w-3.5 text-blue-600" />
                  TELEGRAM POST
                </label>
              )}
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
              {permissions.ai_extract !== false && (
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
              )}
              {batchActive && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const current = batchRows[batchIndex];
                    if (current) setBatchSkips(prev => [...prev, current.rowNumber]);
                    setError(null);
                    setBatchIndex(prev => prev + 1);
                  }}
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
              {searchResult && permissions.delete_listing !== false && (
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Review & Save */}
      {step === "review" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-3 text-lg">
                    Review Extracted Data
                    {(searchResult?.id || newGeoId) && (
                      <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-bold rounded font-mono">
                        {searchResult?.id || newGeoId}
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>Review and edit the extracted data before saving</CardDescription>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {permissions.telegram_send !== false && (
                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={telegramPostEnabled}
                        onChange={() => setTelegramPostEnabled(v => !v)}
                        className="h-4 w-4 accent-blue-600 cursor-pointer"
                      />
                      <Send className="h-3.5 w-3.5 text-blue-600" />
                      TELEGRAM POST
                    </label>
                  )}
                  <Button
                    onClick={() => { searchResult ? handleUpdateExisting() : handleSaveNew(); }}
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
                        {searchResult ? "Update Listing" : "Save New Listing"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
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
                  <Input value={editArea} onChange={(e) => handleInputChange(setEditArea)(e.target.value)} className="h-8 text-sm" />
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
                  {["AVAILABLE", "SOLD", "LEASED OUT", "OFF MARKET", "ON HOLD", "UNDER NEGO", "UNDECISIVE SELLER"].map((status) => (
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
                  {/* Row 1: GEO ID | TYPE | MAP LINK */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">GEO ID</Label>
                    <span className="text-sm font-semibold font-mono">{searchResult?.id || newGeoId || "—"}</span>
                  </div>

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
                  <div className="flex items-center gap-2">
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
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md flex items-center justify-between gap-3">
              <span>{error}</span>
              {batchActive && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-7 text-xs"
                  onClick={() => {
                    const current = batchRows[batchIndex];
                    if (current) setBatchSkips(prev => [...prev, current.rowNumber]);
                    setError(null);
                    setBatchIndex(prev => prev + 1);
                  }}
                >
                  Skip This Row
                </Button>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => goToStep("check")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Check & Info
            </Button>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {permissions.telegram_send !== false && (
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={telegramPostEnabled}
                    onChange={() => setTelegramPostEnabled(v => !v)}
                    className="h-4 w-4 accent-blue-600 cursor-pointer"
                  />
                  <Send className="h-3.5 w-3.5 text-blue-600" />
                  TELEGRAM POST
                </label>
              )}
              <Button
                onClick={() => { searchResult ? handleUpdateExisting() : handleSaveNew(); }}
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
                    {searchResult ? "Update Listing" : "Save New Listing"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Telegram Post Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Listing
            </h3>
            <p className="text-sm">
              You are about to permanently delete listing <strong>{searchResult?.id}</strong>.
            </p>
            <p className="text-sm font-semibold text-red-600">
              ⚠️ This action cannot be undone. The listing will be removed from both Google Sheets and Supabase.
            </p>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleDeleteListing}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white flex-1"
              >
                {deleting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</>
                ) : (
                  <><Trash2 className="mr-2 h-4 w-4" />Yes, Delete Permanently</>
                )}
              </Button>
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {showTelegramModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-xl space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              Telegram Post
            </h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Group</Label>
                <div className="flex gap-3 flex-wrap">
                  {["DIRECT", "RESIDENTIAL", "COMMERCIAL", "INDUSTRIAL", "AGRICULTURAL", "BUSINESS FOR SALE", "UPDATE LISTING"].map(g => (
                    <label key={g} className="flex items-center gap-1.5 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        value={g}
                        checked={telegramGroups.includes(g)}
                        onChange={() => setTelegramGroups(prev =>
                          prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
                        )}
                        className="accent-blue-600"
                      />
                      {g}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Line 1 (Header)</Label>
                <Input
                  value={telegramLine1}
                  onChange={e => setTelegramLine1(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Line 2 (Notes)</Label>
                <Textarea
                  value={telegramLine2}
                  onChange={e => setTelegramLine2(e.target.value)}
                  className="min-h-20 text-sm"
                  placeholder="Type your notes here..."
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Line 3 (Broker / Col K)</Label>
                <Input
                  value={telegramLine3}
                  onChange={e => setTelegramLine3(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowTelegramModal(false)}>
                <X className="mr-2 h-4 w-4" />Cancel
              </Button>
              <Button onClick={handleTelegramConfirm} className="bg-green-600 hover:bg-green-700 text-white">
                <Save className="mr-2 h-4 w-4" />Send & Update
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

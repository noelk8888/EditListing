"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn, getPHLDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ArrowRight, Check, ClipboardPaste, Search, Loader2, Sparkles, AlertCircle, CheckCircle2, Copy, Save, Home, Plus, X, Send, Trash2, Play, Pause } from "lucide-react";
import { useRouter } from "next/navigation";
import { SupabaseListing, fetchSpearheadedByNames, SupabaseTelegramGroup, fetchTelegramGroups } from "@/lib/supabase";
import { APP_VERSION } from "@/lib/version";
import { LISTING_OWNERSHIP_OPTIONS } from "@/types/listing";
import { useToast } from "@/components/ui/use-toast";

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
  return getPHLDate();
};

// Normalize numeric styles in a string to allow "absolute" comparison
const normalizeTextNumbers = (text: string): string => {
  return (text || "").trim().toLowerCase().replace(/([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)/g, (match) => {
    const n = parseFloat(match.replace(/,/g, ""));
    return isNaN(n) ? match : String(n);
  });
};

export default function AddListingPage() {
  const router = useRouter();
  const { toast } = useToast();
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
  const [locationVerified, setLocationVerified] = useState(false);
  const [bedrooms, setBedrooms] = useState("");
  const [toilet, setToilet] = useState("");
  const [garage, setGarage] = useState("");
  const [amenities, setAmenities] = useState("");
  const [corner, setCorner] = useState("");
  const [compound, setCompound] = useState("");
  const [monthlyDues, setMonthlyDues] = useState("");
  const [dynamicOptions, setDynamicOptions] = useState<string[]>([]);

  useEffect(() => {
    fetchSpearheadedByNames().then(setDynamicOptions);
  }, []);

  const allOwnershipOptions = Array.from(new Set([...LISTING_OWNERSHIP_OPTIONS, ...dynamicOptions]));
  const [comments, setComments] = useState("");

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
  const [searchError, setSearchError] = useState<string | null>(null);
  const [listingId, setListingId] = useState("");
  const [matchedBy, setMatchedBy] = useState<string | null>(null);
  const [sourceTab, setSourceTab] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [suggestedGeoId, setSuggestedGeoId] = useState("");
  const [newGeoId, setNewGeoId] = useState("");
  const [geoIdConfirmed, setGeoIdConfirmed] = useState(false);
  const [lastAssignedGeoId, setLastAssignedGeoId] = useState(""); // tracks last server-assigned ID to derive next without re-querying

  // === BATCH MODE STATE ===
  type BatchRow = { rowNumber: number; colA: string; colB: string; colC: string; colD: string; colE: string; colF: string; colG: string; colH: string; colI: string; colJ: string; colK: string; colL: string; colM: string; colN: string; colO: string; colP: string; colQ: string; colR: string; colAC: string };
  const [batchMode, setBatchMode] = useState(false);      // setup panel open
  // SOURCE GSheet — read-only source for Batch Review listings
  const [batchSheetUrl, setBatchSheetUrl] = useState("https://docs.google.com/spreadsheets/d/1T-LUc3cKn0ojq1p3VvgpFs4NzB8Z6ZKV4iJaoEhfwKM/edit");
  const [batchStartRow, setBatchStartRow] = useState("2");
  const [batchEndRow, setBatchEndRow] = useState("50");
  const batchGeoSeries = "G";
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchActive, setBatchActive] = useState(false);      // processing in progress
  const [batchSkips, setBatchSkips] = useState<number[]>([]);
  const [batchSourceTabName, setBatchSourceTabName] = useState<string | null>(null);
  const [batchPaused, setBatchPaused] = useState(false);
  const [isSendingOnly, setIsSendingOnly] = useState(false);
  const [batchAutoReview, setBatchAutoReview] = useState(false); // true = auto-skip identical, false = manual review every row
  const [batchForceSheet1, setBatchForceSheet1] = useState(true); // default master override to Sheet1
  const [flashOn, setFlashOn] = useState(false);
  const [flashDismissed, setFlashDismissed] = useState(false);
  const [pendingExtractUpdate, setPendingExtractUpdate] = useState(false);
  const batchCurrentRowRef = useRef<BatchRow | null>(null); // GSheet data for current row

  // === BACKUP SYNC STATE ===
  const [backupStatus, setBackupStatus] = useState<"idle" | "loading" | "not-found" | "match" | "conflict">("idle");
  const [backupData, setBackupData] = useState<{
    blastedFormat: string; type: string; area: string; city: string;
    lotArea: string; floorArea: string; price: string; saleOrLease: string;
    withIncome: string; directCobroker: string; ownerBroker: string; away: string;
    dateReceived: string; dateResorted: string; available: string; listingOwnership: string;
  } | null>(null);
  const [conflictResolved, setConflictResolved] = useState(false);

  // === TELEGRAM POST STATE ===
  const [telegramPostEnabled, setTelegramPostEnabled] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramLine1, setTelegramLine1] = useState("");
  const [telegramLine2, setTelegramLine2] = useState(""); // status dropdown
  const [telegramLine3Notes, setTelegramLine3Notes] = useState(""); // optional notes
  const [telegramLine3, setTelegramLine3] = useState(""); // broker
  const [telegramLine4, setTelegramLine4] = useState(""); // ownership
  const [telegramGroups, setTelegramGroups] = useState<string[]>(["DIRECT", "RESIDENTIAL", "UPDATE LISTING", "TEST"]);
  const [allTelegramGroups, setAllTelegramGroups] = useState<SupabaseTelegramGroup[]>([]);
  const [telegramSearch, setTelegramSearch] = useState("");

  // === PERMISSIONS ===
  const [targetTab, setTargetTab] = useState<"Sheet1" | "Sheet2">("Sheet1");
  const [isPromoting, setIsPromoting] = useState(false);
  const [pendingUpdateTab, setPendingUpdateTab] = useState<"Sheet1" | "Sheet2" | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const showTelegramProHub = !!(permissions.sheet2 || permissions.telegram_pro_hub);

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
      .then((d) => { 
        setPermissions(d.permissions || {}); 
        setPermissionsLoaded(true); 
        if (d.permissions?.sheet2) {
          setTargetTab("Sheet2");
        }
        if (d.role === "ADMIN") {
          setTelegramPostEnabled(true);
        }
      })
      .catch(() => setPermissionsLoaded(true));

    // Fetch Telegram groups from the Admin API (uses service role key — always returns all groups)
    fetch("/api/admin/groups")
      .then(r => r.json())
      .then(d => setAllTelegramGroups(d.groups || []))
      .catch(err => console.error("Failed to load Telegram groups:", err));
  }, []);

  const autoSelectGroups = useCallback((building: string, area: string, barangay: string, city: string, summary: string, saleOrLease: string, isCommercial: boolean, isIndustrial: boolean, ownerBroker: string) => {
    if (allTelegramGroups.length === 0) return;
    
    // Normalize: strip diacritics so "Parañaque" matches "paranaque", etc.
    const normalize = (s: string) =>
      (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const fields = [building, area, barangay, city, summary].map(f => normalize(f));
    const lowerOwner = normalize(ownerBroker);
    const isLeaseListing = saleOrLease.toLowerCase().includes("lease");
    const isSaleListing = saleOrLease.toLowerCase().includes("sale");

    // Groups that use location+commercial two-condition logic
    // Any group whose clean name contains "commercial properties" uses this rule:
    // - Location part (before "commercial properties") must appear in any listing field
    // - AND the listing must be commercial or industrial

    setTelegramGroups(prev => {
      const selected = new Set(prev);
      allTelegramGroups.forEach(group => {
        const groupNameUpper = group.name.toUpperCase();
        const isLeaseGroup = groupNameUpper.includes("LEASE");
        const isSaleGroup = groupNameUpper.includes("SALE");

        // Always filter by type — if saleOrLease is empty, both SALE and LEASE groups are excluded
        if (isLeaseGroup && !isLeaseListing) return;
        if (isSaleGroup && !isSaleListing) return;

        const cleanName = normalize(group.name.replace(/\s*x\s*Luxe\s*Realty/i, ""));

        // Commercial Properties groups: generalized two-condition logic
        if (cleanName.includes("commercial properties")) {
          const locationPart = cleanName.replace(/\s*commercial properties\s*/, "").replace(/\.$/, "").trim();

          // Groups that trigger by address alone (no commercial checkbox needed)
          const ADDRESS_ONLY_COMMERCIAL = ["quezon ave", "chino roces", "edsa", "alabang"];
          const isAddressOnly = ADDRESS_ONLY_COMMERCIAL.some(a => locationPart.startsWith(a));

          const locationMatch = locationPart && fields.some(field =>
            field.includes(locationPart) || field.includes(locationPart.replace(/\.$/, ""))
          );

          if (locationMatch && (isAddressOnly || isCommercial || isIndustrial)) {
            selected.add(group.name);
          }
          return; // Skip all other matching for these groups
        }

        // Special owner-based rule: METROSUMMIT group
        if (cleanName === "metrosummit") {
          if (lowerOwner.includes("metrosummit")) selected.add(group.name);
          return;
        }

        // 1. Keyword match
        const kwMatch = group.keywords.some(kw => {
          const lowerKw = normalize(kw);
          if (!lowerKw) return false;
          return fields.some(field => field.includes(lowerKw));
        });

        // 2. Name match — strip the " x Luxe Realty" part
        const nameMatch = cleanName && cleanName.length > 3 && fields.some(field => field.includes(cleanName));

        // 3. BGC Special Fallback (Only for general city groups, not specific condos)
        const isBGCGeneralGroup = cleanName === "bgc sale" || cleanName === "bgc lease" || cleanName === "bgc";
        const bgcMatch = isBGCGeneralGroup && fields.some(field => field.includes("bonifacio global city") || field.includes("bgc"));

        if (kwMatch || nameMatch || bgcMatch) {
          selected.add(group.name);
        }
      });
      return Array.from(selected);
    });
  }, [allTelegramGroups]);

  const steps: { key: Step; label: string; number: number }[] = [
    { key: "paste", label: "Paste Listing", number: 1 },
    { key: "check", label: "Check & Info", number: 2 },
    { key: "review", label: "Review & Save", number: 3 },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  // Auto-select Telegram groups whenever location fields are set (check AND review steps)
  // Note: Must also run on "review" because new listings populate fields during extraction which jumps directly to review
  useEffect(() => {
    if (showTelegramProHub && step !== "paste" && (editArea || editBuilding || editBarangay || editCity)) {
      autoSelectGroups(editBuilding, editArea, editBarangay, editCity, editSummary || rawText, saleOrLease, !!commercial, !!industrial, ownerBroker);
    }
  }, [step, editBuilding, editArea, editBarangay, editCity, editSummary, rawText, saleOrLease, commercial, industrial, ownerBroker, autoSelectGroups]);

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

      // Set property type checkboxes from parsed data
      if (data.residential) {
        setResidential(true);
        // If it's residential, usually it's not commercial/industrial unless explicitly stated
        if (!data.commercial) setCommercial(false);
        if (!data.industrial) setIndustrial(false);
      } else {
        if (data.commercial) setCommercial(true);
        if (data.industrial) setIndustrial(true);
      }
      if (data.agricultural) setAgricultural(true);

      // Text-based fallback: auto-tick COMMERCIAL if listing text clearly indicates it
      // (covers cases where AI misses "Commercial Vacant Lot", "Commercial Space", etc.)
      if (/\bcommercial\s+(vacant\s+)?lot\b|\bcommercial\s+space\b|\bcommercial\s+building\b|\bcommercial\s+unit\b|\bcommercial\s+property\b|\bcommercial\s+condo\b|\bzoning\s*:\s*commercial\b|\br2\s+zoning\b/i.test(textToExtract)) {
        setCommercial(true);
      }

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
        if (!data.dateResorted) {
          setDateUpdated(gsheet.colN ? normalizeGSheetDate(gsheet.colN) : getTodayDate());
        }
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
    setLocationVerified(false);
    setBedrooms("");
    setToilet("");
    setGarage("");
    setAmenities("");
    setCorner("");
    setCompound("");
    setMonthlyDues("");
    setComments("");
    setTargetTab(permissions.sheet2 ? "Sheet2" : "Sheet1");
  };

  const goToStep = (targetStep: Step, overrideText?: string) => {
    if (targetStep === "check") {
      extractPhotosAndPreview(overrideText);
      setSearchResult(null);
      setSearchPerformed(false);
      setMatchedBy(null);
      setSourceTab(null);
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
    setSearchError(null);
    setSearchResult(null);
    setMatchedBy(null);
    setSourceTab(null);
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
    setLocationVerified(false);
    setBedrooms("");
    setToilet("");
    setGarage("");
    setAmenities("");
    setCorner("");
    setCompound("");
    setMonthlyDues("");
    setComments("");
    setSuggestedGeoId("");
    setNewGeoId("");
    setGeoIdConfirmed(false);
    let finalTargetTab: "Sheet1" | "Sheet2" = permissions.sheet2 ? "Sheet2" : "Sheet1";
    if (batchActive && batchForceSheet1) {
      finalTargetTab = "Sheet1";
    }
    setTargetTab(finalTargetTab);

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

      const isRestrictedMatch = data.matchedBy === "restricted";
      let transformedRestrictedId = null;

      if (isRestrictedMatch && data.result?.id) {
        transformedRestrictedId = data.result.id.startsWith("B") 
          ? data.result.id.replace(/^B/, "G") 
          : data.result.id;
      }

      // If it is restricted (Sheet2 match for Admin), we keep data.result for populate but HIDE the searchResult UI
      if (isRestrictedMatch) {
        setSearchResult(null); // Admin remains "unaware" of the Sheet2 record
        setMatchedBy(null);
        setSourceTab(null);
        console.log(
          `🕵️ Restricted Sheet2 match found (${data.result?.id}); treating as NEW but populating data. Target ID: ${transformedRestrictedId}`
        );
      } else {
        setSearchResult(data.result);
        setMatchedBy(data.matchedBy || null);
        setSourceTab(
          data.sourceTab && data.sourceTab !== "Sheet1" ? data.sourceTab : null
        );
      }

      setSearchPerformed(true);

      // If no match found (or restricted match), suggest GEO ID and populate from the found data if available
      const shouldPopulateData = !data.result || isRestrictedMatch;
      if (shouldPopulateData) {
        // If it was restricted, we can still use data.result as a template
        const template = data.result;
        if (template) {
          // We keep the template data but clear the ID/Summary to ensure it's treated as new
          setSearchResult(null);
          // Populate fields from the template
          setEditSummary(template.summary || "");
          setOriginalEditSummary(template.summary || "");
          setEditArea(template.area || "");
          setEditBarangay(template.barangay || "");
          setEditCity(template.city || "");
          setEditLotArea(template.lot_area ? template.lot_area.toString() : "");
          setEditFloorArea(template.floor_area ? template.floor_area.toString() : "");
          if (template.sale_or_lease === "Lease") {
            setEditPrice("");
            setEditLeasePrice(
              template.lease_price ? template.lease_price.toString() :
                template.price ? template.price.toString() : ""
            );
          } else {
            setEditPrice(template.price ? template.price.toString() : "");
            setEditLeasePrice(template.lease_price ? template.lease_price.toString() : "");
          }
          setEditRegion(template.region || "");
          setEditProvince(template.province || "");
          setEditBuilding(template.building || "");
          setEditStatus(normalizeStatus(template.status || ""));
          setResidential(!!template.residential && template.residential.length > 0);
          setCommercial(!!template.commercial && template.commercial.length > 0);
          setIndustrial(!!template.industrial && template.industrial.length > 0);
          setAgricultural(!!template.agricultural && template.agricultural.length > 0);
          if (template.sale_or_lease) {
            const val = template.sale_or_lease.toLowerCase();
            if (val.includes('sale') && val.includes('lease')) setSaleOrLease('Sale/Lease');
            else if (val.includes('lease')) setSaleOrLease('Lease');
            else if (val.includes('sale')) setSaleOrLease('Sale');
            else setSaleOrLease('');
          } else {
            setSaleOrLease('');
          }
          setWithIncome(template.with_income || "");
          if (template.direct_or_broker) {
            const val = template.direct_or_broker.toLowerCase();
            if (val.includes('direct')) setDirectOrCobroker('Direct to Owner');
            else if (val.includes('cobroker') || val.includes('broker')) setDirectOrCobroker('With Cobroker');
            else setDirectOrCobroker('');
          } else {
            setDirectOrCobroker('');
          }
          setOwnerBroker(template.owner_broker || '');
          setHowManyAway(template.how_many_away || '');
          setListingOwnership(template.listing_ownership || '');
          setDateReceived(template.date_received || getTodayDate());
          setDateUpdated(template.date_updated || getTodayDate());
          setOriginalDateUpdated(template.date_updated || getTodayDate());
          setAvailable(template.available || "");
          setMapLink(template.map_link || "");
          setSalePricePerSqm(template.sale_price_per_sqm ? template.sale_price_per_sqm.toString() : "");
          setLeasePricePerSqm(template.lease_price_per_sqm ? template.lease_price_per_sqm.toString() : "");
          setPropertyType(template.property_type || "");
          setLat(template.lat || "");
          setLong(template.long || "");
          setBedrooms(template.bedrooms || "");
          setToilet(template.toilet || "");
          setGarage(template.garage || "");
          setAmenities(template.amenities || "");
          setCorner(template.corner || "");
          setCompound(template.compound || "");
          setMonthlyDues(template.monthly_dues || "");
          setComments(template.comments || "");
        }

        // If it was a restricted match, use its ID (transformed)
        if (transformedRestrictedId) {
          setSuggestedGeoId(transformedRestrictedId);
          setNewGeoId(transformedRestrictedId);
        } else if (listingId) {
          // If the pasted text already contains a GEO ID (e.g. "G10642" as first line),
          // preserve it — don't overwrite with a brand new ID
          setSuggestedGeoId(listingId);
          setNewGeoId(listingId);
        } else {
          // If we just saved a listing this session with the same series, derive the next ID locally (avoids race condition)
          const targetSeries = finalTargetTab === "Sheet2" ? "B" : "G";
          const lastMatch = lastAssignedGeoId.match(/^([A-Z])(\d+)$/);
          if (lastMatch && lastMatch[1].toUpperCase() === targetSeries) {
            const next = `${lastMatch[1]}${parseInt(lastMatch[2]) + 1}`;
            setSuggestedGeoId(next);
            setNewGeoId(next);
          } else {
            // First new listing this session or different series — must query the sheet
            try {
              const geoRes = await fetch(
                `/api/next-geo-id?series=${targetSeries}`,
                { cache: "no-store" }
              );
              const geoData = await geoRes.json();
              console.log("GEO ID fetch result in handleSearch:", geoData);
              if (geoData.geoId) {
                setSuggestedGeoId(geoData.geoId);
                setNewGeoId(geoData.geoId);
              } else if (geoData.error) {
                console.error("Server error generating ID in handleSearch:", geoData.error);
              }
            } catch (err) {
              console.error("Fetch failed in handleSearch:", err);
            }
          }
        }
      }
    } catch (err) {
      setSearchError("Failed to search. Please try again.");
    } finally {
      setSearching(false);
    }
  }, [photosLink, listingId, previewLines, lastAssignedGeoId, targetTab, permissions, batchActive, batchForceSheet1]);

  // Keep Map Link in sync with lat/long coordinates
  useEffect(() => {
    if (lat && long) {
      setMapLink(`https://www.google.com/maps/search/?api=1&query=${lat},${long}`);
      // Auto-clear verification if coordinates change (prevents re-sending old verification)
      if (searchResult && (lat !== searchResult.lat || long !== searchResult.long)) {
        setLocationVerified(false);
      }
    }
  }, [lat, long, searchResult]);

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
      setBatchSkips((prev) => [...prev, ...newSkips]);
      if (idx !== batchIndex) {
        setBatchIndex(idx);
        return;
      }
    }

    if (idx >= batchRows.length) {
      alert(
        `Batch complete! Skipped ${batchSkips.length + newSkips.length} empty rows.`
      );
      // Full reset — same as handleDone
      setBatchActive(false);
      setBatchRows([]);
      setBatchIndex(0);
      setBatchSkips([]);
      setBatchSourceTabName(null);
      setRawText("");
      setStep("paste");
      setError(null);
      setSearchResult(null);
      setSearchPerformed(false);
      setListingId("");
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
      setAvailable("");
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
      setMapLink("");
      setSalePricePerSqm("");
      setLeasePricePerSqm("");
      setLat("");
      setLong("");
    setLocationVerified(false);
      setBedrooms("");
      setToilet("");
      setGarage("");
      setAmenities("");
      setCorner("");
      setCompound("");
      setComments("");
      setNewGeoId("");
      setSuggestedGeoId("");
      setGeoIdConfirmed(false);
      setLastAssignedGeoId("");
      router.push("/");
      return;
    }

    const row = batchRows[idx];
    batchCurrentRowRef.current = row; // store GSheet data for fallback
    setRawText(row.colA);
    goToStep("check", row.colA);

    // Pre-fill dates from GSheet col M (Date Received) and col N (Date Updated).
    // Must come AFTER goToStep because goToStep → clearEditFields resets these fields.
    // React batches all setState calls in this effect; last write wins.
    if (row.colM) setDateReceived(normalizeGSheetDate(row.colM));
    setDateUpdated(row.colN ? normalizeGSheetDate(row.colN) : getTodayDate());

    // Pre-fill additional fields from GSheet columns B-I, O-P
    if (row.colB) {
      const t = row.colB.toLowerCase();
      if (t.includes("residential")) setResidential(true);
      if (t.includes("commercial")) setCommercial(true);
      if (t.includes("industrial")) setIndustrial(true);
      if (t.includes("agricultural")) setAgricultural(true);
    }
    if (row.colC) setEditArea(row.colC);
    if (row.colD) setEditCity(row.colD);
    if (row.colE) setEditLotArea(row.colE);
    if (row.colF) setEditFloorArea(row.colF);
    if (row.colG) setEditPrice(row.colG);
    if (row.colH) {
      const h = row.colH.toLowerCase();
      if (h.includes("sale") && h.includes("lease")) setSaleOrLease("Sale/Lease");
      else if (h.includes("lease")) setSaleOrLease("Lease");
      else if (h.includes("sale")) setSaleOrLease("Sale");
    }
    if (row.colI) setWithIncome(row.colI);
    if (row.colJ) {
      const val = row.colJ.toLowerCase();
      if (val.includes("direct")) setDirectOrCobroker("Direct to Owner");
      else if (val.includes("cobroker") || val.includes("broker"))
        setDirectOrCobroker("With Cobroker");
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
      const originalDate = searchResult.date_updated || normalizeGSheetDate(gsheet?.colN || '') || getPHLDate();
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
      setMonthlyDues(searchResult.monthly_dues || "");
      setComments(searchResult.comments || "");
      setLocationVerified(!!searchResult.map_verified);
    }
  }, [searchResult]);

  // Fetch 2nd backup row and detect conflict whenever a listing is loaded (SUPERADMIN only)
  useEffect(() => {
    if (!searchResult || !permissions.sheet2) {
      setBackupStatus("idle");
      setBackupData(null);
      setConflictResolved(false);
      return;
    }

    setBackupStatus("loading");
    setConflictResolved(false);

    fetch(`/api/backup-row?geoId=${encodeURIComponent(searchResult.id)}`)
      .then(r => r.json())
      .then(result => {
        if (!result.found) {
          setBackupStatus("not-found");
          setBackupData(null);
          return;
        }

        const bd = result.data;
        setBackupData(bd);

        // Compare working (searchResult) vs backup to detect conflict
        const workingBlasted = (searchResult.summary || "").startsWith(searchResult.id)
          ? (searchResult.summary || "").split("\n").slice(1).join("\n")
          : (searchResult.summary || "");

        const differs = (a: string, b: string) =>
          normalizeTextNumbers(a) !== normalizeTextNumbers(b);
        const differsPrice = (a: string, b: string) => {
          const na = parseFloat((a || "").replace(/,/g, ""));
          const nb = parseFloat((b || "").replace(/,/g, ""));
          if (!isNaN(na) && !isNaN(nb)) return Math.abs(na - nb) > 0.01;
          return differs(a, b);
        };

        const hasConflict =
          differs(workingBlasted, bd.blastedFormat) ||
          differs(searchResult.city || "", bd.city) ||
          differsPrice((searchResult.lot_area ?? "").toString(), bd.lotArea) ||
          differsPrice((searchResult.floor_area ?? "").toString(), bd.floorArea) ||
          differsPrice((searchResult.price ?? "").toString(), bd.price) ||
          differs(searchResult.status || "", bd.available);

        setBackupStatus(hasConflict ? "conflict" : "match");
      })
      .catch(() => setBackupStatus("idle"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchResult?.id]);

  // Default Date Received to today when search returns no existing listing
  useEffect(() => {
    if (searchPerformed && !searchResult) {
      setDateReceived(getPHLDate());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchPerformed, searchResult]);

  const canProceedFromPaste = rawText.trim().length > 0;

  // Helper: compare if a value is significantly different from Supabase (used in UI highlighting)
  const isDifferent = (current: any, original: any) => {
    if (!original && !current) return false;
    return normalizeTextNumbers(String(current)) !== normalizeTextNumbers(String(original));
  };

  // Compute batchAutoPaused — used by both the flash effect and the card render
  const _normBap = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const _isGeoIdBap = (s: string) => /^[A-Z]\d{4,6}$/.test(s.trim());
  const _dbLinesBap = (searchResult?.summary || "").split("\n").filter(l => l.trim() && !_isGeoIdBap(l.trim()));
  const _textDiffBap = _dbLinesBap.some(line => !_normBap(rawText).includes(_normBap(line)));
  const batchAutoPaused = batchActive && step === "check" && !!searchResult && (
    _textDiffBap ||
    isDifferent(editLotArea, searchResult?.lot_area ?? "") ||
    isDifferent(editFloorArea, searchResult?.floor_area ?? "") ||
    isDifferent(editPrice || editLeasePrice, saleOrLease === "Lease" ? (searchResult?.lease_price ?? "") : (searchResult?.price ?? ""))
  );

  // BATCH Auto-Advance Logic — mirrors renderDiffText(rawText, editSummary) exactly
  useEffect(() => {
    if (!batchActive || step !== "check" || !searchResult || searching || batchPaused || !batchAutoReview) return;

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
  }, [batchActive, step, searchResult, searching, rawText, batchPaused, batchAutoReview, editLotArea, editFloorArea, editPrice, editLeasePrice, saleOrLease]);

  // Flash toggle for red card warning
  useEffect(() => {
    if (!batchAutoPaused || flashDismissed) { setFlashOn(false); return; }
    const interval = setInterval(() => setFlashOn(prev => !prev), 400);
    return () => clearInterval(interval);
  }, [batchAutoPaused, flashDismissed]);

  // Any click anywhere on the page dismisses the flash
  useEffect(() => {
    if (!batchAutoPaused || flashDismissed) return;
    const handler = () => setFlashDismissed(true);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [batchAutoPaused, flashDismissed]);

  // Reset flash dismissed state on each new batch row
  useEffect(() => {
    setFlashDismissed(false);
  }, [batchIndex]);

  // Auto-toggle today and set date when any input changes
  const handleInputChange = <T,>(setter: (value: T) => void, skipToggle = false) => (value: T) => {
    setter(value);
    if (!todayToggle && !skipToggle) {
      setTodayToggle(true);
      setDateUpdated(getTodayDate());
    }
    // Clear location verification if coordinates change manually
    if (setter === (setLat as any) || setter === (setLong as any)) {
      setLocationVerified(false);
    }
  };

  // Save empty string if only the auto-prefix was filled with no actual name
  const cleanOwnerBroker = (val: string): string => {
    const stripped = val.replace(/^(Owner|Cobroker|Broker) - /i, "").trim();
    return stripped ? val.trim() : "";
  };
  const cleanListingOwnership = (val: string): string => {
    const stripped = val.replace(/^Sales Associate\s*/i, "").trim();
    return stripped ? val.trim() : "";
  };

  // When Direct/CoBroker selection changes, auto-prefix ownerBroker field
  const handleDirectOrCobrokerChange = (v: string) => {
    handleInputChange(setDirectOrCobroker)(v as "Direct to Owner" | "With Cobroker" | "");
    const prefix = v === "Direct to Owner" ? "Owner - " : v === "With Cobroker" ? "Broker - " : "";
    if (!prefix) return;
    setOwnerBroker((prev) => {
      const stripped = prev.replace(/^(Owner|Cobroker|Broker) - /, "");
      return stripped ? `${prefix}${stripped}` : prefix;
    });
    // Pre-fill Listing Ownership with "Sales Associate " only if currently empty
    setListingOwnership((prev) => prev ? prev : "Sales Associate ");
  };

  // When Owner/CoBroker name is typed, pre-fill Listing Ownership if still empty
  const handleOwnerBrokerChange = (val: string) => {
    handleInputChange(setOwnerBroker)(val);
    setListingOwnership((prev) => prev ? prev : "Sales Associate ");
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
  const handleUpdateExisting = (overrideTargetTab?: "Sheet1" | "Sheet2") => {
    if (!searchResult) return;
    setPendingUpdateTab(overrideTargetTab || null);

    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = now.toLocaleDateString("en-US", { month: "long" });
    const year = now.getFullYear();
    const today = `${month} ${day}, ${year}`;

    if (telegramPostEnabled) {
      const today = new Date(getPHLDate()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const formatOwnership = (val: string) => {
        const result = (val || "").replace(/(Sales\s?Asscociate|Sales\s?Associate|Broker)/gi, "Listing Ownership").trim();
        return result === "Listing Ownership" ? "" : result;
      };

      setTelegramLine1(overrideTargetTab === "Sheet1" ? `*PROMOTED to Sheet1 ${today}*` : `*${today}*`);
      setTelegramLine2(
        editStatus === "AVAILABLE" ? "UPDATED FORMAT" :
        editStatus === "SOLD" ? "SOLD" :
        editStatus === "LEASED OUT" ? "LEASED OUT" :
        editStatus === "OFF MARKET" || editStatus === "OFF THE MARKET" ? "OFF THE MARKET" :
        editStatus === "UNDER NEGO" ? "UNDER NEGO" :
        editStatus === "UNDECISIVE SELLER" ? "UNDECISIVE SELLER" : ""
      );
      setTelegramLine3Notes("");
      setTelegramLine3(ownerBroker);
      setTelegramLine4(formatOwnership(listingOwnership));
      const isDirect = directOrCobroker?.toLowerCase().includes("direct");
      const isBusiness = editType?.toLowerCase().includes("business") || propertyType?.toLowerCase().includes("business");
      
      const defaultGroups = [
        ...(isDirect ? ["DIRECT"] : []),
        ...(residential ? ["RESIDENTIAL"] : []),
        ...(commercial || industrial ? ["COM 'L / IND'L"] : []),
        ...(agricultural ? ["AGRICULTURAL"] : []),
        ...(isBusiness ? ["BUSINESS FOR SALE"] : []),
        "UPDATE LISTING",
        "TEST",
      ];
      // Merge defaults with existing (smart-matched) groups
      setTelegramGroups(prev => Array.from(new Set([...prev, ...defaultGroups])));
      setShowTelegramModal(true);
    } else {
      confirmUpdate(undefined, overrideTargetTab);
    }
  };

  const handleSendOnlyTelegram = async () => {
    setIsSendingOnly(true);
    setError(null);
    try {
      const lines = [
        telegramLine1,
        telegramLine2,
        telegramLine3Notes,
        telegramLine3,
        telegramLine4,
      ].filter(Boolean);
      const msg = lines.join("\n");
      const response = await fetch("/api/send-telegram-only", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          groups: telegramGroups.length > 0 ? telegramGroups : undefined,
          summary: editSummary,
          geoId: searchResult?.id || newGeoId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send Telegram message");
      }

      alert("Message sent successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      alert(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSendingOnly(false);
      setShowTelegramModal(false);
    }
  };

  const handleTelegramConfirm = () => {
    setShowTelegramModal(false);
    const lines = [
      telegramLine1,
      telegramLine2, // status — skipped if empty
      telegramLine3Notes, // notes — skipped if empty
      telegramLine3, // broker
      telegramLine4, // ownership
    ].filter(Boolean);
    const msg = lines.join("\n");
    if (searchResult) {
      confirmUpdate(msg, pendingUpdateTab || undefined);
    } else {
      confirmAddNew(msg);
    }
  };

  // Actually perform the update after confirmation
  const confirmUpdate = async (telegramMsg?: string, overrideTargetTab?: "Sheet1" | "Sheet2") => {
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
          summary: editSummary,
          residential: residential ? "RESIDENTIAL" : "",
          commercial: commercial ? "COMMERCIAL" : "",
          industrial: industrial ? "INDUSTRIAL" : "",
          agricultural: agricultural ? "AGRICULTURAL" : "",
          with_income: withIncome,
          direct_or_broker: directOrCobroker,
          owner_broker: cleanOwnerBroker(ownerBroker),
          how_many_away: howManyAway,
          listing_ownership: cleanListingOwnership(listingOwnership),
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
          location_verified: locationVerified,
          bedrooms: bedrooms,
          toilet: toilet,
          garage: garage,
          amenities: amenities,
          corner: corner,
          compound: compound,
          monthly_dues: monthlyDues,
          comments: comments,

          photo_link: photosLink,
          send_telegram: telegramPostEnabled,
          telegram_post_message: telegramMsg || undefined,
          telegram_groups: telegramGroups,
          write_to_backup: backupStatus === "match" || (backupStatus === "conflict" && conflictResolved),
          // Primary target tab (Sheet1 or Sheet2)
          targetTab: (batchActive && batchForceSheet1) ? "Sheet1" : (overrideTargetTab || sourceTab || "Sheet1"),
          // batch writeback: write existing GEO ID to Shadow GSheet MAIN tab COL AC
          ...(batchActive && batchRows[batchIndex] ? {
            batch_source_sheet_id: batchSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1] || "",
            batch_source_sheet_gid: batchSheetUrl.match(/[?&#]gid=(\d+)/)?.[1] || "",
            batch_row_number: batchRows[batchIndex].rowNumber,
            batch_source_tab_name: overrideTargetTab || batchSourceTabName || undefined,
          } : {}),
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
        if (result.writebackError) {
          setError(`⚠️ Listing updated, but Shadow GSheet writeback failed: ${result.writebackError}`);
        } else {
          setError(null);
        }
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

  // Extract & Update: fires confirmUpdate automatically once extraction settles
  useEffect(() => {
    if (pendingExtractUpdate && !loading) {
      setPendingExtractUpdate(false);
      confirmUpdate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pendingExtractUpdate]);

  const handleExtractAndUpdate = () => {
    if (!searchResult) return;
    setPendingExtractUpdate(true);
    handleExtractData();
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
      setShowDeleteConfirm(false);
      alert(`🗑️ Listing ${searchResult.id} has been permanently deleted.`);
      window.location.href = "/add";
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
      const today = new Date(getPHLDate()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const formatOwnership = (val: string) => {
        const result = (val || "").replace(/(Sales\s?Asscociate|Sales\s?Associate|Broker)/gi, "Listing Ownership").trim();
        return result === "Listing Ownership" ? "" : result;
      };

      setTelegramLine1(`*New Listing ${today}*`);
      setTelegramLine2(
        editStatus === "AVAILABLE" ? "UPDATED FORMAT" :
        editStatus === "SOLD" ? "SOLD" :
        editStatus === "LEASED OUT" ? "LEASED OUT" :
        editStatus === "OFF MARKET" || editStatus === "OFF THE MARKET" ? "OFF THE MARKET" :
        editStatus === "UNDER NEGO" ? "UNDER NEGO" :
        editStatus === "UNDECISIVE SELLER" ? "UNDECISIVE SELLER" : ""
      );
      setTelegramLine3Notes("");
      setTelegramLine3(ownerBroker);
      setTelegramLine4(formatOwnership(listingOwnership));
      const isDirect = directOrCobroker?.toLowerCase().includes("direct");
      const isBusiness = editType?.toLowerCase().includes("business") || propertyType?.toLowerCase().includes("business");
      const autoGroups = [
        ...(isDirect ? ["DIRECT"] : []),
        ...(residential ? ["RESIDENTIAL"] : []),
        ...(commercial || industrial ? ["COM 'L / IND'L"] : []),
        ...(agricultural ? ["AGRICULTURAL"] : []),
        ...(isBusiness ? ["BUSINESS FOR SALE"] : []),
        "UPDATE LISTING",
        "TEST",
      ];
      // Merge with existing smart-matched groups instead of overwriting them
      setTelegramGroups(prev => Array.from(new Set([...prev, ...autoGroups])));
      setShowTelegramModal(true);
    } else {
      confirmAddNew();
    }
  };

  // Add the new listing
  const confirmAddNew = async (telegramMsg?: string, overrideTargetTab?: "Sheet1" | "Sheet2") => {
    setAdding(true);
    setError(null);
    
    let finalTargetTab = overrideTargetTab || targetTab;
    // IF batch mode is running and master toggle is ON -> FORCE G-SERIES / SHEET1
    if (batchActive && batchForceSheet1) {
      finalTargetTab = "Sheet1";
    }

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
          summary: (overrideTargetTab === "Sheet1" && searchResult) ? (editSummary || rawText) : rawText, // Use editSummary if promoting
          residential: residential ? "RESIDENTIAL" : "",
          commercial: commercial ? "COMMERCIAL" : "",
          industrial: industrial ? "INDUSTRIAL" : "",
          agricultural: agricultural ? "AGRICULTURAL" : "",
          with_income: withIncome,
          direct_or_broker: directOrCobroker,
          owner_broker: cleanOwnerBroker(ownerBroker),
          how_many_away: howManyAway,
          listing_ownership: cleanListingOwnership(listingOwnership),
          sale_or_lease: saleOrLease,
          date_received: dateReceived || getPHLDate(),
          date_updated: dateUpdated || getPHLDate(),
          map_link: mapLink,
          sale_price_per_sqm: salePricePerSqm ? parseFloat(salePricePerSqm) : null,
          lease_price_per_sqm: leasePricePerSqm ? parseFloat(leasePricePerSqm) : null,
          lat: lat,
          long: long,
          location_verified: locationVerified,
          bedrooms: bedrooms,
          toilet: toilet,
          garage: garage,
          amenities: amenities,
          corner: corner,
          compound: compound,
          monthly_dues: monthlyDues,
          comments: comments,
          photo_link: photosLink,
          geo_id: (geoIdConfirmed && newGeoId) ? newGeoId : undefined,
          // batch: always pass source sheet + row so GEO ID is written back to Shadow GSheet MAIN tab COL AC
          ...(batchActive && batchRows[batchIndex] ? {
            col_q: batchRows[batchIndex].colQ,
            col_r: batchRows[batchIndex].colR,
            batch_source_sheet_id: batchSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1] || "",
            batch_source_sheet_gid: batchSheetUrl.match(/[?&#]gid=(\d+)/)?.[1] || "",
            batch_row_number: batchRows[batchIndex].rowNumber,
            batch_source_tab_name: batchSourceTabName || finalTargetTab,
          } : {
            batch_source_tab_name: finalTargetTab,
          }),
          send_telegram: telegramPostEnabled,
          telegram_post_message: telegramMsg || undefined,
          telegram_groups: telegramGroups,
        }),
      });

      const data = await response.json();
      console.log("Add Listing Response:", data);

      if (!response.ok) {
        if (data.error === "EXISTING_IN_SHEET2" && data.match) {
          const match = data.match;
          const isBSeries = match.geoId?.startsWith("B");
          const msg = `This listing already exists in Sheet2 (Row ${match.rowNumber}).\n\nWould you like to PROMOTE it to Sheet1 instead?\n\n${isBSeries ? `GEO ID will transform: ${match.geoId} → ${match.geoId.replace(/^B/, "G")}` : `GEO ID will remain: ${match.geoId}`}`;
          
          if (window.confirm(msg)) {
            // Re-populate searchResult from the match data so handleUpdateExisting works
            // The backend returns 'geoId' but frontend 'searchResult' expects 'id'
            setSearchResult({
              ...match,
              id: match.geoId,
              summary: match.blastedFormat || match.summary || editSummary,
            } as any);
            setSourceTab("Sheet2");
            handleUpdateExisting("Sheet1");
            return;
          }
          throw new Error("Add cancelled. Listing already exists in Sheet2.");
        }
        throw new Error(data.details || data.error || "Failed to add listing");
      }

      // Success
      if (data.writebackError) {
        console.error("Shadow GSheet writeback error:", data.writebackError);
        setError(`⚠️ Listing saved, but Shadow GSheet writeback failed: ${data.writebackError}`);
      } else if (data.backupError) {
        console.error("Backup GSheet error:", data.backupError);
        setError(`⚠️ Listing saved, but backup GSheet failed: ${data.backupError}`);
      }
      if (batchActive) {
        if (!data.writebackError && !data.backupError) setError(null);
        if (data.geoId) { setNewGeoId(data.geoId); setLastAssignedGeoId(data.geoId); }
        setBatchIndex(prev => prev + 1);
      } else {
        const msg = data.writebackError
          ? `New listing created: ${data.geoId}\n\n⚠️ Shadow GSheet writeback failed: ${data.writebackError}`
          : data.backupError
            ? `New listing created: ${data.geoId}\n\n⚠️ Backup GSheet failed: ${data.backupError}`
            : `New listing created: ${data.geoId}`;
        alert(msg);
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
      setBatchSourceTabName(data.tabName || null);
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
    setBatchSourceTabName(null);
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
    setMonthlyDues("");
    setComments("");
    setSearchResult(null);
    setSearchPerformed(false);
    setListingId("");
    setMatchedBy(null);
    setSourceTab(null);
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
              <span className="text-[15px] font-bold tracking-widest text-slate-300 shrink-0">BATCH</span>
              <div className="w-28 h-1.5 bg-slate-700 rounded-full overflow-hidden shrink-0">
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${Math.round(((batchIndex + 1) / batchRows.length) * 100)}%` }}
                />
              </div>
              <span className="text-[15px] font-mono text-slate-400 shrink-0">
                {batchIndex + 1} / {batchRows.length}{" "}
                <span className="text-[17px] font-bold text-white">(Row {batchRows[batchIndex]?.rowNumber})</span>
              </span>
              {batchRows[batchIndex] && (
                <span className="text-[15px] text-slate-400 shrink-0">
                  <span className="text-slate-600 mx-1">·</span>
                  GEO ID: <span className="font-mono font-bold text-white">{batchRows[batchIndex].colAC || "(new)"}</span>
                  <span className="text-slate-600 mx-1">·</span>
                  Sheet row <span className="font-mono font-bold text-white text-[17px]">#{batchRows[batchIndex].rowNumber}</span>
                </span>
              )}
              {batchSkips.length > 0 && (
                <span className="text-[14px] text-yellow-400 shrink-0">
                  ⚠ Skipped: {batchSkips.join(", ")}
                </span>
              )}
            </div>
            {/* Right cluster */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => setBatchAutoReview(!batchAutoReview)}
                className={`h-7 px-3 text-[12px] font-bold uppercase tracking-wider ${batchAutoReview ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300"}`}
              >
                {batchAutoReview ? "▶ AUTO" : "✋ MANUAL"}
              </Button>
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
          <div className="flex items-center gap-2 mt-1">
            <input 
              type="checkbox" 
              id="batchForceSheet1" 
              checked={batchForceSheet1} 
              onChange={e => setBatchForceSheet1(e.target.checked)} 
              className="accent-blue-600 h-4 w-4 rounded"
            />
            <Label htmlFor="batchForceSheet1" className="text-sm font-medium cursor-pointer text-blue-700">
              Force new batch listings to Sheet1 (G-Series)
            </Label>
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
            <Button
              size="sm"
              onClick={() => setBatchAutoReview(!batchAutoReview)}
              className={`h-8 px-3 text-[12px] font-bold uppercase tracking-wider ${batchAutoReview ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300"}`}
            >
              {batchAutoReview ? "▶ AUTO" : "✋ MANUAL"}
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
                placeholder={`G01333
*FOR SALE*
9 Greenview Compound, Brgy. Bagong Lipunan ng Crame, Quezon City
Residential Vacant Lot
Lot Area: 451 sqm
Orientation Facing: East
Clean Tile under Individual
Zoning Classification: R2
Price: Php72,160,000 (P160k/sqm) gross
Direct to owner
Photos: https://photos.app.goo.gl/nZcQUNg6kDPFEooS9
Google Map: https://www.google.com/maps/search/?api=1&query=14.6099435,121.0472576`}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                autoResize
                className="resize-none font-mono text-sm placeholder:text-gray-300"
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
            {/* SuperAdmin Target Sheet Picker - only for NEW listings */}
            {permissions.sheet2 === true && !batchActive && !searchResult && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg space-y-3">
                <Label className="text-blue-900 font-semibold flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Target Destination
                </Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={targetTab === "Sheet1" ? "default" : "outline"}
                    className="flex-1"
                    onClick={async () => {
                      setTargetTab("Sheet1");
                      if (!searchResult && !listingId) {
                        setSearching(true);
                        try {
                          const res = await fetch(`/api/next-geo-id?series=G`, { cache: "no-store" });
                          const data = await res.json();
                          if (data.geoId) {
                            setSuggestedGeoId(data.geoId);
                            setNewGeoId(data.geoId);
                          } else if (data.error) {
                            console.error("Server error generating G ID:", data.error);
                          }
                        } catch (err) {
                          console.error("Failed to fetch G-series GEO ID:", err);
                        } finally {
                          setSearching(false);
                        }
                      }
                    }}
                  >
                    Sheet1 (Public)
                  </Button>
                  <Button
                    type="button"
                    variant={targetTab === "Sheet2" ? "secondary" : "outline"}
                    className={`flex-1 ${targetTab === "Sheet2" ? "bg-blue-600 text-white hover:bg-blue-700" : "border-blue-200"}`}
                    onClick={async () => {
                      setTargetTab("Sheet2");
                      if (!searchResult && !listingId) {
                        setSearching(true);
                        try {
                          const res = await fetch(`/api/next-geo-id?series=B`, { cache: "no-store" });
                          const data = await res.json();
                          if (data.geoId) {
                            setSuggestedGeoId(data.geoId);
                            setNewGeoId(data.geoId);
                          } else if (data.error) {
                            console.error("Server error generating B ID:", data.error);
                          }
                        } catch (err) {
                          console.error("Failed to fetch B-series GEO ID:", err);
                        } finally {
                          setSearching(false);
                        }
                      }
                    }}
                  >
                    Sheet2 (Restricted)
                  </Button>
                </div>
                <p className="text-xs text-blue-700/70">
                  {targetTab === "Sheet1" 
                    ? "Listing will be added to the public Sheet1 tab." 
                    : "Listing will be added to the restricted Sheet2 tab (SuperAdmin only)."}
                </p>
              </div>
            )}
            
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
                  {searchPerformed && !searching && !searchResult ? (
                    <Textarea 
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      autoResize
                      className="bg-muted font-mono text-sm placeholder:text-gray-300"
                      placeholder="Paste your listing here..."
                    />
                  ) : (
                    <div className="bg-muted p-3 rounded-md font-mono text-sm whitespace-pre-wrap">
                      {rawText || "No preview available"}
                    </div>
                  )}
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
                {searchPerformed && !searching && searchResult && (
                  <div className="p-4 rounded-md border border-yellow-500 bg-yellow-50">
                    <div className="flex items-center gap-2 text-yellow-700">
                      <AlertCircle className="h-5 w-5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">
                            Existing Listing Found!
                            {matchedBy && <span className="font-normal text-xs ml-2">(matched by {matchedBy})</span>}
                          </span>
                          {searchResult.map_verified && (
                            <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                              VERIFIED
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-normal mt-1">Pre-filled from existing listing - modify if needed</p>
                      </div>
                    </div>
                  </div>
                )}
                {searchError && !searching && (
                  <div className="p-4 rounded-md border border-red-300 bg-red-50">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-semibold">{searchError}</span>
                    </div>
                  </div>
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

            {/* RIGHT: New listing notice */}
            {!searchResult && searchPerformed && !searching && (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-green-400 bg-green-50 px-8 py-16 text-center shadow-sm gap-6">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
                <div>
                  <p className="text-3xl font-bold text-green-700 leading-snug">
                    No existing listing found
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-green-600">
                    {listingId ? `ID ${listingId} not in database — verify below` : "This appears to be new!"}
                  </p>
                </div>
                {/* GEO ID confirm + Extract */}
                <div className="flex flex-col items-center gap-3 w-full max-w-sm">
                  <div className="flex items-center gap-2 p-2 rounded-md border bg-white w-full">
                    <Checkbox
                      id="geo-id-confirm-notice"
                      checked={geoIdConfirmed}
                      onCheckedChange={(c) => setGeoIdConfirmed(!!c)}
                    />
                    <label htmlFor="geo-id-confirm-notice" className="text-xs text-muted-foreground font-medium cursor-pointer whitespace-nowrap">
                      GEO ID
                    </label>
                    <Input
                      value={newGeoId}
                      onChange={(e) => { setNewGeoId(e.target.value.toUpperCase()); setGeoIdConfirmed(false); }}
                      className="h-8 w-28 text-sm font-mono font-bold"
                      placeholder={targetTab === "Sheet2" ? "B00000" : "G00000"}
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
                      <span className="text-xs text-green-600 font-medium whitespace-nowrap">✓ CONFIRMED</span>
                    )}
                  </div>
                  {permissions.ai_extract !== false && (
                    <Button onClick={handleExtractData} disabled={loading} variant="default" className="w-full">
                      {loading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Extracting...</>
                      ) : (
                        <><Sparkles className="mr-2 h-4 w-4" />Extract & Review</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}

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
                    onClick={() => handleUpdateExisting()}
                    disabled={updating}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {updating ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>
                    ) : (
                      <><Save className="mr-2 h-4 w-4" />Update Existing</>
                    )}
                  </Button>
                  
                  {permissions.sheet2 === true && sourceTab === "Sheet2" && (
                    <Button
                      variant="outline"
                      className="border-red-600 text-red-600 hover:bg-red-50 shadow-lg border-2 ring-2 ring-red-500 ring-offset-2 transition-all"
                      onClick={() => {
                        const isBSeries = searchResult?.id?.startsWith("B");
                        const msg = isBSeries 
                          ? `Promote this listing to Sheet1? \n\nThe GEO ID will be transformed from ${searchResult.id} to ${searchResult.id.replace(/^B/, "G")}.`
                          : `Promote this listing to Sheet1? \n\nThe GEO ID (${searchResult.id}) will remain the same.`;
                        
                        if (window.confirm(msg)) {
                          handleUpdateExisting("Sheet1");
                        }
                      }}
                      disabled={updating}
                    >
                      <Sparkles className="h-4 w-4 mr-2 text-red-500" />
                      Promote to Sheet1
                    </Button>
                  )}
                  {permissions.ai_extract !== false && (
                    <Button onClick={handleExtractData} disabled={loading} variant="default">
                      {loading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Extracting...</>
                      ) : (
                        <><Sparkles className="mr-2 h-4 w-4" />Extract & Review</>
                      )}
                    </Button>
                  )}
                  {batchActive && permissions.ai_extract !== false && searchResult && (
                    <Button
                      onClick={handleExtractAndUpdate}
                      disabled={loading || updating}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {loading || (pendingExtractUpdate && updating) ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                      ) : (
                        <><Sparkles className="mr-2 h-4 w-4" />Extract / Update</>
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
                {/* Backup: no-match warning (SUPERADMIN only) */}
                {permissions.sheet2 === true && backupStatus === "not-found" && (
                  <div className="flex items-start gap-2 rounded-md border border-yellow-400 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                    <span className="mt-0.5 shrink-0">⚠️</span>
                    <span>GEO ID <strong>{searchResult.id}</strong> not found in 2nd Backup sheet. Updates will only write to the Working GSheet.</span>
                  </div>
                )}

                {/* Backup: conflict resolution (SUPERADMIN only) */}
                {permissions.sheet2 === true && backupStatus === "conflict" && !conflictResolved && backupData && (
                  <Card className="border-orange-200 bg-orange-50/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base font-semibold text-orange-800">
                        <AlertCircle className="h-4 w-4" />
                        Conflict Detected — Data Mismatch
                      </CardTitle>
                      <CardDescription className="text-orange-700 font-medium">
                        The Working GSheet data differs from the 2nd Backup. Choose the version to keep.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="overflow-hidden rounded-md border border-orange-200 bg-white shadow-sm">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-orange-100/30">
                              <th className="px-3 py-2 text-left font-bold text-orange-900 border-b border-orange-200">Field</th>
                              <th className="px-3 py-2 text-left font-bold text-blue-900 border-b border-orange-200">Working Sheet</th>
                              <th className="px-3 py-2 text-left font-bold text-purple-900 border-b border-orange-200">2nd Backup</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-orange-100">
                            {[
                              { label: "Status", working: available || searchResult.status || "", backup: backupData.available },
                              { label: "City", working: editCity, backup: backupData.city },
                              { label: "Lot Area", working: editLotArea, backup: backupData.lotArea },
                              { label: "Floor Area", working: editFloorArea, backup: backupData.floorArea },
                              { label: "Price", working: editPrice, backup: backupData.price },
                            ].map(({ label, working, backup }) => {
                              const diff = normalizeTextNumbers(working) !== normalizeTextNumbers(backup);
                              return (
                                <tr key={label} className={diff ? "bg-red-50/40" : "hover:bg-gray-50/40 transition-colors"}>
                                  <td className="px-3 py-2.5 font-semibold text-gray-700">{label}</td>
                                  <td className={`px-3 py-2.5 ${diff ? "font-bold text-blue-700" : "text-gray-500 italic"}`}>{working || "—"}</td>
                                  <td className={`px-3 py-2.5 ${diff ? "font-bold text-purple-700" : "text-gray-500 italic"}`}>{backup || "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConflictResolved(true)}
                          className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                        >
                          Keep Working Sheet
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditSummary(backupData.blastedFormat);
                            setEditArea(backupData.area);
                            setEditCity(backupData.city);
                            setEditLotArea(backupData.lotArea);
                            setEditFloorArea(backupData.floorArea);
                            setEditPrice(backupData.price);
                            setEditStatus(normalizeStatus(backupData.available));
                            setAvailable(backupData.available);
                            if (backupData.saleOrLease) {
                              const v = backupData.saleOrLease.toLowerCase();
                              if (v.includes("sale") && v.includes("lease")) setSaleOrLease("Sale/Lease");
                              else if (v.includes("lease")) setSaleOrLease("Lease");
                              else if (v.includes("sale")) setSaleOrLease("Sale");
                            }
                            setOwnerBroker(backupData.ownerBroker);
                            setHowManyAway(backupData.away);
                            setListingOwnership(backupData.listingOwnership);
                            setConflictResolved(true);
                            toast({
                              title: "Restored from Backup",
                              description: "The form has been updated with values from the 2nd Backup.",
                            });
                          }}
                          className="border-purple-300 text-purple-700 hover:bg-purple-50"
                        >
                          Keep 2nd Backup
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Backup: conflict resolved confirmation */}
                {backupStatus === "conflict" && conflictResolved && (
                  <div className="flex items-center gap-2 rounded-md border border-green-400 bg-green-50 px-3 py-2 text-sm text-green-800">
                    <span>✅</span>
                    <span>Conflict resolved — Extract / Update will write to both Working GSheet and 2nd Backup.</span>
                  </div>
                )}

                <Card className={batchAutoPaused && !flashDismissed ? (flashOn ? "border-2 border-red-600 bg-red-500 text-white" : "border-2 border-red-400 bg-red-50") : useExistingMain ? "border-green-500 ring-1 ring-green-500" : ""}>
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
                          autoResize
                          className="font-mono text-xs leading-relaxed resize-y"
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
                  {/* Status radio buttons span full width */}
                  <div className={`col-span-3 flex items-center gap-4 flex-wrap rounded px-2 py-0.5 transition-colors ${batchAutoPaused && !flashDismissed && editStatus !== "AVAILABLE" ? (flashOn ? "bg-red-500 text-white" : "bg-red-50 border border-red-400") : ""}`}>
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
                      <Label className="text-xs text-muted-foreground w-16 shrink-0">Direct/CoBroker</Label>
                      <Select value={directOrCobroker} onValueChange={handleDirectOrCobrokerChange}>
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
                      <Label className="text-xs text-muted-foreground w-16 shrink-0">Owner/CoBroker</Label>
                      <Input value={ownerBroker} onChange={(e) => handleOwnerBrokerChange(e.target.value)} className="h-8 text-sm" />
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
                                        <Input type="date" value={dateReceived} max={getTodayDate()} onChange={(e) => handleInputChange(setDateReceived)(e.target.value)} className="h-8 text-sm" />

                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Updated</Label>
                    <Input type="date" value={dateUpdated} max={getTodayDate()} onChange={(e) => { setDateUpdated(e.target.value); setTodayToggle(e.target.value === getTodayDate()); }} className="h-8 text-sm flex-1" />
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
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Listing Ownership</Label>
                    <Select 
                      value={listingOwnership} 
                      onValueChange={(v) => handleInputChange(setListingOwnership)(v)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <span className={listingOwnership === " " ? "opacity-0" : ""}>
                          <SelectValue placeholder="Select ownership..." />
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value=" ">&lt;blank&gt;</SelectItem>
                        {allOwnershipOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Checkbox id="new-location-verified" checked={locationVerified} onCheckedChange={(checked) => handleInputChange(setLocationVerified)(!!checked)} />
                        <Label htmlFor="new-location-verified" className="text-sm font-medium leading-none pt-0.5 cursor-pointer">Location Verified</Label>
                      </div>
                      {searchResult.map_verified && (
                        <div className="flex items-center gap-2 ml-6">
                          <p className="text-[10px] text-muted-foreground italic">
                            Current: {searchResult.map_verified}
                          </p>
                          <button 
                            type="button"
                            onClick={() => setLocationVerified(false)}
                            className="text-[10px] text-blue-600 hover:text-blue-800 underline font-medium"
                          >
                            Clear
                          </button>
                        </div>
                      )}
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

                    {/* Row 9: amenities, corner, compound, monthly dues */}
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
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-16 shrink-0">Monthly Dues</Label>
                      <Input value={monthlyDues} onChange={(e) => handleInputChange(setMonthlyDues)(e.target.value)} className="h-8 text-sm" placeholder="e.g. 5,000/month" />
                    </div>

                    {/* Row 10: COMMENTS, SPONSOR START, SPONSOR END */}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-16 shrink-0">Comments</Label>
                      <Input value={comments} onChange={(e) => handleInputChange(setComments, true)(e.target.value)} className="h-8 text-sm" />
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
                  {/* Status radio buttons span full width — placed above Type */}
                  <div className={`col-span-3 flex items-center gap-4 flex-wrap rounded px-2 py-0.5 transition-colors ${batchAutoPaused && !flashDismissed && editStatus !== "AVAILABLE" ? (flashOn ? "bg-red-500 text-white" : "bg-red-50 border border-red-400") : ""}`}>
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
                      <Label className="text-xs text-muted-foreground w-16 shrink-0">Direct/CoBroker</Label>
                      <Select value={directOrCobroker} onValueChange={handleDirectOrCobrokerChange}>
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
                      <Label className="text-xs text-muted-foreground w-16 shrink-0">Owner/CoBroker</Label>
                      <Input value={ownerBroker} onChange={(e) => handleOwnerBrokerChange(e.target.value)} className="h-8 text-sm" />
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
                                        <Input type="date" value={dateReceived} max={getTodayDate()} onChange={(e) => handleInputChange(setDateReceived)(e.target.value)} className="h-8 text-sm" />

                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Listing Ownership</Label>
                    <Select 
                      value={listingOwnership} 
                      onValueChange={(v) => handleInputChange(setListingOwnership)(v)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <span className={listingOwnership === " " ? "opacity-0" : ""}>
                          <SelectValue placeholder="Select ownership..." />
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value=" ">&lt;blank&gt;</SelectItem>
                        {allOwnershipOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      <Checkbox id="edit-location-verified" checked={locationVerified} onCheckedChange={(checked) => handleInputChange(setLocationVerified)(!!checked)} />
                      <Label htmlFor="edit-location-verified" className="text-sm font-medium leading-none pt-0.5 cursor-pointer">Location Verified</Label>
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
                    {/* Row 8: AMENITIES, CORNER, COMPOUND, MONTHLY DUES */}
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
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-16 shrink-0">Monthly Dues</Label>
                      <Input value={monthlyDues} onChange={(e) => handleInputChange(setMonthlyDues)(e.target.value)} className="h-8 text-sm" placeholder="e.g. 5,000/month" />
                    </div>
                    {/* Row 9: COMMENTS, SPONSOR START, SPONSOR END */}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-16 shrink-0">Comments</Label>
                      <Input value={comments} onChange={(e) => handleInputChange(setComments, true)(e.target.value)} className="h-8 text-sm" />
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
                  onClick={() => handleUpdateExisting()}
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
                {/* Status radio buttons span full width — above Type */}
                <div className="col-span-3 flex items-center gap-4 flex-wrap">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Status</Label>
                  <span className="text-xs min-w-[100px] font-medium">
                    {editStatus || "—"}
                  </span>
                  {["AVAILABLE", "SOLD", "LEASED OUT", "OFF MARKET", "ON HOLD", "UNDER NEGO", "UNDECISIVE SELLER"].map((status) => (
                    <div key={status} className="flex items-center gap-1">
                      <input
                        type="radio"
                        id={`review-status-top-${status}`}
                        name="review-status"
                        checked={editStatus === status}
                        onChange={() => handleInputChange(setEditStatus)(status)}
                        className="h-3 w-3 cursor-pointer"
                      />
                      <label htmlFor={`review-status-top-${status}`} className="text-xs cursor-pointer whitespace-nowrap">
                        {status}
                      </label>
                    </div>
                  ))}
                </div>

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
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Direct/CoBroker</Label>
                  <Select value={directOrCobroker} onValueChange={handleDirectOrCobrokerChange}>
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
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Owner/CoBroker</Label>
                  <Input value={ownerBroker} onChange={(e) => handleOwnerBrokerChange(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Away</Label>
                  <Input value={howManyAway} onChange={(e) => handleInputChange(setHowManyAway)(e.target.value)} className="h-8 text-sm" />
                </div>

                {/* Row 4 */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Received</Label>
                                    <Input type="date" value={dateReceived} max={getTodayDate()} onChange={(e) => handleInputChange(setDateReceived)(e.target.value)} className="h-8 text-sm" />

                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Updated</Label>
                  <Input type="date" value={dateUpdated} max={getTodayDate()} onChange={(e) => { setDateUpdated(e.target.value); setTodayToggle(e.target.value === getTodayDate()); }} className="h-8 text-sm flex-1" />
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
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Listing Ownership</Label>
                  <Select 
                    value={listingOwnership} 
                    onValueChange={(v) => handleInputChange(setListingOwnership)(v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <span className={listingOwnership === " " ? "opacity-0" : ""}>
                        <SelectValue placeholder="Select ownership..." />
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=" ">&lt;blank&gt;</SelectItem>
                      {allOwnershipOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    onChange={(e) => handleInputChange(setPhotosLink, true)(e.target.value)}
                    className="h-8 text-sm"
                  />
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
                    <Checkbox id="batch-location-verified" checked={locationVerified} onCheckedChange={(checked) => handleInputChange(setLocationVerified)(!!checked)} />
                    <Label htmlFor="batch-location-verified" className="text-sm font-medium leading-none pt-0.5 cursor-pointer">Location Verified</Label>
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

                  {/* Row 8: amenities, corner, compound, monthly dues */}
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
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Monthly Dues</Label>
                    <Input value={monthlyDues} onChange={(e) => handleInputChange(setMonthlyDues)(e.target.value)} className="h-8 text-sm" placeholder="e.g. 5,000/month" />
                  </div>
                  {/* Row 9: comments, sponsor start, sponsor end */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-16 shrink-0">Comments</Label>
                    <Input value={comments} onChange={(e) => handleInputChange(setComments, true)(e.target.value)} className="h-8 text-sm" />
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

      {showTelegramModal && (() => {
        const META_GROUPS = ["UPDATE LISTING", "DIRECT", "RESIDENTIAL", "COM 'L / IND'L", "BUSINESS FOR SALE", "TEST"];
        const specificGroups = allTelegramGroups.filter(g => !META_GROUPS.includes(g.name));
        const toggleGroup = (name: string) =>
          setTelegramGroups(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);

        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div 
              className={cn(
                "bg-background rounded-lg shadow-xl w-full flex overflow-hidden",
                showTelegramProHub ? "max-w-4xl" : "max-w-md"
              )} 
              style={{ maxHeight: "90vh" }}
            >

              {/* LEFT PANEL — form */}
              <div className={cn(
                "flex flex-col p-6 overflow-y-auto",
                showTelegramProHub ? "w-[420px] shrink-0 border-r" : "w-full"
              )}>
                <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                  <Send className="h-5 w-5 text-blue-600" />
                  Telegram Post
                </h3>

                {/* Meta group checkboxes */}
                <div className="mb-4">
                  <Label className="text-xs text-muted-foreground mb-2 block">Group</Label>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {META_GROUPS.map(name => (
                      <label key={name} className="flex items-center gap-1.5 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={telegramGroups.includes(name)}
                          onChange={() => toggleGroup(name)}
                          className="accent-blue-600 h-3.5 w-3.5"
                        />
                        <span className={telegramGroups.includes(name) ? "font-medium text-blue-700" : ""}>{name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 flex-1">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Line 1 (Header)</Label>
                    <Input value={telegramLine1} onChange={e => setTelegramLine1(e.target.value)} className="font-mono text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Line 2 (Status)</Label>
                    <select
                      value={telegramLine2}
                      onChange={e => setTelegramLine2(e.target.value)}
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    >
                      <option value="">(none — skip)</option>
                      <option value="SOLD">SOLD</option>
                      <option value="LEASED OUT">LEASED OUT</option>
                      <option value="UPDATED FORMAT">UPDATED FORMAT</option>
                      <option value="OFF THE MARKET">OFF THE MARKET</option>
                      <option value="UNDER NEGO">UNDER NEGO</option>
                      <option value="UNDECISIVE SELLER">UNDECISIVE SELLER</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Line 3 (Notes — optional)</Label>
                    <Textarea
                      value={telegramLine3Notes}
                      onChange={e => setTelegramLine3Notes(e.target.value)}
                      className="min-h-16 text-sm"
                      placeholder="Add any notes here... (leave blank to skip)"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Line 4 (Broker / Owner)</Label>
                    <Input value={telegramLine3} onChange={e => setTelegramLine3(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Line 5 (Listing Ownership)</Label>
                    <Input value={telegramLine4} onChange={e => setTelegramLine4(e.target.value)} className="text-sm" placeholder="Listing ownership (optional)" />
                  </div>
                </div>

                <div className="flex gap-2 justify-end mt-4 pt-3 border-t">
                  <Button variant="outline" onClick={() => setShowTelegramModal(false)} disabled={updating || adding || isSendingOnly}>
                    <X className="mr-2 h-4 w-4" />Cancel
                  </Button>
                  <Button onClick={handleSendOnlyTelegram} disabled={updating || adding || isSendingOnly} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {isSendingOnly ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : <><Send className="mr-2 h-4 w-4" />SEND ONLY</>}
                  </Button>
                  <Button onClick={handleTelegramConfirm} disabled={updating || adding || isSendingOnly} className="bg-green-600 hover:bg-green-700 text-white">
                    <Save className="mr-2 h-4 w-4" />Send &amp; Update
                  </Button>
                </div>
              </div>

              {/* RIGHT PANEL — specific group search */}
              {showTelegramProHub && (
                <div className="flex flex-col p-6 flex-1 min-w-0">
                  <Label className="text-xs text-muted-foreground mb-2 block">Group</Label>
                  <div className="relative mb-2">
                    <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search groups..."
                      value={telegramSearch}
                      onChange={(e) => setTelegramSearch(e.target.value)}
                      className="pl-8 h-9 text-sm"
                    />
                  </div>
                  <div className="border rounded-md flex-1 overflow-y-auto p-2 bg-slate-50/50">
                    {specificGroups
                      .filter(g =>
                        g.name.toLowerCase().includes(telegramSearch.toLowerCase()) ||
                        telegramGroups.includes(g.name)
                      )
                      .sort((a, b) => {
                        const aSelected = telegramGroups.includes(a.name);
                        const bSelected = telegramGroups.includes(b.name);
                        if (aSelected && !bSelected) return -1;
                        if (!aSelected && bSelected) return 1;
                        return a.name.localeCompare(b.name);
                      })
                      .map(group => (
                        <label key={group.id} className={cn(
                          "flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors text-sm",
                          telegramGroups.includes(group.name) ? "bg-blue-50 text-blue-700" : "hover:bg-slate-100"
                        )}>
                          <input
                            type="checkbox"
                            checked={telegramGroups.includes(group.name)}
                            onChange={() => toggleGroup(group.name)}
                            className="accent-blue-600 h-3.5 w-3.5 shrink-0"
                          />
                          <span className="truncate">{group.name}</span>
                        </label>
                      ))}
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground px-1 mt-1">
                    <span>{telegramGroups.length} selected</span>
                    {telegramGroups.length > 0 && (
                      <button onClick={() => setTelegramGroups([])} className="text-blue-600 hover:underline" type="button">
                        Clear all
                      </button>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        );
      })()}

    </div>
  );
}

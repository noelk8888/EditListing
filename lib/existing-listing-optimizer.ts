export type ExistingListingDeterministicPatch = {
  status?: string;
  saleOrLease?: "Sale" | "Lease" | "Sale/Lease";
  salePrice?: string;
  salePricePerSqm?: string;
  leasePrice?: string;
  leasePricePerSqm?: string;
  bedrooms?: string;
  toilets?: string;
  garage?: string;
  photos?: string;
  fbLink?: string;
  directOrCobroker?: "Direct to Owner" | "With Cobroker";
  ownerBroker?: string;
  howManyAway?: string;
};

export type ExistingListingOptimizationDecision =
  | {
      mode: "deterministic";
      reason: "unchanged" | "status-only" | "safe-labeled-fields";
      patch: ExistingListingDeterministicPatch;
      changedFields: string[];
    }
  | {
      mode: "ai";
      reason: string;
    };

type ClassifiedLine =
  | { kind: "ignored"; normalized: string }
  | {
      kind: "field";
      field: keyof ExistingListingDeterministicPatch;
      value: string;
      additionalFields?: Array<{ field: keyof ExistingListingDeterministicPatch; value: string }>;
      normalized: string;
    }
  | { kind: "content"; normalized: string };

type ExtractedField = {
  field: keyof ExistingListingDeterministicPatch;
  value: string;
  normalized: string;
};

const PRICE_FIELDS = new Set<keyof ExistingListingDeterministicPatch>([
  "salePrice",
  "salePricePerSqm",
  "leasePrice",
  "leasePricePerSqm",
]);

const AVAILABILITY_STATUSES = [
  "AVAILABLE",
  "SOLD",
  "LEASED OUT",
  "OFF THE MARKET",
  "ON HOLD",
  "UNDER NEGO",
  "DELISTED",
] as const;

function stripMarkdown(value: string): string {
  return value.trim().replace(/^\*+|\*+$/g, "").trim();
}

function normalizeContent(value: string): string {
  return stripMarkdown(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .trim()
    .toLowerCase();
}

function cleanUrl(value: string): string {
  return value.trim().replace(/[)>.,;]+$/g, "");
}

function normalizeMoney(value: string): string {
  const compact = value.replace(/\s+/g, "").replace(/,/g, "").toUpperCase();
  const match = compact.match(/^(\d+(?:\.\d+)?)([KMB])?$/);
  if (!match) return "";

  const multiplier = match[2] === "K"
    ? 1_000
    : match[2] === "M"
      ? 1_000_000
      : match[2] === "B"
        ? 1_000_000_000
        : 1;
  const amount = Number(match[1]) * multiplier;
  return Number.isFinite(amount) ? String(amount) : "";
}

function extractMoney(value: string): string {
  const match = value.match(/(?:PHP|PHP\.|P|₱)?\s*(\d[\d,]*(?:\.\d+)?\s*[KMB]?)/i);
  return match ? normalizeMoney(match[1]) : "";
}

function extractPerSqm(value: string): string {
  const match = value.match(
    /(?:PHP|PHP\.|P|₱)?\s*(\d[\d,]*(?:\.\d+)?\s*[KMB]?)\s*(?:\/|per\s+)(?:sq\.?\s*m|sqm|m²|m2)\b/i
  );
  return match ? normalizeMoney(match[1]) : "";
}

function parseStatus(line: string): string | null {
  const upper = stripMarkdown(line).toUpperCase();
  for (const status of AVAILABILITY_STATUSES) {
    if (new RegExp(`^${status.replace(/ /g, "\\s+")}(?:\\s+-\\s+[A-Z]+\\s+\\d{4})?$`).test(upper)) {
      return status;
    }
  }
  return null;
}

function classifyLine(rawLine: string): ClassifiedLine | null {
  const line = rawLine.trim();
  if (!line) return null;
  const plain = stripMarkdown(line);
  const normalized = normalizeContent(line);

  if (/^[A-Z]\d{4,6}(?:-D)?$/i.test(plain)) {
    return { kind: "ignored", normalized };
  }
  if (/^(?:LISTING\s+)?UPDATE\b/i.test(plain) || /^UPDATED\s+FORMAT\b/i.test(plain)) {
    return { kind: "ignored", normalized };
  }
  if (/^(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})\s+update\b/i.test(plain)) {
    return { kind: "ignored", normalized };
  }

  const status = parseStatus(line);
  if (status) return { kind: "field", field: "status", value: status, normalized };

  if (/^FOR\s+SALE(?:\s*(?:AND|\/|&)\s*LEASE)?$/i.test(plain)) {
    const value = /(?:AND|\/|&)\s*LEASE/i.test(plain) ? "Sale/Lease" : "Sale";
    return { kind: "field", field: "saleOrLease", value, normalized };
  }
  if (/^FOR\s+(?:LEASE|RENT)$/i.test(plain)) {
    return { kind: "field", field: "saleOrLease", value: "Lease", normalized };
  }

  let match = plain.match(/^(?:selling\s+price|sale\s+price|price)\s*:\s*(.+)$/i);
  if (match) {
    const salePrice = extractMoney(match[1]);
    if (salePrice) {
      const salePricePerSqm = extractPerSqm(match[1]);
      return {
        kind: "field",
        field: "salePrice",
        value: salePrice,
        additionalFields: salePricePerSqm
          ? [{ field: "salePricePerSqm", value: salePricePerSqm }]
          : undefined,
        normalized,
      };
    }
  }

  match = plain.match(/^(?:sale\s+)?price\s*(?:\/|per\s+)(?:sq\.?\s*m|sqm|m²|m2)\s*:\s*(.+)$/i);
  if (match) {
    const salePricePerSqm = extractMoney(match[1]);
    if (salePricePerSqm) {
      return { kind: "field", field: "salePricePerSqm", value: salePricePerSqm, normalized };
    }
  }

  match = plain.match(/^(?:lease\s+(?:rate|price)|rental\s+rate|monthly\s+rent|rent)\s*:\s*(.+)$/i);
  if (match) {
    const leasePrice = extractMoney(match[1]);
    if (leasePrice) {
      const leasePricePerSqm = extractPerSqm(match[1]);
      return {
        kind: "field",
        field: "leasePrice",
        value: leasePrice,
        additionalFields: leasePricePerSqm
          ? [{ field: "leasePricePerSqm", value: leasePricePerSqm }]
          : undefined,
        normalized,
      };
    }
  }

  match = plain.match(/^lease\s+(?:rate|price)\s*(?:\/|per\s+)(?:sq\.?\s*m|sqm|m²|m2)\s*:\s*(.+)$/i);
  if (match) {
    const leasePricePerSqm = extractMoney(match[1]);
    if (leasePricePerSqm) {
      return { kind: "field", field: "leasePricePerSqm", value: leasePricePerSqm, normalized };
    }
  }

  match = plain.match(/^(?:bedrooms?|br)\s*:\s*(\d+)$/i) || plain.match(/^(\d+)\s+(?:bedrooms?|br)$/i);
  if (match) return { kind: "field", field: "bedrooms", value: match[1], normalized };

  match = plain.match(/^(?:toilets?|bathrooms?|baths?|t\s*&\s*b)\s*:\s*(\d+)$/i) ||
    plain.match(/^(\d+)\s+(?:toilets?|bathrooms?|baths?|t\s*&\s*b)$/i);
  if (match) return { kind: "field", field: "toilets", value: match[1], normalized };

  match = plain.match(/^(?:garage|parking(?:\s+slots?)?)\s*:\s*(\d+)$/i) ||
    plain.match(/^(\d+)\s+(?:car\s+)?(?:garage|parking(?:\s+slots?)?)$/i);
  if (match) return { kind: "field", field: "garage", value: match[1], normalized };
  if (/^tandem\s+parking(?:\s+slot)?$/i.test(plain)) {
    return { kind: "field", field: "garage", value: "2", normalized };
  }

  match = plain.match(/^(?:photos?|photo\s+link|google\s+photos?)\s*:\s*(https?:\/\/\S+)$/i);
  if (match) return { kind: "field", field: "photos", value: cleanUrl(match[1]), normalized };

  match = plain.match(/^(?:facebook|fb|social\s+media|socmed)(?:\s+link)?\s*:\s*(https?:\/\/\S+)$/i);
  if (match) return { kind: "field", field: "fbLink", value: cleanUrl(match[1]), normalized };

  if (/^(?:direct|direct\s+(?:listing|to\s+(?:owner|seller)))$/i.test(plain)) {
    return { kind: "field", field: "directOrCobroker", value: "Direct to Owner", normalized };
  }
  if (/^(?:with\s+)?(?:co[- ]?broker|co[- ]?broke|cobroker)$/i.test(plain)) {
    return { kind: "field", field: "directOrCobroker", value: "With Cobroker", normalized };
  }

  match = plain.match(/^(\d+)\s+away(?:\s+from\s+(?:owner|seller))?$/i);
  if (match) return { kind: "field", field: "howManyAway", value: match[1], normalized };

  match = plain.match(/^(?:owner|broker|agent)\s*:\s*([^\d]+)$/i);
  if (match && match[1].trim().length >= 2) {
    return { kind: "field", field: "ownerBroker", value: match[1].trim(), normalized };
  }

  return { kind: "content", normalized };
}

function collectLines(text: string): ClassifiedLine[] {
  return text.split(/\r?\n/).map(classifyLine).filter((line): line is ClassifiedLine => Boolean(line));
}

function subtractLines(source: ClassifiedLine[], other: ClassifiedLine[]): ClassifiedLine[] {
  const counts = new Map<string, number>();
  for (const line of other) counts.set(line.normalized, (counts.get(line.normalized) || 0) + 1);

  return source.filter((line) => {
    const count = counts.get(line.normalized) || 0;
    if (count <= 0) return true;
    counts.set(line.normalized, count - 1);
    return false;
  });
}

function expandFields(lines: ClassifiedLine[]): ExtractedField[] {
  return lines.flatMap((line) => {
    if (line.kind !== "field") return [];
    return [
      { field: line.field, value: line.value, normalized: line.normalized },
      ...(line.additionalFields || []).map((additional) => ({
        ...additional,
        normalized: line.normalized,
      })),
    ];
  });
}

function collectPricePatch(lines: ClassifiedLine[]): ExistingListingDeterministicPatch {
  const patch: ExistingListingDeterministicPatch = {};
  for (const extracted of expandFields(lines)) {
    if (PRICE_FIELDS.has(extracted.field)) {
      (patch as Record<string, string>)[extracted.field] = extracted.value;
    }
  }
  return patch;
}

export function optimizeExistingListingParse(input: {
  text: string;
  existingSummary: string;
  explicitStatus?: string;
}): ExistingListingOptimizationDecision {
  if (!input.text.trim() || !input.existingSummary.trim()) {
    return { mode: "ai", reason: "Missing listing text needed for a safe comparison" };
  }

  const nextLines = collectLines(input.text);
  const previousLines = collectLines(input.existingSummary);
  const added = subtractLines(nextLines, previousLines).filter((line) => line.kind !== "ignored");
  const removed = subtractLines(previousLines, nextLines).filter((line) => line.kind !== "ignored");
  const explicitStatus = input.explicitStatus?.trim().toUpperCase() || "";
  const pricePatch = collectPricePatch(nextLines);

  if (added.length === 0 && removed.length === 0) {
    const patch: ExistingListingDeterministicPatch = {
      ...pricePatch,
      ...(explicitStatus ? { status: explicitStatus } : {}),
    };
    return {
      mode: "deterministic",
      reason: explicitStatus ? "status-only" : "unchanged",
      patch,
      changedFields: Object.keys(patch),
    };
  }

  if (added.some((line) => line.kind === "content") || removed.some((line) => line.kind === "content")) {
    return { mode: "ai", reason: "Unstructured listing content changed" };
  }

  const addedFields = expandFields(added);
  const removedFields = expandFields(removed);
  const addedByField = new Map(addedFields.map((line) => [line.field, line]));
  const removedByField = new Map(removedFields.map((line) => [line.field, line]));

  // Replacing FOR SALE/LEASE with an explicit availability status does not
  // change the listing's existing sale/lease classification.
  if (explicitStatus && removedByField.has("saleOrLease") && addedByField.has("status")) {
    removedByField.delete("saleOrLease");
  }

  for (const [field] of Array.from(removedByField.entries())) {
    if (!addedByField.has(field)) {
      return { mode: "ai", reason: `A previously populated ${field} line was removed` };
    }
  }

  if (addedByField.has("saleOrLease")) {
    return { mode: "ai", reason: "Sale/lease classification changed" };
  }

  const patch: ExistingListingDeterministicPatch = { ...pricePatch };
  for (const [field, line] of Array.from(addedByField.entries())) {
    if (field === "saleOrLease") continue;
    (patch as Record<string, string>)[field] = line.value;
  }
  if (explicitStatus) patch.status = explicitStatus;
  if ((explicitStatus || addedByField.get("status")?.value) === "LEASED OUT") {
    patch.saleOrLease = "Lease";
  }

  const changedFields = Object.keys(patch);
  const isStatusOnlyChange = Boolean(explicitStatus || addedByField.has("status")) &&
    Array.from(addedByField.keys()).every((field) => field === "status");
  return {
    mode: "deterministic",
    reason: isStatusOnlyChange ? "status-only" : "safe-labeled-fields",
    patch,
    changedFields,
  };
}

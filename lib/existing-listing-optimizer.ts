export type ExistingListingDeterministicPatch = {
  status?: string;
  saleOrLease?: "Sale" | "Lease" | "Sale/Lease";
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
  | { kind: "field"; field: keyof ExistingListingDeterministicPatch | "saleOrLease"; value: string; normalized: string }
  | { kind: "content"; normalized: string };

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

  let match = plain.match(/^(?:bedrooms?|br)\s*:\s*(\d+)$/i) || plain.match(/^(\d+)\s+(?:bedrooms?|br)$/i);
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

  if (added.length === 0 && removed.length === 0) {
    return {
      mode: "deterministic",
      reason: explicitStatus ? "status-only" : "unchanged",
      patch: explicitStatus ? { status: explicitStatus } : {},
      changedFields: explicitStatus ? ["status"] : [],
    };
  }

  if (added.some((line) => line.kind === "content") || removed.some((line) => line.kind === "content")) {
    return { mode: "ai", reason: "Unstructured listing content changed" };
  }

  const addedFields = added.filter((line): line is Extract<ClassifiedLine, { kind: "field" }> => line.kind === "field");
  const removedFields = removed.filter((line): line is Extract<ClassifiedLine, { kind: "field" }> => line.kind === "field");
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

  const patch: ExistingListingDeterministicPatch = {};
  for (const [field, line] of Array.from(addedByField.entries())) {
    if (field === "saleOrLease") continue;
    (patch as Record<string, string>)[field] = line.value;
  }
  if (explicitStatus) patch.status = explicitStatus;
  if ((explicitStatus || addedByField.get("status")?.value) === "LEASED OUT") {
    patch.saleOrLease = "Lease";
  }

  const changedFields = Object.keys(patch);
  return {
    mode: "deterministic",
    reason: changedFields.length === 1 && changedFields[0] === "status" ? "status-only" : "safe-labeled-fields",
    patch,
    changedFields,
  };
}

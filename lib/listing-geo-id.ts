const GEO_ID_PATTERN = /^[A-Z]\d{4,6}(?:-D)?$/i;

export function normalizeGeoId(value: string): string {
  return (value || "").replace(/[\u2013\u2014]/g, "-").trim().toUpperCase();
}

export function isGeoIdLine(value: string): boolean {
  return GEO_ID_PATTERN.test(normalizeGeoId(value));
}

/**
 * Remove GEO-ID-only lines from the beginning of MAIN content.
 *
 * All leading IDs are removed—not only the expected ID—so an old ID, a new
 * ID, or repeated copies cannot survive a promotion or manual edit. GEO IDs
 * mentioned later in the listing body are intentionally preserved.
 */
export function stripLeadingGeoIds(text: string): string {
  const lines = (text || "").replace(/\r\n?/g, "\n").split("\n");

  while (lines.length > 0 && !lines[0].trim()) lines.shift();
  while (lines.length > 0 && isGeoIdLine(lines[0])) {
    lines.shift();
    while (lines.length > 0 && !lines[0].trim()) lines.shift();
  }

  return lines.join("\n").trim();
}

/** Ensure MAIN starts with exactly one canonical GEO ID. */
export function ensureSingleLeadingGeoId(text: string, geoId: string): string {
  const normalizedGeoId = normalizeGeoId(geoId);
  const content = stripLeadingGeoIds(text);

  if (!normalizedGeoId) return content;
  return content ? `${normalizedGeoId}\n${content}` : normalizedGeoId;
}

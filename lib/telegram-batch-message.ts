export type TelegramUpdateStatus = "SOLD" | "LEASED OUT" | "OFF THE MARKET" | "ON HOLD" | "UNDER NEGO" | "DELISTED" | "";

export function getTelegramUpdateStatus(text: string): TelegramUpdateStatus {
  const upper = (text || "").toUpperCase();
  if (/\bLEASED\s+OUT\b/.test(upper)) return "LEASED OUT";
  if (/\bOFF\s+(?:THE\s+)?MARKET\b/.test(upper)) return "OFF THE MARKET";
  if (/\bON\s+HOLD\b/.test(upper)) return "ON HOLD";
  if (/\bUNDER\s+NEGO(?:TIATION)?\b/.test(upper)) return "UNDER NEGO";
  if (/\bDELISTED\b/.test(upper)) return "DELISTED";
  if (/\bSOLD\b/.test(upper)) return "SOLD";
  return "";
}

export function isTelegramUpdateMessage(text: string) {
  const upper = (text || "").toUpperCase();
  return /\b(?:LISTING\s+)?UPDATE\b/.test(upper) ||
    /\bUPDATED\s+FORMAT\b/.test(upper) ||
    Boolean(getTelegramUpdateStatus(upper));
}

export function applyTelegramStatus(text: string, status: string, now = new Date()) {
  if (!status) return text;
  const monthYear = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "long",
    year: "numeric",
  }).format(now).toUpperCase();
  const statusLine = /^.*?\b(FOR\s+(SALE|LEASE|SALE\s*(AND|\/|&)\s*LEASE|SALE\/LEASE)|AVAILABLE|SOLD|LEASED OUT|OFF THE MARKET|ON HOLD|UNDER NEGO|DELISTED)\b.*$/im;
  return statusLine.test(text)
    ? text.replace(statusLine, `*${status} - ${monthYear}*`)
    : `*${status} - ${monthYear}*\n${text}`;
}

export function prepareTelegramListingForUpdate(text: string, status: string, now = new Date()) {
  const lines = (text || "").split("\n");
  const updateLine = /^(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})\s+update/i;
  const updateIndex = lines.findIndex((line) => updateLine.test(line.trim()));
  const listing = updateIndex === -1 ? text : lines.slice(0, updateIndex).join("\n").trim();
  return applyTelegramStatus(listing, status, now);
}

export function extractTelegramSearchCriteria(text: string) {
  const photosMatch = text.match(/https?:\/\/[^\s]*(?:photos|photo|goo\.gl)[^\s]*/i);
  const anyUrlMatch = text.match(/https?:\/\/[^\s]+/i);
  const listingIdMatch = text.match(/^([A-Z]\d{4,6})\b/m);
  return {
    photoLink: photosMatch?.[0] || anyUrlMatch?.[0] || "",
    listingId: listingIdMatch?.[1] || "",
    previewText: text.split("\n").filter((line) => line.trim()).slice(0, 10).join("\n"),
  };
}


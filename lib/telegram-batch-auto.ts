import { send } from "@vercel/queue";
import { ensureSingleLeadingGeoId, isGeoIdLine } from "@/lib/listing-geo-id";
import { resolveSaleOrLease } from "@/lib/listing-sale-or-lease";
import { getPHLDate } from "@/lib/utils";
import {
  getAutomaticBatchRetryRetentionSeconds,
  hasAutomaticBatchDeadlinePassed,
} from "@/lib/telegram-batch-schedule";
import {
  claimTelegramBatchRow,
  claimTelegramBatchRun,
  getTelegramBatchRow,
  listTelegramBatchRows,
  refreshTelegramBatchRun,
  releaseTelegramBatchRun,
  setTelegramBatchRowStatus,
} from "@/lib/telegram-batch-queue";
import {
  extractTelegramSearchCriteria,
  getTelegramUpdateStatus,
  isTelegramUpdateMessage,
  prepareTelegramListingForUpdate,
} from "@/lib/telegram-batch-message";

export const AUTO_BATCH_TOPIC = "telegram-batch-update-row";
export const AUTO_BATCH_START_TOPIC = "telegram-batch-update-start";
const AUTOMATIC_ACTOR = "automatic-nightly@system";

type JsonObject = Record<string, any>;
export type AutoBatchPayload = { pairId: string; lockToken: string; deadlineAt?: string };
export type AutoBatchStartPayload = { scheduledAt: string; deadlineAt: string };

export function isAutomaticBatchLockConflict(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.startsWith("A Batch Update is already running") ||
    message.startsWith("Another Batch Update started at the same time");
}

function getAppOrigin() {
  const configured = process.env.APP_URL || process.env.NEXTAUTH_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (host) return `https://${host}`;
  return "http://localhost:3000";
}

async function postInternal(path: string, body: JsonObject) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is not configured");
  const response = await fetch(`${getAppOrigin()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${data.error || data.details || "Unknown error"}`);
  }
  return data as JsonObject;
}

function asString(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function preferParsed(parsed: JsonObject, key: string, existing: unknown) {
  const value = parsed[key];
  return value === null || value === undefined || value === "" ? existing ?? "" : value;
}

function asNumberOrNull(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number.parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStatus(value: unknown) {
  const raw = asString(value).trim().toUpperCase();
  const aliases: Record<string, string> = {
    LEASED: "LEASED OUT",
    "OFF MARKET": "OFF THE MARKET",
    "UNDER NEGOTIATION": "UNDER NEGO",
  };
  return aliases[raw] || raw;
}

function buildUpdateBody(existing: JsonObject, parsed: JsonObject, preparedText: string, explicitStatus: string, sourceTab: string) {
  const aiUsed = parsed._optimization?.aiUsed !== false;
  let residential = Boolean(existing.residential);
  let commercial = Boolean(existing.commercial);
  let industrial = Boolean(existing.industrial);
  let agricultural = Boolean(existing.agricultural);

  if (aiUsed) {
    if (parsed.residential) {
      residential = true;
      if (!parsed.commercial) commercial = false;
      if (!parsed.industrial) industrial = false;
    } else {
      if (parsed.commercial) commercial = true;
      if (parsed.industrial) industrial = true;
    }
    if (parsed.agricultural) agricultural = true;
  }

  const salePrice = preferParsed(parsed, "salePrice", existing.price);
  const leasePrice = preferParsed(parsed, "leasePrice", existing.lease_price);
  const status = normalizeStatus(explicitStatus || preferParsed(parsed, "status", existing.status));
  const saleOrLease = resolveSaleOrLease({
    savedValue: preferParsed(parsed, "saleOrLease", existing.sale_or_lease),
    text: preparedText,
    status,
    salePrice,
    leasePrice,
  });
  const withIncome = parsed.withIncome === true
    ? "With Income"
    : parsed.withIncome === false
      ? "NO"
      : existing.with_income || "";

  return {
    id: existing.id,
    exactRowNumber: existing.row_index || null,
    region: preferParsed(parsed, "region", existing.region),
    province: preferParsed(parsed, "province", existing.province),
    city: preferParsed(parsed, "city", existing.city),
    barangay: preferParsed(parsed, "barangay", existing.barangay),
    area: preferParsed(parsed, "area", existing.area),
    building: preferParsed(parsed, "building", existing.building),
    type_description: preferParsed(parsed, "type", existing.type_description || existing.property_type),
    status,
    lot_area: asNumberOrNull(preferParsed(parsed, "lotArea", existing.lot_area)),
    floor_area: asNumberOrNull(preferParsed(parsed, "floorArea", existing.floor_area)),
    price: asNumberOrNull(salePrice),
    lease_price: asNumberOrNull(leasePrice),
    summary: ensureSingleLeadingGeoId(preparedText, existing.id),
    residential: residential ? "RESIDENTIAL" : "",
    commercial: commercial ? "COMMERCIAL" : "",
    industrial: industrial ? "INDUSTRIAL" : "",
    agricultural: agricultural ? "AGRICULTURAL" : "",
    with_income: withIncome,
    direct_or_broker: preferParsed(parsed, "directOrCobroker", existing.direct_or_broker),
    owner_broker: preferParsed(parsed, "ownerBroker", existing.owner_broker),
    how_many_away: preferParsed(parsed, "howManyAway", existing.how_many_away),
    listing_ownership: existing.listing_ownership || "",
    sale_or_lease: saleOrLease || existing.sale_or_lease || "",
    date_received: existing.date_received || getPHLDate(),
    date_updated: getPHLDate(),
    available: status,
    map_link: preferParsed(parsed, "mapLink", existing.map_link),
    sale_price_per_sqm: asNumberOrNull(preferParsed(parsed, "salePricePerSqm", existing.sale_price_per_sqm)),
    lease_price_per_sqm: asNumberOrNull(preferParsed(parsed, "leasePricePerSqm", existing.lease_price_per_sqm)),
    property_type: preferParsed(parsed, "type", existing.property_type),
    lat: preferParsed(parsed, "lat", existing.lat),
    long: preferParsed(parsed, "long", existing.long),
    location_verified: false,
    bedrooms: preferParsed(parsed, "bedrooms", existing.bedrooms),
    toilet: preferParsed(parsed, "toilets", existing.toilet),
    garage: preferParsed(parsed, "garage", existing.garage),
    amenities: preferParsed(parsed, "amenities", existing.amenities),
    corner: parsed.corner ? "Yes" : existing.corner || "",
    compound: parsed.compound ? "Yes" : existing.compound || "",
    monthly_dues: existing.monthly_dues || "",
    comments: existing.comments || "",
    fb_link: parsed.fbLink || parsed.socmedLink || existing.fb_link || "",
    photo_link: preferParsed(parsed, "photos", existing.photo_link),
    bv_col: existing.map_verified || "",
    send_telegram: false,
    lite_mode: true,
    telegram_groups: [],
    targetTab: sourceTab || "Sheet1",
  };
}

async function queueRow(payload: AutoBatchPayload) {
  await send(AUTO_BATCH_TOPIC, payload, {
    retentionSeconds: 24 * 60 * 60,
    idempotencyKey: `telegram-batch-auto:${payload.lockToken}:${payload.pairId}`,
  });
}

export async function queueAutomaticTelegramBatchStartRetry(deadlineAt: string) {
  const scheduledAt = new Date().toISOString();
  await send<AutoBatchStartPayload>(AUTO_BATCH_START_TOPIC, { scheduledAt, deadlineAt }, {
    retentionSeconds: getAutomaticBatchRetryRetentionSeconds(deadlineAt),
    idempotencyKey: `telegram-batch-auto-start:${scheduledAt.slice(0, 10)}`,
  });
  return { scheduledAt, deadlineAt };
}

export async function queueNextAutomaticTelegramBatchRow(lockToken: string, deadlineAt?: string) {
  await refreshTelegramBatchRun(lockToken);
  if (hasAutomaticBatchDeadlinePassed(deadlineAt)) {
    await releaseTelegramBatchRun(lockToken);
    return { finished: true, deadlineReached: true };
  }
  const rows = await listTelegramBatchRows();
  if (!rows.length) {
    await releaseTelegramBatchRun(lockToken);
    return { finished: true };
  }
  await queueRow({ pairId: rows[0].pairId, lockToken, deadlineAt });
  return { finished: false, pairId: rows[0].pairId };
}

export async function startAutomaticTelegramBatchRun(options?: { deadlineAt?: string }) {
  if (hasAutomaticBatchDeadlinePassed(options?.deadlineAt)) {
    return { started: false, finished: true, deadlineReached: true };
  }
  const lock = await claimTelegramBatchRun(AUTOMATIC_ACTOR);
  try {
    const next = await queueNextAutomaticTelegramBatchRow(lock.token, options?.deadlineAt);
    return { started: !next.finished, lockToken: next.finished ? undefined : lock.token, ...next };
  } catch (error) {
    await releaseTelegramBatchRun(lock.token).catch(() => undefined);
    throw error;
  }
}

export async function processAutomaticTelegramBatchRow(payload: AutoBatchPayload) {
  if (hasAutomaticBatchDeadlinePassed(payload.deadlineAt)) {
    await releaseTelegramBatchRun(payload.lockToken).catch(() => undefined);
    return { finished: true, deadlineReached: true };
  }
  await refreshTelegramBatchRun(payload.lockToken);
  const row = await getTelegramBatchRow(payload.pairId);
  if (!row) throw new Error("Automatic Batch Lite row was not found");

  if (row.status === "UPDATED" || row.status === "FOR MANUAL CHECKING") {
    return queueNextAutomaticTelegramBatchRow(payload.lockToken, payload.deadlineAt);
  }

  try {
    await claimTelegramBatchRow(payload.pairId, { resumeProcessing: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already\s+(?:UPDATED|FOR MANUAL CHECKING)/i.test(message)) {
      return queueNextAutomaticTelegramBatchRow(payload.lockToken, payload.deadlineAt);
    }
    throw error;
  }
  try {
    if (!isTelegramUpdateMessage(row.message2)) {
      throw new Error("Message 2 is not a supported listing update");
    }

    const explicitStatus = getTelegramUpdateStatus(row.message2);
    const preparedText = prepareTelegramListingForUpdate(row.message1, explicitStatus);
    const search = await postInternal("/api/search", extractTelegramSearchCriteria(preparedText));
    if (!search.result || search.matchedBy === "restricted" || !isGeoIdLine(String(search.result.id || ""))) {
      throw new Error("No eligible existing listing match was found");
    }

    const parsed = await postInternal("/api/parse", {
      text: preparedText,
      optimization: {
        mode: "existing-listing",
        existingSummary: search.result.summary || "",
        explicitStatus,
      },
    });
    const update = await postInternal(
      "/api/update",
      buildUpdateBody(search.result, parsed, preparedText, explicitStatus, search.sourceTab || "Sheet1")
    );
    if (!update.geoId) throw new Error("Automatic Batch Lite update returned no GEO ID");

    await setTelegramBatchRowStatus(payload.pairId, "UPDATED", String(update.geoId));
  } catch (error) {
    console.warn(
      `Automatic Batch Lite row ${payload.pairId} moved to FOR MANUAL CHECKING:`,
      error
    );
    await setTelegramBatchRowStatus(payload.pairId, "FOR MANUAL CHECKING");
  }

  return queueNextAutomaticTelegramBatchRow(payload.lockToken, payload.deadlineAt);
}

export async function failAutomaticTelegramBatchRow(payload: AutoBatchPayload, error: unknown) {
  console.error(`Automatic Batch Lite row ${payload.pairId} exhausted retries:`, error);
  await refreshTelegramBatchRun(payload.lockToken);
  await setTelegramBatchRowStatus(payload.pairId, "FOR MANUAL CHECKING");
  return queueNextAutomaticTelegramBatchRow(payload.lockToken, payload.deadlineAt);
}

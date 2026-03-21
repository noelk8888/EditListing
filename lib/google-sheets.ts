import { google } from "googleapis";
import { JWT } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const SHEET_NAME = "Sheet1";

// Format a numeric string as X,XXX,XXX.XX for GSheet display (Col AS, AU, etc.)
const formatPriceForSheet = (val: string): string => {
  if (!val) return "";
  const num = parseFloat(val.replace(/,/g, ""));
  if (isNaN(num)) return val;
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

console.log("🚀 GOOGLE-SHEETS.TS v4 (FOOLPROOF) LOADED");

// GSheet Column Mapping (A-P = Display columns, Z-BO = Supabase sync columns)
// Column AC is GEO ID - used as the lookup key
export const GSHEET_COLUMNS = {
  // Display Columns (A-P) - need direct update
  A_BLASTED_FORMAT: 0,      // A - BLASTED FORMAT (linked with AA MAIN minus GEO ID)
  B_TYPE: 1,                // B - type (linked with AK-AN)
  C_AREA: 2,                // C - Area (Brgy or Village) (linked with AH, fallback AI)
  D_CITY: 3,                // D - City (linked with AG)
  E_LOT_AREA: 4,            // E - Lot Area (linked with AO)
  F_FLOOR_AREA: 5,          // F - Floor Area (linked with AP)
  G_PRICE: 6,               // G - Price (linked with AS or AU based on H)
  H_SALE_OR_LEASE: 7,       // H - Sale or Lease (independent)
  I_WITH_INCOME: 8,         // I - With Income (linked with AX)
  J_DIRECT_COBROKER: 9,     // J - Direct or Cobroker (linked with AY)
  K_OWNER_BROKER: 10,       // K - Owner/Broker (linked with AZ)
  L_AWAY: 11,               // L - How many away (linked with BA)
  M_DATE_RECEIVED: 12,      // M - Date Received (linked with BB)
  N_DATE_RESORTED: 13,      // N - Date Resorted/Updated (linked with BC)
  O_AVAILABLE: 14,          // O - AVAILABLE/Status (linked with AQ)
  P_LISTING_OWNERSHIP: 15,  // P - LISTING OWNERSHIP (linked with BD)
  // Q-Y are empty (16-24)

  // Supabase Sync Columns (Z-BO) - synced via Supabase
  Z_FB_LINK: 25,            // Z - FB LINK
  AA_MAIN: 26,              // AA - MAIN (with GEO ID as first line)
  AB_PHOTO: 27,             // AB - PHOTO
  AC_GEO_ID: 28,            // AC - GEO ID (lookup key)
  AD_MAP_LINK: 29,          // AD - MAP LINK
  AE_REGION: 30,            // AE - REGION
  AF_PROVINCE: 31,          // AF - PROVINCE
  AG_CITY: 32,              // AG - CITY
  AH_BARANGAY: 33,          // AH - BARANGAY
  AI_AREA: 34,              // AI - AREA
  AJ_BUILDING: 35,          // AJ - BUILDING
  AK_RESIDENTIAL: 36,       // AK - RESIDENTIAL
  AL_COMMERCIAL: 37,        // AL - COMMERCIAL
  AM_INDUSTRIAL: 38,        // AM - INDUSTRIAL
  AN_AGRICULTURAL: 39,      // AN - AGRICULTURAL
  AO_LOT_AREA: 40,          // AO - LOT AREA
  AP_FLOOR_AREA: 41,        // AP - FLOOR AREA
  AQ_STATUS: 42,            // AQ - STATUS
  AR_TYPE: 43,              // AR - TYPE
  AS_SALE_PRICE: 44,        // AS - Extracted Sale Price
  AT_SALE_SQM: 45,          // AT - Sale Price/Sqm
  AU_LEASE_PRICE: 46,       // AU - Extracted Lease Price
  AV_LEASE_SQM: 47,         // AV - Lease Price/Sqm
  AW_COMMENTS: 48,          // AW - COMMENTS
  AX_WITH_INCOME: 49,       // AX - WITH INCOME
  AY_DIRECT_BROKER: 50,     // AY - DIRECT OR BROKER
  AZ_NAME: 51,              // AZ - NAME
  BA_AWAY: 52,              // BA - AWAY
  BB_MONTHLY_DUES: 53,      // BB - MONTHLY DUES
  BC_DATE_UPDATED: 54,      // BC - DATE UPDATED
  BD_LISTING_OWNERSHIP: 55, // BD - LISTING OWNERSHIP
  BE_LAT_LONG: 56,          // BE - LAT LONG
  BF_LAT: 57,               // BF - LAT
  BG_LONG: 58,              // BG - LONG
  BH_SPONSOR_START: 59,     // BH - SPONSOR START
  BI_SPONSOR_END: 60,       // BI - SPONSOR END
  BJ_BEDROOMS: 61,          // BJ - bedrooms
  BK_TOILET: 62,            // BK - toilet
  BL_GARAGE: 63,            // BL - garage
  BM_AMENITIES: 64,         // BM - amenities
  BN_CORNER: 65,            // BN - corner
  BO_COMPOUND: 66,          // BO - compound
  BP_LUXE_POST: 67,         // BP - LUXE REALTY post link
  BQ_NEXIA_POST: 68,        // BQ - NEXIA post link
  BR_ADOLF_POST: 69,        // BR - ADOLF post link
  BS_PCO_POST: 70,          // BS - PCO post link
  BT_SLOO_POST: 71,         // BT - SLOO post link
  BU_TAOKE_POST: 72,        // BU - TAOKE post link
};

// Which cells to annotate with an "Updated by" note, and by whom
export type NoteConfig = { updatedBy: string; cols: Set<number> };

// Interface for batch row data (col A-R display columns + col AC GEO ID)
export interface BatchRowData {
  rowNumber: number;  // 1-indexed sheet row
  colA: string;       // A - BLASTED FORMAT (raw listing text)
  colB: string;       // B - Type (Residential, Commercial, etc.)
  colC: string;       // C - Area (Brgy or Village)
  colD: string;       // D - City
  colE: string;       // E - Lot Area
  colF: string;       // F - Floor Area
  colG: string;       // G - Price
  colH: string;       // H - Sale or Lease
  colI: string;       // I - With Income
  colJ: string;       // J - Direct or with Cobroker
  colK: string;       // K - Owner/Broker name
  colL: string;       // L - How many broker away
  colM: string;       // M - Date Received
  colN: string;       // N - Date Resorted/Updated
  colO: string;       // O - AVAILABLE/Status
  colP: string;       // P - LISTING OWNERSHIP
  colQ: string;       // Q - custom col
  colR: string;       // R - custom col
  colAC: string;      // AC - GEO ID (lookup key)
}

// Interface for display columns A-P data
export interface GSheetDisplayData {
  blastedFormat: string;      // A
  type: string;               // B
  area: string;               // C
  city: string;               // D
  lotArea: string;            // E
  floorArea: string;          // F
  price: string;              // G
  saleOrLease: string;        // H
  withIncome: string;         // I
  directCobroker: string;     // J
  ownerBroker: string;        // K
  away: string;               // L
  dateReceived: string;       // M
  dateResorted: string;       // N
  available: string;          // O
  listingOwnership: string;   // P
  colQ?: string;              // Q - custom col
  colR?: string;              // R - custom col
}

// Interface for full row data (A-BO)
export interface GSheetFullRow extends GSheetDisplayData {
  geoId: string;              // AC
  main: string;               // AA
  rowNumber?: number;         // physical row number
  // Supabase columns (for reading fallback values)
  supabaseCity: string;       // AG
  supabaseBarangay: string;   // AH
  supabaseArea: string;       // AI
  supabaseLotArea: string;    // AO
  supabaseFloorArea: string;  // AP
  supabaseSalePrice: string;  // AS
  supabaseLeasePrice: string; // AU
  supabaseWithIncome: string; // AX
  supabaseDirectBroker: string; // AY
  supabaseName: string;       // AZ
  supabaseAway: string;       // BA
  supabaseMonthlyDues: string; // BB
  supabaseDateUpdated: string; // BC
  supabaseStatus: string;     // AQ
  supabaseListingOwnership: string; // BD
  supabaseResidential: string; // AK
  supabaseCommercial: string;  // AL
  supabaseIndustrial: string;  // AM
  supabaseAgricultural: string; // AN
  // Extended Z-BO fields
  supabaseFbLink: string;      // Z
  supabasePhoto: string;       // AB
  supabaseMapLink: string;     // AD
  supabaseRegion: string;      // AE
  supabaseProvince: string;    // AF
  supabaseBuilding: string;    // AJ
  supabaseType: string;        // AR
  supabaseSaleSqm: string;     // AT
  supabaseLeaseSqm: string;    // AV
  supabaseComments: string;    // AW
  supabaseLat: string;         // BF
  supabaseLong: string;        // BG
  supabaseSponsorStart: string; // BH
  supabaseSponsorEnd: string;   // BI
  supabaseBedrooms: string;    // BJ
  supabaseToilet: string;      // BK
  supabaseGarage: string;      // BL
  supabaseAmenities: string;   // BM
  supabaseCorner: string;      // BN
  supabaseCompound: string;    // BO
  mapVerified: string;         // BV
}

function cleanPrivateKey(raw: string): string {
  const BEGIN = "-----BEGIN PRIVATE KEY-----";
  const END = "-----END PRIVATE KEY-----";

  let key = raw.trim();

  // ── Layer 1: strip surrounding quotes (double or single) ──
  for (let i = 0; i < 3; i++) {                       // repeat in case of nested quoting
    if (key.startsWith('"') && key.endsWith('"')) {
      try { key = JSON.parse(key); } catch { key = key.slice(1, -1); }
    }
    if (key.startsWith("'") && key.endsWith("'")) {
      key = key.slice(1, -1);
    }
  }

  // ── Layer 2: unescape literal backslash-n sequences ──
  key = key.replace(/\\n/g, "\n");

  // ── Layer 3 (NUCLEAR): extract only the base64 body ──
  let body: string;
  const beginIdx = key.indexOf(BEGIN);
  const endIdx = key.indexOf(END);

  if (beginIdx !== -1 && endIdx !== -1) {
    // Standard PEM — grab everything between the tags
    body = key.substring(beginIdx + BEGIN.length, endIdx);
  } else {
    // No PEM headers at all — treat entire string as base64 body
    console.warn("GSheet Auth [NUCLEAR]: No PEM headers found, treating entire value as base64 body");
    body = key;
  }

  // Strip ALL whitespace from the body (spaces, tabs, newlines, carriage returns)
  body = body.replace(/[\s\r\n]+/g, "");

  // Validate: the body should only contain base64 chars
  if (!/^[A-Za-z0-9+/=]+$/.test(body)) {
    console.error("GSheet Auth [NUCLEAR]: Body contains non-base64 characters! Length:", body.length,
      "First 20 chars:", body.substring(0, 20));
  }

  // Rebuild into clean 64-char-per-line PEM
  const lines: string[] = [];
  for (let i = 0; i < body.length; i += 64) {
    lines.push(body.substring(i, i + 64));
  }

  const rebuilt = `${BEGIN}\n${lines.join("\n")}\n${END}\n`;

  console.log(`GSheet Auth [NUCLEAR]: Rebuilt PEM — ${lines.length} base64 lines, ${body.length} base64 chars`);

  return rebuilt;
}

export function getAuth() {
  // Try to use the service account JSON file first
  const serviceAccountPath = path.join(process.cwd(), "service-account.json");
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const credentials = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
      console.log("GSheet Auth: Using service-account.json file");
      return new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: SCOPES,
      });
    } catch (err) {
      console.error("GSheet Auth: Error reading service-account.json:", err);
    }
  }

  // Fallback to environment variables
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !privateKey) {
    throw new Error("Google service account credentials (EMAIL or PRIVATE_KEY) not configured");
  }

  const cleanedKey = cleanPrivateKey(privateKey);

  return new JWT({
    email,
    key: cleanedKey,
    scopes: SCOPES,
  });
}

// Singleton: reuse the same sheets client across calls in this process instance
let _sheetsClient: ReturnType<typeof google.sheets> | null = null;

export function getSheets() {
  if (_sheetsClient) return _sheetsClient;
  const auth = getAuth();
  _sheetsClient = google.sheets({ version: "v4", auth });
  return _sheetsClient;
}

// Cache: track the max verified column count per spreadsheetId to skip redundant metadata calls
const _ensuredCols = new Map<string, number>();

/**
 * Ensure the sheet has at least minCols columns.
 * Google Sheets sometimes creates new sheets with only a few columns (e.g. 18-26).
 * Our app requires columns Z-BO (up to column 67).
 */
export async function ensureSheetDimensions(sheets: any, spreadsheetId: string, minCols: number) {
  // Skip the API call if we've already verified this sheet has enough columns
  const verified = _ensuredCols.get(spreadsheetId) ?? 0;
  if (verified >= minCols) return;
  const logPath = "/tmp/gsheet_debug.log";
  const log = (msg: string) => {
    console.log(msg);
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  };

  try {
    log(`Checking dimensions for ${spreadsheetId}, target: ${minCols}`);
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });

    // Find sheet by title, or fallback to the first sheet
    let sheet = spreadsheet.data.sheets?.find((s: any) => s.properties?.title === SHEET_NAME);
    if (!sheet && spreadsheet.data.sheets?.length) {
      log(`SHEET_NAME "${SHEET_NAME}" not found, falling back to first sheet: "${spreadsheet.data.sheets[0].properties?.title}"`);
      sheet = spreadsheet.data.sheets[0];
    }

    const sheetId = sheet?.properties?.sheetId;
    const currentCols = sheet?.properties?.gridProperties?.columnCount || 0;
    const title = sheet?.properties?.title || "Unknown";

    log(`Current sheet: "${title}" (${sheetId}), Cols: ${currentCols}`);

    if (sheetId !== undefined && currentCols < minCols) {
      log(`Expanding columns from ${currentCols} to ${minCols}`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              appendDimension: {
                sheetId,
                dimension: "COLUMNS",
                length: minCols - currentCols,
              },
            },
          ],
        },
      });
      log(`Successfully expanded to ${minCols} columns`);
    } else {
      log(`No expansion needed or sheetId missing. sheetId: ${sheetId}, currentCols: ${currentCols}`);
    }
    // Mark this spreadsheet as verified for at least minCols columns
    _ensuredCols.set(spreadsheetId, Math.max(verified, minCols));
  } catch (err: any) {
    const errMsg = err?.response?.data?.error?.message || err?.message || String(err);
    log(`ERROR in ensureSheetDimensions: ${errMsg}`);
    if (errMsg.includes("The caller does not have permission")) {
      throw new Error("PERMISSION_DENIED: Service account must be an EDITOR on the Google Sheet.");
    }
    throw new Error(errMsg);
  }
}

/**
 * Executes a GSheet operation with an automatic retry if a "grid limits" error occurs.
 */
export async function runWithExpansion<T>(
  sheets: any,
  spreadsheetId: string,
  minCols: number,
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (err: any) {
    // Robustly check for "grid limits" in message, source message, or nested data
    const msg = (err?.message || "").toLowerCase();
    const dataMsg = (err?.response?.data?.error?.message || "").toLowerCase();
    const innerMsg = (err?.cause?.message || "").toLowerCase();

    const isGridLimit =
      msg.includes("exceeds grid limits") ||
      dataMsg.includes("exceeds grid limits") ||
      innerMsg.includes("exceeds grid limits");

    if (isGridLimit) {
      console.log(`GSheet: Grid limit hit, attempting expansion to ${minCols} cols...`);
      try {
        await ensureSheetDimensions(sheets, spreadsheetId, minCols);
        // Retry once
        console.log("GSheet: Expansion successful, retrying operation...");
        return await operation();
      } catch (expansionErr: any) {
        console.error("GSheet: Expansion retry failed:", expansionErr.message);
        throw expansionErr;
      }
    }
    throw err;
  }
}

/**
 * Find row number by GEO ID (column AC)
 */
export async function findRowByGeoId(geoId: string): Promise<number | null> {
  const sheets = getSheets();
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID not configured");
  }

  // Ensure AC column (29) exists
  await ensureSheetDimensions(sheets, spreadsheetId, 29);

  // Primary: search COL AC (GEO ID sync column)
  const acResponse = await runWithExpansion(sheets, spreadsheetId, 29, () =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!AC2:AC`,
    })
  );

  const acColumn = acResponse.data.values || [];
  const acIndex = acColumn.findIndex((row) => row[0] === geoId);
  if (acIndex !== -1) {
    return acIndex + 2;
  }

  // Fallback: search COL A (BLASTED FORMAT) for rows where the GEO ID appears on the first line
  const aResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A2:A`,
  });

  const aColumn = aResponse.data.values || [];
  const aIndex = aColumn.findIndex((row) => {
    const firstLine = (row[0] || "").split("\n")[0].trim();
    return firstLine === geoId;
  });

  if (aIndex !== -1) {
    return aIndex + 2;
  }

  return null;
}

/**
 * Generate the next GEO ID by finding the highest existing ID and adding 1
 * @param series - optional letter prefix to restrict search (e.g. "G" or "A"). Defaults to highest overall.
 */
export async function generateNextGeoId(series?: string): Promise<string> {
  const sheets = getSheets();
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID not configured");
  }

  // Scan all tabs for AC (dedicated GEO ID column)
  // Scan Sheet1 for AA/A (legacy blasted format)
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const allTabs = (meta.data.sheets || [])
    .map((s: any) => s.properties?.title as string)
    .filter((title: string) => !!title);

  // Build list of ranges to fetch
  const ranges = [
    ...allTabs.map(tab => `${tab}!AC2:AC`),
    `${SHEET_NAME}!AA2:AA`,
    `${SHEET_NAME}!A2:A`
  ];

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges
  });
  const valueRanges = response.data.valueRanges || [];

  // Single letter + 4-5 digits only (e.g. G11628).
  // Rejects typos like G111245 (6 digits) and false positives like P150000 (price).
  const GEO_RE = /^([A-Z])(\d{4,5})$/;

  const targetPrefix = series?.toUpperCase();
  let maxNumber = 0;
  // If no series provided, we'll default to "G" or the most common one found, 
  // but for Sheet2 we explicitly pass "B".
  let prefix = targetPrefix || "G";

  const check = (raw: string) => {
    const s = raw.trim();
    const match = s.match(GEO_RE);
    if (match) {
      // Regardless of the series requested, we find the absolute max numeric ID 
      // across G, A, and B prefixes to ensure uniqueness in the shared pool.
      const foundPrefix = match[1].toUpperCase();
      const num = parseInt(match[2], 10);
      
      if (num > maxNumber) {
        maxNumber = num;
        // Only update prefix if we haven't locked it via targetPrefix
        if (!targetPrefix) {
          prefix = foundPrefix;
        }
      }
    }
  };

  for (const vr of valueRanges) {
    if (!vr.values) continue;
    const isSpecialCol = vr.range?.includes("!AA") || vr.range?.includes("!A");
    for (const row of vr.values) {
      if (!row[0]) continue;
      if (isSpecialCol) {
        const fl = String(row[0]).split("\n")[0];
        if (fl) check(fl);
      } else {
        check(String(row[0]));
      }
    }
  }

  const nextNum = maxNumber + 1;
  // B-series (Sheet2): use the shared G-series number.
  // We match the formatting of the existing G-series (which is often 5 digits but variable)
  // If the number is < 10000, we'll pad to at least 5 digits to keep them pretty.
  const formattedNum = String(nextNum).padStart(5, "0");
  const nextGeoId = `${prefix}${formattedNum}`;
  console.log(`Generated next GEO ID: ${nextGeoId} (max was ${prefix}${maxNumber}, scanned AC+AA+A, series=${targetPrefix || "any"})`);
  return nextGeoId;
}

/**
 * Map a raw GSheet row array (A-BO) to a GSheetFullRow object
 */
function parseGSheetRow(row: string[]): GSheetFullRow {
  return {
    // Display columns (A-P)
    blastedFormat: row[GSHEET_COLUMNS.A_BLASTED_FORMAT] || "",
    type: row[GSHEET_COLUMNS.B_TYPE] || "",
    area: row[GSHEET_COLUMNS.C_AREA] || "",
    city: row[GSHEET_COLUMNS.D_CITY] || "",
    lotArea: row[GSHEET_COLUMNS.E_LOT_AREA] || "",
    floorArea: row[GSHEET_COLUMNS.F_FLOOR_AREA] || "",
    price: row[GSHEET_COLUMNS.G_PRICE] || "",
    saleOrLease: row[GSHEET_COLUMNS.H_SALE_OR_LEASE] || "",
    withIncome: row[GSHEET_COLUMNS.I_WITH_INCOME] || "",
    directCobroker: row[GSHEET_COLUMNS.J_DIRECT_COBROKER] || "",
    ownerBroker: row[GSHEET_COLUMNS.K_OWNER_BROKER] || "",
    away: row[GSHEET_COLUMNS.L_AWAY] || "",
    dateReceived: row[GSHEET_COLUMNS.M_DATE_RECEIVED] || "",
    dateResorted: row[GSHEET_COLUMNS.N_DATE_RESORTED] || "",
    available: row[GSHEET_COLUMNS.O_AVAILABLE] || "",
    listingOwnership: row[GSHEET_COLUMNS.P_LISTING_OWNERSHIP] || "",
    // Key columns
    geoId: row[GSHEET_COLUMNS.AC_GEO_ID] || "",
    main: row[GSHEET_COLUMNS.AA_MAIN] || "",
    // Supabase columns for fallback
    supabaseCity: row[GSHEET_COLUMNS.AG_CITY] || "",
    supabaseBarangay: row[GSHEET_COLUMNS.AH_BARANGAY] || "",
    supabaseArea: row[GSHEET_COLUMNS.AI_AREA] || "",
    supabaseLotArea: row[GSHEET_COLUMNS.AO_LOT_AREA] || "",
    supabaseFloorArea: row[GSHEET_COLUMNS.AP_FLOOR_AREA] || "",
    supabaseSalePrice: row[GSHEET_COLUMNS.AS_SALE_PRICE] || "",
    supabaseLeasePrice: row[GSHEET_COLUMNS.AU_LEASE_PRICE] || "",
    supabaseWithIncome: row[GSHEET_COLUMNS.AX_WITH_INCOME] || "",
    supabaseDirectBroker: row[GSHEET_COLUMNS.AY_DIRECT_BROKER] || "",
    supabaseName: row[GSHEET_COLUMNS.AZ_NAME] || "",
    supabaseAway: row[GSHEET_COLUMNS.BA_AWAY] || "",
    supabaseMonthlyDues: row[GSHEET_COLUMNS.BB_MONTHLY_DUES] || "",
    supabaseDateUpdated: row[GSHEET_COLUMNS.BC_DATE_UPDATED] || "",
    supabaseStatus: row[GSHEET_COLUMNS.AQ_STATUS] || "",
    supabaseListingOwnership: row[GSHEET_COLUMNS.BD_LISTING_OWNERSHIP] || "",
    supabaseResidential: row[GSHEET_COLUMNS.AK_RESIDENTIAL] || "",
    supabaseCommercial: row[GSHEET_COLUMNS.AL_COMMERCIAL] || "",
    supabaseIndustrial: row[GSHEET_COLUMNS.AM_INDUSTRIAL] || "",
    supabaseAgricultural: row[GSHEET_COLUMNS.AN_AGRICULTURAL] || "",
    // Extended Z-BO fields
    supabaseFbLink: row[GSHEET_COLUMNS.Z_FB_LINK] || "",
    supabasePhoto: row[GSHEET_COLUMNS.AB_PHOTO] || "",
    supabaseMapLink: row[GSHEET_COLUMNS.AD_MAP_LINK] || "",
    supabaseRegion: row[GSHEET_COLUMNS.AE_REGION] || "",
    supabaseProvince: row[GSHEET_COLUMNS.AF_PROVINCE] || "",
    supabaseBuilding: row[GSHEET_COLUMNS.AJ_BUILDING] || "",
    supabaseType: row[GSHEET_COLUMNS.AR_TYPE] || "",
    supabaseSaleSqm: row[GSHEET_COLUMNS.AT_SALE_SQM] || "",
    supabaseLeaseSqm: row[GSHEET_COLUMNS.AV_LEASE_SQM] || "",
    supabaseComments: row[GSHEET_COLUMNS.AW_COMMENTS] || "",
    supabaseLat: row[GSHEET_COLUMNS.BF_LAT] || "",
    supabaseLong: row[GSHEET_COLUMNS.BG_LONG] || "",
    supabaseSponsorStart: row[GSHEET_COLUMNS.BH_SPONSOR_START] || "",
    supabaseSponsorEnd: row[GSHEET_COLUMNS.BI_SPONSOR_END] || "",
    supabaseBedrooms: row[GSHEET_COLUMNS.BJ_BEDROOMS] || "",
    supabaseToilet: row[GSHEET_COLUMNS.BK_TOILET] || "",
    supabaseGarage: row[GSHEET_COLUMNS.BL_GARAGE] || "",
    supabaseAmenities: row[GSHEET_COLUMNS.BM_AMENITIES] || "",
    supabaseCorner: row[GSHEET_COLUMNS.BN_CORNER] || "",
    supabaseCompound: row[GSHEET_COLUMNS.BO_COMPOUND] || "",
    mapVerified: row[73] || "",
  };
}

/**
 * Read full row data by GEO ID
 */
export async function getRowByGeoId(geoId: string): Promise<GSheetFullRow | null> {
  const sheets = getSheets();
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID not configured");
  }

  const rowNumber = await findRowByGeoId(geoId);
  if (!rowNumber) {
    return null;
  }

  // Read full row (A to BO)
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A${rowNumber}:BO${rowNumber}`,
  });

  const row = response.data.values?.[0] || [];
  return parseGSheetRow(row);
}

/**
 * Delete a specific row from a sheet tab.
 */
export async function deleteRowFromSheet(
  spreadsheetId: string,
  tabName: string,
  rowNumber: number
): Promise<void> {
  const sheets = getSheets();

  // 1. Get sheetId for the tabName
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === tabName);
  const sheetId = sheet?.properties?.sheetId;

  if (sheetId === undefined) {
    throw new Error(`Sheet tab "${tabName}" not found in spreadsheet`);
  }

  // 2. Send deleteDimension request
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    },
  });

  console.log(`✅ Deleted row ${rowNumber} from ${tabName}`);
}

/**
 * Search COL A (BLASTED FORMAT) for matching text.
 * Used when COL AA (MAIN) is blank but COL A has content — listing is NOT new.
 * Returns the full row data if found (80%+ significant line match).
 */
/**
 * Returns just the GSheet row number for a COL A text match (no full row read).
 * Used as a fallback in update operations when findRowByGeoId fails.
 */
export async function findRowNumberByColAText(previewText: string): Promise<number | null> {
  const sheets = getSheets();
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("SPREADSHEET_ID not configured");

  const lines = previewText.split('\n').filter(l => l.trim());
  const significantLines = lines
    .filter(l => l.length > 10 && !/^\*?(FOR SALE|FOR RENT|FOR LEASE)\*?$/i.test(l.trim()))
    .map(l => l.trim().toLowerCase());

  if (significantLines.length < 3) return null;

  const batchResponse = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [`${SHEET_NAME}!A2:A`],
  });

  const colAValues = batchResponse.data.valueRanges?.[0]?.values || [];
  for (let i = 0; i < colAValues.length; i++) {
    const colA = (colAValues[i]?.[0] || "").toLowerCase();
    if (!colA) continue;
    const matchCount = significantLines.filter(line => colA.includes(line)).length;
    if (matchCount / significantLines.length >= 0.8) {
      return i + 2; // +2 for header and 0-indexing
    }
  }
  return null;
}

export async function findRowByColAText(
  previewText: string,
  overrideSpreadsheetId?: string,
  overrideTabName?: string
): Promise<GSheetFullRow | null> {
  const sheets = getSheets();
  const spreadsheetId = overrideSpreadsheetId || process.env.SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("SPREADSHEET_ID not configured");

  const tabName = overrideTabName || SHEET_NAME;

  // Build significant lines from preview text (same logic as Supabase text search)
  const lines = previewText.split('\n').filter(l => l.trim());
  const significantLines = lines
    .filter(l => l.length > 10 && !/^\*?(FOR SALE|FOR RENT|FOR LEASE)\*?$/i.test(l.trim()))
    .map(l => l.trim().toLowerCase());

  if (significantLines.length < 3) {
    return null;
  }

  // Batch read COL A (BLASTED FORMAT) and COL AC (GEO ID) in one request
  const batchResponse = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [`${tabName}!A2:A`, `${tabName}!AC2:AC`],
  });

  const colAValues = batchResponse.data.valueRanges?.[0]?.values || [];
  const colACValues = batchResponse.data.valueRanges?.[1]?.values || [];

  for (let i = 0; i < colAValues.length; i++) {
    const colA = colAValues[i]?.[0] || "";
    if (!colA) continue; // Skip rows where COL A is also blank

    const colALower = colA.toLowerCase();
    const matchCount = significantLines.filter(line => colALower.includes(line)).length;
    const matchRatio = matchCount / significantLines.length;

    if (matchRatio >= 0.8) {
      const rowNumber = i + 2; // +2 for header and 0-indexing
      const geoId = colACValues[i]?.[0] || "";
      console.log(`GSheet COL A text match at row ${rowNumber}, GEO ID: ${geoId} (${Math.round(matchRatio * 100)}% match)`);

      // Read the full row (A-BO)
      const rowResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${tabName}!A${rowNumber}:BO${rowNumber}`,
      });
      const row = rowResponse.data.values?.[0] || [];
      const parsed = parseGSheetRow(row);
      if (parsed) {
        parsed.rowNumber = rowNumber;
      }
      return parsed;
    }
  }

  return null;
}

// Interface for Supabase sync columns Z-BO
export interface GSheetSyncData {
  blastedFormat?: string;   // A  (MAIN without GEO ID — written alongside Z-BO)
  fbLink: string;           // Z
  main: string;             // AA (GEO ID + MAIN text)
  photo: string;            // AB
  geoId: string;            // AC
  mapLink: string;          // AD
  region: string;           // AE
  province: string;         // AF
  city: string;             // AG
  barangay: string;         // AH
  area: string;             // AI
  building: string;         // AJ
  residential: string;      // AK
  commercial: string;       // AL
  industrial: string;       // AM
  agricultural: string;     // AN
  lotArea: string;          // AO
  floorArea: string;        // AP
  status: string;           // AQ
  type: string;             // AR
  salePrice: string;        // AS
  saleSqm: string;          // AT
  leasePrice: string;       // AU
  leaseSqm: string;         // AV
  comments: string;         // AW
  withIncome: string;       // AX
  directBroker: string;     // AY
  name: string;             // AZ
  away: string;             // BA
  monthlyDues: string;      // BB
  dateRecv: string;         // display col M sync only (not written to BB)
  dateUpdated: string;      // N (plain date, no suffix)
  bcDateUpdated?: string;   // BC (date + change suffix e.g. "2026-03-17 | PRICE")
  listingOwnership: string; // BD
  latLong: string;          // BE
  lat: string;              // BF
  long: string;             // BG
  sponsorStart: string;     // BH
  sponsorEnd: string;       // BI
  bedrooms: string;         // BJ
  toilet: string;           // BK
  garage: string;           // BL
  amenities: string;        // BM
  corner: string;           // BN
  compound: string;         // BO
  bpPost: string;           // BP (LUXE POST)
  bqPost: string;           // BQ (NEXIA POST)
  brPost: string;           // BR (ADOLF POST)
  bsPost: string;           // BS (PCO POST)
  btPost: string;           // BT (SLOO POST)
  buPost: string;           // BU (TAOKE POST)
  bvCol: string;            // BV
  bwCol: string;            // BW
  bxCol: string;            // BX
  byCol: string;            // BY
  bzCol: string;            // BZ
}

/**
 * Data for the 10 paired columns that must stay in sync between
 * display (A-P) and sync (Z-BO) sections of the GSheet.
 */
export interface PairedColumnData {
  status: string;
  lotArea: string;
  floorArea: string;
  withIncome: string;
  directBroker: string;
  ownerBroker: string;
  away: string;
  monthlyDues: string;
  dateRecv: string;
  dateUpdated: string;
  listingOwnership: string;
}

/**
 * Write ONLY the 10 paired columns to both their display (A-P) and sync (Z-BO)
 * locations in a single batchUpdate. Used by the Supabase webhook handler so
 * that a direct Supabase update (e.g. from Luxe Listing) is reflected in GSheet.
 */
export async function syncPairedColumns(
  geoId: string,
  data: PairedColumnData,
  overrideSpreadsheetId?: string
): Promise<boolean> {
  const spreadsheetId = overrideSpreadsheetId || process.env.SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("SPREADSHEET_ID not configured");

  const sheets = getSheets();
  await ensureSheetDimensions(sheets, spreadsheetId, 56);

  const rowNumber = overrideSpreadsheetId
    ? await findRowByGeoIdInSheet(geoId, overrideSpreadsheetId)
    : await findRowByGeoId(geoId);

  if (!rowNumber) {
    console.log(`syncPairedColumns: GEO ID ${geoId} not found in ${spreadsheetId}`);
    return false;
  }

  await runWithExpansion(sheets, spreadsheetId, 56, () =>
    sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          // Display cols: E:F (lotArea, floorArea)
          { range: `${SHEET_NAME}!E${rowNumber}:F${rowNumber}`, values: [[data.lotArea, data.floorArea]] },
          // Display cols: I:P (withIncome → listingOwnership)
          { range: `${SHEET_NAME}!I${rowNumber}:P${rowNumber}`, values: [[data.withIncome, data.directBroker, data.ownerBroker, data.away, data.dateRecv, data.dateUpdated, data.status, data.listingOwnership]] },
          // Sync cols: AO:AQ (lotArea, floorArea, status)
          { range: `${SHEET_NAME}!AO${rowNumber}:AQ${rowNumber}`, values: [[data.lotArea, data.floorArea, data.status]] },
          // Sync cols: AX:BD (withIncome → listingOwnership)
          { range: `${SHEET_NAME}!AX${rowNumber}:BD${rowNumber}`, values: [[data.withIncome, data.directBroker, data.ownerBroker, data.away, data.monthlyDues, data.dateUpdated, data.listingOwnership]] },
        ],
      },
    })
  );

  console.log(`✅ syncPairedColumns: ${geoId} row ${rowNumber} in ${spreadsheetId}`);
  return true;
}

/**
 * Update Supabase sync columns Z-BO for a listing by GEO ID
 */
export async function updateSyncColumns(geoId: string, data: GSheetSyncData, fallbackText?: string, noteConfig?: NoteConfig, overrideSpreadsheetId?: string, sheetTabName?: string): Promise<boolean> {
  const sheets = getSheets();
  const spreadsheetId = overrideSpreadsheetId || process.env.SPREADSHEET_ID;
  const tabName = sheetTabName || SHEET_NAME;

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID not configured");
  }

  // Ensure enough columns for Z-BZ (78 cols)
  await ensureSheetDimensions(sheets, spreadsheetId, 78);
  let rowNumber: number | null;
  if (sheetTabName) {
    rowNumber = await findRowByGeoIdInSheet(geoId, spreadsheetId, sheetTabName);
  } else if (overrideSpreadsheetId) {
    rowNumber = await findRowByGeoIdInSheet(geoId, overrideSpreadsheetId);
  } else {
    rowNumber = await findRowByGeoId(geoId);
  }
  if (!rowNumber && fallbackText && !overrideSpreadsheetId && !sheetTabName) {
    console.log(`GEO ID ${geoId} not in COL AC — trying COL A text match as fallback`);
    rowNumber = await findRowNumberByColAText(fallbackText);
  }
  if (!rowNumber) {
    console.error(`GEO ID ${geoId} not found in GSheet (COL AC or COL A)`);
    return false;
  }

  // Build array for Z-BZ (53 columns, indices 25-77 absolute, 0-52 relative)
  const rowData = [
    data.fbLink,           // Z  (0)
    data.main,             // AA (1)
    data.photo,            // AB (2)
    data.geoId,            // AC (3)
    data.mapLink,          // AD (4)
    data.region,           // AE (5)
    data.province,         // AF (6)
    data.city,             // AG (7)
    data.barangay,         // AH (8)
    data.area,             // AI (9)
    data.building,         // AJ (10)
    data.residential,      // AK (11)
    data.commercial,       // AL (12)
    data.industrial,       // AM (13)
    data.agricultural,     // AN (14)
    data.lotArea,          // AO (15)
    data.floorArea,        // AP (16)
    data.status,           // AQ (17)
    data.type,             // AR (18)
    formatPriceForSheet(data.salePrice),        // AS (19)
    data.saleSqm,          // AT (20)
    data.leasePrice,       // AU (21)
    data.leaseSqm,         // AV (22)
    data.comments,         // AW (23)
    data.withIncome,       // AX (24)
    data.directBroker,     // AY (25)
    data.name,             // AZ (26)
    data.away,             // BA (27)
    data.monthlyDues,                              // BB (28)
    data.bcDateUpdated ?? data.dateUpdated,        // BC (29) — annotated if bcDateUpdated set
    data.listingOwnership, // BD (30)
    data.latLong,          // BE (31)
    data.lat,              // BF (32)
    data.long,             // BG (33)
    data.sponsorStart,     // BH (34)
    data.sponsorEnd,       // BI (35)
    data.bedrooms,         // BJ (36)
    data.toilet,           // BK (37)
    data.garage,           // BL (38)
    data.amenities,        // BM (39)
    data.corner,           // BN (40)
    data.compound,         // BO (41)
    data.bpPost || "",     // BP (42)
    data.bqPost || "",     // BQ (43)
    data.brPost || "",     // BR (44)
    data.bsPost || "",     // BS (45)
    data.btPost || "",     // BT (46)
    data.buPost || "",     // BU (47)
    data.bvCol || "",      // BV (48)
    data.bwCol || "",      // BW (49)
    data.bxCol || "",      // BX (50)
    data.byCol || "",      // BY (51)
    data.bzCol || "",      // BZ (52)
  ];

  // Derive blastedFormat: main text without the GEO ID first line
  const blastedFormatToWrite = data.blastedFormat !== undefined
    ? data.blastedFormat
    : (() => {
      if (!data.main) return "";
      const lines = data.main.split('\n');
      if (lines.length > 0 && /^[A-Z]\d{4,6}$/.test(lines[0].trim())) {
        return lines.slice(1).join('\n');
      }
      return data.main;
    })();

  // Batch write: COL A (blastedFormat) + COL Z-BZ (sync data) + paired display cols in one API call
  await runWithExpansion(sheets, spreadsheetId, 78, () =>
    sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: `${tabName}!A${rowNumber}`,
            values: [[blastedFormatToWrite]],
          },
          {
            range: `${tabName}!Z${rowNumber}:BZ${rowNumber}`,
            values: [rowData],
          },
          // Keep paired display cols (E:F, I:P) in sync with their Z-BO counterparts (AO:AQ, AX:BD)
          {
            range: `${tabName}!E${rowNumber}:F${rowNumber}`,
            values: [[data.lotArea, data.floorArea]],
          },
          {
            range: `${tabName}!I${rowNumber}:P${rowNumber}`,
            values: [[data.withIncome, data.directBroker, data.name, data.away, data.dateRecv, data.dateUpdated, data.status, data.listingOwnership]],
          },
        ],
      },
    })
  );

  // Insert notes only on columns that actually changed
  if (noteConfig && noteConfig.cols.size > 0) {
    try {
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const sheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === tabName
      );
      const sheetId = sheet?.properties?.sheetId;
      if (sheetId !== undefined) {
        const now = new Date().toLocaleString("en-PH", {
          timeZone: "Asia/Manila",
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", hour12: true,
        });
        const noteText = `Updated by: ${noteConfig.updatedBy}\n${now}`;
        const requests: object[] = [];
        // Col AQ (42) — STATUS
        if (noteConfig.cols.has(42)) requests.push({ updateCells: { range: { sheetId, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 42, endColumnIndex: 43 }, rows: [{ values: [{ note: noteText }] }], fields: "note" } });
        // Col BE (56) — LAT LONG
        if (noteConfig.cols.has(56)) requests.push({ updateCells: { range: { sheetId, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 56, endColumnIndex: 57 }, rows: [{ values: [{ note: noteText }] }], fields: "note" } });
        // Col BF (57) — LAT
        if (noteConfig.cols.has(57)) requests.push({ updateCells: { range: { sheetId, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 57, endColumnIndex: 58 }, rows: [{ values: [{ note: noteText }] }], fields: "note" } });
        // Col BG (58) — LONG
        if (noteConfig.cols.has(58)) requests.push({ updateCells: { range: { sheetId, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 58, endColumnIndex: 59 }, rows: [{ values: [{ note: noteText }] }], fields: "note" } });
        // Col AW (48) — COMMENTS
        if (noteConfig.cols.has(48)) requests.push({ updateCells: { range: { sheetId, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 48, endColumnIndex: 49 }, rows: [{ values: [{ note: noteText }] }], fields: "note" } });
        // Col BC (54) — DATE UPDATED (sync, mirrors Col N)
        if (noteConfig.cols.has(54)) requests.push({ updateCells: { range: { sheetId, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 54, endColumnIndex: 55 }, rows: [{ values: [{ note: noteText }] }], fields: "note" } });
        if (requests.length > 0) {
          await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
        }
      }
    } catch (noteError) {
      console.warn("⚠️ Could not insert cell notes:", noteError);
    }
  }

  console.log(`✅ Updated GSheet columns A + Z-BO for ${geoId} (row ${rowNumber})`);
  return true;
}

/**
 * Update display columns A-P for a listing by GEO ID
 */
export async function updateDisplayColumns(geoId: string, data: GSheetDisplayData, fallbackText?: string, noteConfig?: NoteConfig, overrideSpreadsheetId?: string, sheetTabName?: string): Promise<boolean> {
  const sheets = getSheets();
  const spreadsheetId = overrideSpreadsheetId || process.env.SPREADSHEET_ID;
  const tabName = sheetTabName || SHEET_NAME;

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID not configured");
  }

  // Ensure enough columns for BZ (up to col 78)
  await ensureSheetDimensions(sheets, spreadsheetId, 78);

  let rowNumber: number | null;
  if (sheetTabName) {
    rowNumber = await findRowByGeoIdInSheet(geoId, spreadsheetId, sheetTabName);
  } else if (overrideSpreadsheetId) {
    rowNumber = await findRowByGeoIdInSheet(geoId, overrideSpreadsheetId);
  } else {
    rowNumber = await findRowByGeoId(geoId);
  }
  if (!rowNumber && fallbackText && !overrideSpreadsheetId && !sheetTabName) {
    console.log(`GEO ID ${geoId} not in COL AC — trying COL A text match as fallback`);
    rowNumber = await findRowNumberByColAText(fallbackText);
  }
  if (!rowNumber) {
    console.error(`GEO ID ${geoId} not found in GSheet (COL AC or COL A)`);
    return false;
  }

  // Build row array for columns A-R (18 columns)
  const rowData = [
    data.blastedFormat,      // A
    data.type,               // B
    data.area,               // C
    data.city,               // D
    data.lotArea,            // E
    data.floorArea,          // F
    data.price,              // G
    data.saleOrLease,        // H
    data.withIncome,         // I
    data.directCobroker,     // J
    data.ownerBroker,        // K
    data.away,               // L
    data.dateReceived,       // M
    data.dateResorted,       // N
    data.available,          // O
    data.listingOwnership,   // P
    data.colQ || "",         // Q
    data.colR || "",         // R
  ];

  // Write values: A-P (display) + paired sync cols AO:AQ and AX:BD in one batch
  await runWithExpansion(sheets, spreadsheetId, 56, () =>
    sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: `${tabName}!A${rowNumber}:R${rowNumber}`,
            values: [rowData],
          },
          // Keep paired sync cols (AO:AQ, AX:BA, BC:BD) in sync with their display counterparts (E:F, I:P)
          // NOTE: BB (col 53) = MONTHLY DUES — NOT written here; only updateSyncColumns writes BB.
          //       Skipping BB prevents overwriting monthly dues with dateReceived on every update.
          {
            range: `${tabName}!AO${rowNumber}:AQ${rowNumber}`,
            values: [[data.lotArea, data.floorArea, data.available]],
          },
          {
            range: `${tabName}!AX${rowNumber}:BA${rowNumber}`,
            values: [[data.withIncome, data.directCobroker, data.ownerBroker, data.away]],
          },
          // NOTE: BC (col 55) = DATE UPDATED (annotated) — NOT written here; only updateSyncColumns writes BC.
          //       Skipping BC prevents overwriting the annotated stamp (e.g. "2026-03-17 | COMMENTS").
          {
            range: `${tabName}!BD${rowNumber}`,
            values: [[data.listingOwnership]],
          },
        ],
      },
    })
  );

  // Apply font formatting: Calibri, size 11, no bold
  try {
    // Get sheet ID
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === tabName
    );
    const sheetId = sheet?.properties?.sheetId;

    if (sheetId !== undefined) {
      const requests: object[] = [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: rowNumber - 1,
              endRowIndex: rowNumber,
              startColumnIndex: 0,
              endColumnIndex: 16, // A-P (16 columns)
            },
            cell: {
              userEnteredFormat: {
                textFormat: {
                  fontFamily: "Calibri",
                  fontSize: 11,
                  bold: false,
                },
              },
            },
            fields: "userEnteredFormat.textFormat",
          },
        },
      ];

      // Insert notes only on columns that actually changed
      if (noteConfig && noteConfig.cols.size > 0) {
        const now = new Date().toLocaleString("en-PH", {
          timeZone: "Asia/Manila",
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", hour12: true,
        });
        const noteText = `Updated by: ${noteConfig.updatedBy}\n${now}`;
        // Col N (13) — Date Updated
        if (noteConfig.cols.has(13)) requests.push({ updateCells: { range: { sheetId, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 13, endColumnIndex: 14 }, rows: [{ values: [{ note: noteText }] }], fields: "note" } });
        // Col O (14) — Status
        if (noteConfig.cols.has(14)) requests.push({ updateCells: { range: { sheetId, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 14, endColumnIndex: 15 }, rows: [{ values: [{ note: noteText }] }], fields: "note" } });
      }

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
      console.log(`✅ Applied Calibri 11 formatting to row ${rowNumber}`);
    }
  } catch (formatError) {
    console.warn("⚠️ Could not apply font formatting:", formatError);
    // Don't fail if formatting fails
  }

  console.log(`✅ Updated GSheet columns A-P for ${geoId} (row ${rowNumber})`);
  return true;
}

/**
 * Find a row number by GEO ID in any spreadsheet (strict Col AC match, no fallback).
 */
export async function findRowByGeoIdInSheet(geoId: string, spreadsheetId: string, sheetTabName?: string): Promise<number | null> {
  const tabName = sheetTabName || SHEET_NAME;
  const sheets = getSheets();
  await ensureSheetDimensions(sheets, spreadsheetId, 29);

  const acResponse = await runWithExpansion(sheets, spreadsheetId, 29, () =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!AC2:AC`,
    })
  );

  const acColumn = acResponse.data.values || [];
  const acIndex = acColumn.findIndex((row) => row[0] === geoId);
  return acIndex !== -1 ? acIndex + 2 : null;
}

/**
 * Find which tab in the WORKING GSheet a GEO ID lives in.
 * Checks non-Sheet1 tabs FIRST (COL AC only) so Sheet2 wins over any Sheet1
 * COL A legacy entry. Falls back to Sheet1 COL AC, then defaults to Sheet1.
 */
export async function findGeoIdSourceTab(geoId: string): Promise<string> {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) return SHEET_NAME;

  try {
    const sheets = getSheets();
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const allTabs = (meta.data.sheets || [])
      .map((s: any) => s.properties?.title as string)
      .filter((title: string) => !!title);

    // Check non-Sheet1 tabs first — COL AC only (strict match).
    // This ensures a Sheet2 listing is detected even if the same GEO ID also
    // appears in Sheet1's COL A (legacy blasted-format first line).
    for (const tabName of allTabs.filter((t) => t !== SHEET_NAME)) {
      const row = await findRowByGeoIdInSheet(geoId, spreadsheetId, tabName);
      if (row) return tabName;
    }

    // Fall back to Sheet1 — COL AC only (no COL A fallback)
    const sheet1Row = await findRowByGeoIdInSheet(geoId, spreadsheetId, SHEET_NAME);
    if (sheet1Row) return SHEET_NAME;
  } catch {
    // fallthrough to default
  }

  return SHEET_NAME;
}

/**
 * Read Cols A-P from a specific spreadsheet by GEO ID (strict Col AC match).
 * Returns null if not found.
 */
export async function getDisplayDataFromSheet(
  geoId: string,
  spreadsheetId: string
): Promise<{ rowNumber: number; data: GSheetDisplayData } | null> {
  const rowNumber = await findRowByGeoIdInSheet(geoId, spreadsheetId);
  if (!rowNumber) return null;

  const sheets = getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A${rowNumber}:P${rowNumber}`,
  });

  const row = response.data.values?.[0] || [];
  return {
    rowNumber,
    data: {
      blastedFormat: row[0] || "",
      type: row[1] || "",
      area: row[2] || "",
      city: row[3] || "",
      lotArea: row[4] || "",
      floorArea: row[5] || "",
      price: row[6] || "",
      saleOrLease: row[7] || "",
      withIncome: row[8] || "",
      directCobroker: row[9] || "",
      ownerBroker: row[10] || "",
      away: row[11] || "",
      dateReceived: row[12] || "",
      dateResorted: row[13] || "",
      available: row[14] || "",
      listingOwnership: row[15] || "",
    },
  };
}

/**
 * Write Cols A-P to a specific spreadsheet by GEO ID (strict Col AC match — no fallback).
 * Returns false if GEO ID not found in that sheet.
 */
export async function updateDisplayColumnsInSheet(
  geoId: string,
  data: GSheetDisplayData,
  spreadsheetId: string
): Promise<boolean> {
  const rowNumber = await findRowByGeoIdInSheet(geoId, spreadsheetId);
  if (!rowNumber) {
    console.log(`Backup sync skipped: GEO ID ${geoId} not found in ${spreadsheetId}`);
    return false;
  }

  const sheets = getSheets();
  const rowData = [
    data.blastedFormat, data.type, data.area, data.city,
    data.lotArea, data.floorArea, data.price, data.saleOrLease,
    data.withIncome, data.directCobroker, data.ownerBroker, data.away,
    data.dateReceived, data.dateResorted, data.available, data.listingOwnership,
  ];

  await runWithExpansion(sheets, spreadsheetId, 16, () =>
    sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A${rowNumber}:P${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowData] },
    })
  );

  console.log(`✅ Backup sync: GEO ID ${geoId} → row ${rowNumber} in ${spreadsheetId}`);
  return true;
}

/**
 * Apply bidirectional fallback logic between display (A-P) and Supabase (Z-BO) columns
 */
export function applyFallbackLogic(gsheetRow: GSheetFullRow): GSheetDisplayData {
  // Helper to get first non-empty value
  const fallback = (a: string, b: string) => a?.trim() || b?.trim() || "";

  // Build type from AK-AN if B is empty
  let type = gsheetRow.type;
  if (!type?.trim()) {
    const types = [
      gsheetRow.supabaseResidential && "Residential",
      gsheetRow.supabaseCommercial && "Commercial",
      gsheetRow.supabaseIndustrial && "Industrial",
      gsheetRow.supabaseAgricultural && "Agricultural",
    ].filter(Boolean);
    type = types.join(", ");
  }

  // Price logic: G ↔ AS or AU based on H
  let price = gsheetRow.price;
  if (!price?.trim()) {
    price = gsheetRow.supabaseSalePrice || gsheetRow.supabaseLeasePrice || "";
  }

  // Build BLASTED FORMAT from MAIN (AA) minus GEO ID if A is empty
  let blastedFormat = gsheetRow.blastedFormat;
  if (!blastedFormat?.trim() && gsheetRow.main) {
    // Remove GEO ID (first line) from MAIN
    const lines = gsheetRow.main.split('\n');
    if (lines.length > 1 && /^[A-Z]\d{4,6}$/.test(lines[0].trim())) {
      blastedFormat = lines.slice(1).join('\n');
    } else {
      blastedFormat = gsheetRow.main;
    }
  }

  return {
    blastedFormat,
    type,
    area: fallback(gsheetRow.area, gsheetRow.supabaseBarangay || gsheetRow.supabaseArea),
    city: fallback(gsheetRow.city, gsheetRow.supabaseCity),
    lotArea: fallback(gsheetRow.lotArea, gsheetRow.supabaseLotArea),
    floorArea: fallback(gsheetRow.floorArea, gsheetRow.supabaseFloorArea),
    price,
    saleOrLease: gsheetRow.saleOrLease || "", // Independent - no fallback
    withIncome: fallback(gsheetRow.withIncome, gsheetRow.supabaseWithIncome),
    directCobroker: fallback(gsheetRow.directCobroker, gsheetRow.supabaseDirectBroker),
    ownerBroker: fallback(gsheetRow.ownerBroker, gsheetRow.supabaseName),
    away: fallback(gsheetRow.away, gsheetRow.supabaseAway),
    dateReceived: gsheetRow.dateReceived || "",
    dateResorted: fallback(gsheetRow.dateResorted, gsheetRow.supabaseDateUpdated),
    available: fallback(gsheetRow.available, gsheetRow.supabaseStatus),
    listingOwnership: fallback(gsheetRow.listingOwnership, gsheetRow.supabaseListingOwnership),
  };
}

/**
 * Read display data with fallback logic applied
 */
export async function getDisplayDataByGeoId(geoId: string): Promise<GSheetDisplayData | null> {
  const fullRow = await getRowByGeoId(geoId);
  if (!fullRow) {
    return null;
  }
  return applyFallbackLogic(fullRow);
}

/**
 * Add a new listing row to GSheet with generated GEO ID
 * Writes to columns A-P (display) and Z-BO (Supabase sync columns)
 * Returns the generated GEO ID
 */
export async function addNewGSheetRow(data: GSheetDisplayData, overrideGeoId?: string, syncData?: GSheetSyncData, updatedBy?: string, overrideSpreadsheetId?: string, sheetTabName?: string, targetRowNumber?: number): Promise<string> {
  const sheets = getSheets();
  const spreadsheetId = overrideSpreadsheetId || process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID not configured");
  }

  // Use provided GEO ID or generate a new one
  const series = (sheetTabName === "Sheet2") ? "A" : "G";
  const geoId = overrideGeoId || await generateNextGeoId(series);

  // Build full row (A to BZ = 78 columns)
  // A-R = display columns (18)
  // S-Y = empty (7)
  // Z-BZ = Supabase sync columns (53)
  const rowData: string[] = new Array(78).fill("");

  // A-P: Display columns
  rowData[GSHEET_COLUMNS.A_BLASTED_FORMAT] = data.blastedFormat;
  rowData[GSHEET_COLUMNS.B_TYPE] = data.type;
  rowData[GSHEET_COLUMNS.C_AREA] = data.area;
  rowData[GSHEET_COLUMNS.D_CITY] = data.city;
  rowData[GSHEET_COLUMNS.E_LOT_AREA] = data.lotArea;
  rowData[GSHEET_COLUMNS.F_FLOOR_AREA] = data.floorArea;
  rowData[GSHEET_COLUMNS.G_PRICE] = data.price;
  rowData[GSHEET_COLUMNS.H_SALE_OR_LEASE] = data.saleOrLease;
  rowData[GSHEET_COLUMNS.I_WITH_INCOME] = data.withIncome;
  rowData[GSHEET_COLUMNS.J_DIRECT_COBROKER] = data.directCobroker;
  rowData[GSHEET_COLUMNS.K_OWNER_BROKER] = data.ownerBroker;
  rowData[GSHEET_COLUMNS.L_AWAY] = data.away;
  rowData[GSHEET_COLUMNS.M_DATE_RECEIVED] = data.dateReceived;
  rowData[GSHEET_COLUMNS.N_DATE_RESORTED] = data.dateResorted;
  rowData[GSHEET_COLUMNS.O_AVAILABLE] = data.available;
  rowData[GSHEET_COLUMNS.P_LISTING_OWNERSHIP] = data.listingOwnership;
  rowData[16] = data.colQ || ""; // Q
  rowData[17] = data.colR || ""; // R

  // AC: GEO ID (key column) — always use the actual geoId, not syncData.geoId
  rowData[GSHEET_COLUMNS.AC_GEO_ID] = geoId;

  // AA: MAIN — GEO ID as first line
  rowData[GSHEET_COLUMNS.AA_MAIN] = geoId + "\n" + data.blastedFormat;

  // Z-BO: Sync columns — write in the same append to avoid a second lookup
  if (syncData) {
    rowData[GSHEET_COLUMNS.Z_FB_LINK] = syncData.fbLink || "";
    // AA already set above with correct geoId
    rowData[GSHEET_COLUMNS.AB_PHOTO] = syncData.photo || "";
    // AC already set above
    rowData[GSHEET_COLUMNS.AD_MAP_LINK] = syncData.mapLink || "";
    rowData[GSHEET_COLUMNS.AE_REGION] = syncData.region || "";
    rowData[GSHEET_COLUMNS.AF_PROVINCE] = syncData.province || "";
    rowData[GSHEET_COLUMNS.AG_CITY] = syncData.city || "";
    rowData[GSHEET_COLUMNS.AH_BARANGAY] = syncData.barangay || "";
    rowData[GSHEET_COLUMNS.AI_AREA] = syncData.area || "";
    rowData[GSHEET_COLUMNS.AJ_BUILDING] = syncData.building || "";
    rowData[GSHEET_COLUMNS.AK_RESIDENTIAL] = syncData.residential || "";
    rowData[GSHEET_COLUMNS.AL_COMMERCIAL] = syncData.commercial || "";
    rowData[GSHEET_COLUMNS.AM_INDUSTRIAL] = syncData.industrial || "";
    rowData[GSHEET_COLUMNS.AN_AGRICULTURAL] = syncData.agricultural || "";
    rowData[GSHEET_COLUMNS.AO_LOT_AREA] = syncData.lotArea || "";
    rowData[GSHEET_COLUMNS.AP_FLOOR_AREA] = syncData.floorArea || "";
    rowData[GSHEET_COLUMNS.AQ_STATUS] = syncData.status || "";
    rowData[GSHEET_COLUMNS.AR_TYPE] = syncData.type || "";
    rowData[GSHEET_COLUMNS.AS_SALE_PRICE] = formatPriceForSheet(syncData.salePrice || "");
    rowData[GSHEET_COLUMNS.AT_SALE_SQM] = syncData.saleSqm || "";
    rowData[GSHEET_COLUMNS.AU_LEASE_PRICE] = syncData.leasePrice || "";
    rowData[GSHEET_COLUMNS.AV_LEASE_SQM] = syncData.leaseSqm || "";
    rowData[GSHEET_COLUMNS.AW_COMMENTS] = syncData.comments || "";
    rowData[GSHEET_COLUMNS.AX_WITH_INCOME] = syncData.withIncome || "";
    rowData[GSHEET_COLUMNS.AY_DIRECT_BROKER] = syncData.directBroker || "";
    rowData[GSHEET_COLUMNS.AZ_NAME] = syncData.name || "";
    rowData[GSHEET_COLUMNS.BA_AWAY] = syncData.away || "";
    rowData[GSHEET_COLUMNS.BB_MONTHLY_DUES] = syncData.monthlyDues || "";
    rowData[GSHEET_COLUMNS.BC_DATE_UPDATED] = syncData.dateUpdated || "";
    rowData[GSHEET_COLUMNS.BD_LISTING_OWNERSHIP] = syncData.listingOwnership || "";
    rowData[GSHEET_COLUMNS.BE_LAT_LONG] = syncData.latLong || "";
    rowData[GSHEET_COLUMNS.BF_LAT] = syncData.lat || "";
    rowData[GSHEET_COLUMNS.BG_LONG] = syncData.long || "";
    rowData[GSHEET_COLUMNS.BH_SPONSOR_START] = syncData.sponsorStart || "";
    rowData[GSHEET_COLUMNS.BI_SPONSOR_END] = syncData.sponsorEnd || "";
    rowData[GSHEET_COLUMNS.BJ_BEDROOMS] = syncData.bedrooms || "";
    rowData[GSHEET_COLUMNS.BK_TOILET] = syncData.toilet || "";
    rowData[GSHEET_COLUMNS.BL_GARAGE] = syncData.garage || "";
    rowData[GSHEET_COLUMNS.BM_AMENITIES] = syncData.amenities || "";
    rowData[GSHEET_COLUMNS.BN_CORNER] = syncData.corner || "";
    rowData[GSHEET_COLUMNS.BO_COMPOUND] = syncData.compound || "";
    rowData[GSHEET_COLUMNS.BP_LUXE_POST || 67] = syncData.bpPost || "";
    rowData[GSHEET_COLUMNS.BQ_NEXIA_POST || 68] = syncData.bqPost || "";
    rowData[GSHEET_COLUMNS.BR_ADOLF_POST || 69] = syncData.brPost || "";
    rowData[GSHEET_COLUMNS.BS_PCO_POST || 70] = syncData.bsPost || "";
    rowData[GSHEET_COLUMNS.BT_SLOO_POST || 71] = syncData.btPost || "";
    rowData[GSHEET_COLUMNS.BU_TAOKE_POST || 72] = syncData.buPost || "";
    rowData[73] = syncData.bvCol || ""; // BV
    rowData[74] = syncData.bwCol || ""; // BW
    rowData[75] = syncData.bxCol || ""; // BX
    rowData[76] = syncData.byCol || ""; // BY
    rowData[77] = syncData.bzCol || ""; // BZ
  }

  // Resolve the actual sheet tab name
  let resolvedTabName: string;
  if (sheetTabName) {
    // Explicitly provided (e.g., "Sheet2" for batch mode)
    resolvedTabName = sheetTabName;
  } else if (overrideSpreadsheetId) {
    // Override spreadsheet — resolve from metadata
    resolvedTabName = SHEET_NAME;
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const found = meta.data.sheets?.find((s: any) => s.properties?.title === SHEET_NAME);
      resolvedTabName = found?.properties?.title ?? meta.data.sheets?.[0]?.properties?.title ?? SHEET_NAME;
    } catch { /* keep SHEET_NAME as fallback */ }
  } else {
    resolvedTabName = SHEET_NAME;
  }

  // Determine target row: use provided row number (Sheet2 batch in-place) or find next empty row
  let nextRow: number;
  if (targetRowNumber) {
    nextRow = targetRowNumber;
  } else {
    // Find the next empty row by checking the last row with data in col A and col AC.
    // Using values.update with an explicit range avoids the Sheets API table-detection
    // bug where append() can start writing at col BE instead of col A.
    const [colAResp, colACResp] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: `${resolvedTabName}!A:A` }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: `${resolvedTabName}!AC:AC` }),
    ]);
    const rowsInColA = (colAResp.data.values || []).length;
    const rowsInColAC = (colACResp.data.values || []).length;
    nextRow = Math.max(rowsInColA, rowsInColAC) + 1;
  }

  // Write with an explicit A{n}:BZ{n} reference — col A is always index 0
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${resolvedTabName}!A${nextRow}:BZ${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [rowData],
    },
  });

  const rowNumber = nextRow;

  // Apply font formatting
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === resolvedTabName
    );
    const sheetId = sheet?.properties?.sheetId;

    if (sheetId !== undefined && rowNumber > 1) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: rowNumber - 1,
                  endRowIndex: rowNumber,
                  startColumnIndex: 0,
                  endColumnIndex: 78, // A-BZ
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: {
                      fontFamily: "Calibri",
                      fontSize: 11,
                      bold: false,
                    },
                  },
                },
                fields: "userEnteredFormat.textFormat",
              },
            },
          ],
        },
      });
      console.log(`✅ Applied Calibri 11 formatting to new row ${rowNumber}`);
    }
  } catch (formatError) {
    console.warn("⚠️ Could not apply font formatting:", formatError);
  }

  // Insert cell note on Col AC (GEO ID) to record who created this listing
  if (updatedBy) {
    try {
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === resolvedTabName);
      const sheetId = sheet?.properties?.sheetId;
      if (sheetId !== undefined) {
        const now = new Date().toLocaleString("en-PH", {
          timeZone: "Asia/Manila",
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", hour12: true,
        });
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [{
            updateCells: {
              range: { sheetId, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 28, endColumnIndex: 29 },
              rows: [{ values: [{ note: `Added by: ${updatedBy}\n${now}` }] }],
              fields: "note"
            }
          }]}
        });
      }
    } catch (noteError) {
      console.warn("⚠️ Could not insert cell note on Col AC:", noteError);
    }
  }

  console.log(`✅ Added new GSheet row for ${geoId} (row ${rowNumber})`);
  return geoId;
}

/**
 * Append only Cols A-P + GEO ID (Col AC) to a backup spreadsheet.
 * Lighter than addNewGSheetRow — no sync cols, no formatting, no notes.
 */
export async function appendDisplayRowToSheet(
  data: GSheetDisplayData,
  geoId: string,
  spreadsheetId: string
): Promise<void> {
  const sheets = getSheets();

  // Resolve actual tab name (fallback to first sheet)
  let sheetTabName = SHEET_NAME;
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const found = meta.data.sheets?.find((s: any) => s.properties?.title === SHEET_NAME);
    sheetTabName = found?.properties?.title ?? meta.data.sheets?.[0]?.properties?.title ?? SHEET_NAME;
  } catch { /* keep SHEET_NAME */ }

  // Find next empty row
  const [colAResp, colACResp] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetTabName}!A:A` }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetTabName}!AC:AC` }),
  ]);
  const nextRow = Math.max(
    (colAResp.data.values || []).length,
    (colACResp.data.values || []).length
  ) + 1;

  // Build A-AC row (29 cols), fill A-P (0-15), Q (16), R (17), and AC (28)
  const rowData: string[] = new Array(29).fill("");
  rowData[GSHEET_COLUMNS.A_BLASTED_FORMAT] = data.blastedFormat;
  rowData[GSHEET_COLUMNS.B_TYPE] = data.type;
  rowData[GSHEET_COLUMNS.C_AREA] = data.area;
  rowData[GSHEET_COLUMNS.D_CITY] = data.city;
  rowData[GSHEET_COLUMNS.E_LOT_AREA] = data.lotArea;
  rowData[GSHEET_COLUMNS.F_FLOOR_AREA] = data.floorArea;
  rowData[GSHEET_COLUMNS.G_PRICE] = data.price;
  rowData[GSHEET_COLUMNS.H_SALE_OR_LEASE] = data.saleOrLease;
  rowData[GSHEET_COLUMNS.I_WITH_INCOME] = data.withIncome;
  rowData[GSHEET_COLUMNS.J_DIRECT_COBROKER] = data.directCobroker;
  rowData[GSHEET_COLUMNS.K_OWNER_BROKER] = data.ownerBroker;
  rowData[GSHEET_COLUMNS.L_AWAY] = data.away;
  rowData[GSHEET_COLUMNS.M_DATE_RECEIVED] = data.dateReceived;
  rowData[GSHEET_COLUMNS.N_DATE_RESORTED] = data.dateResorted;
  rowData[GSHEET_COLUMNS.O_AVAILABLE] = data.available;
  rowData[GSHEET_COLUMNS.P_LISTING_OWNERSHIP] = data.listingOwnership;
  rowData[16] = data.colQ || "";  // Q - custom col
  rowData[17] = data.colR || "";  // R - custom col
  rowData[GSHEET_COLUMNS.AC_GEO_ID] = geoId;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetTabName}!A${nextRow}:AC${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [rowData] },
  });
  console.log(`✅ Backup row appended for ${geoId} (row ${nextRow}, cols A-R + AC)`);
}

// ============================================================================
// LEGACY FUNCTIONS - For backward compatibility with other parts of the app
// These use a different column structure and are kept for compatibility
// ============================================================================

import { Listing } from "@/types/listing";


function rowToListing(row: string[], rowIndex: number): Listing {
  return {
    id: row[28] || `row-${rowIndex}`,
    region: row[0] || "",
    province: row[1] || "",
    city: row[2] || "",
    barangay: row[3] || "",
    area: row[4] || "",
    building: row[5] || "",
    residential: row[6]?.toLowerCase() === "true" || row[6] === "1",
    commercial: row[7]?.toLowerCase() === "true" || row[7] === "1",
    industrial: row[8]?.toLowerCase() === "true" || row[8] === "1",
    agricultural: row[9]?.toLowerCase() === "true" || row[9] === "1",
    lotArea: row[10] || "",
    floorArea: row[11] || "",
    status: (row[12] as Listing["status"]) || "",
    type: (row[13] as Listing["type"]) || "",
    salePrice: row[14] || "",
    salePricePerSqm: row[15] || "",
    leasePrice: row[16] || "",
    leasePricePerSqm: row[17] || "",
    lat: row[18] || "",
    long: row[19] || "",
    bedrooms: row[20] || "",
    toilets: row[21] || "",
    garage: row[22] || "",
    amenities: row[23] || "",
    corner: row[24]?.toLowerCase() === "true" || row[24] === "1",
    compound: row[25]?.toLowerCase() === "true" || row[25] === "1",
    photos: row[26] || "",
    mapLink: "",
    rawListing: row[27] || "",
    withIncome: row[29]?.toLowerCase() === "true" || row[29] === "1",
    directOrCobroker: (row[30] as Listing["directOrCobroker"]) || "",
    ownerBroker: row[31] || "",
    howManyAway: row[32] || "",
    listingOwnership: row[33] || "",
  };
}

function listingToRow(listing: Listing): string[] {
  return [
    listing.region,
    listing.province,
    listing.city,
    listing.barangay,
    listing.area,
    listing.building,
    listing.residential ? "TRUE" : "FALSE",
    listing.commercial ? "TRUE" : "FALSE",
    listing.industrial ? "TRUE" : "FALSE",
    listing.agricultural ? "TRUE" : "FALSE",
    listing.lotArea,
    listing.floorArea,
    listing.status,
    listing.type,
    listing.salePrice,
    listing.salePricePerSqm,
    listing.leasePrice,
    listing.leasePricePerSqm,
    listing.lat,
    listing.long,
    listing.bedrooms,
    listing.toilets,
    listing.garage,
    listing.amenities,
    listing.corner ? "TRUE" : "FALSE",
    listing.compound ? "TRUE" : "FALSE",
    listing.photos,
    listing.rawListing,
    listing.id,
    listing.withIncome ? "TRUE" : "FALSE",
    listing.directOrCobroker,
    listing.ownerBroker,
    listing.howManyAway,
    listing.listingOwnership,
  ];
}

export async function getAllListings(): Promise<Listing[]> {
  const sheets = getSheets();
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID not configured");
  }

  const response = await runWithExpansion(sheets, spreadsheetId, 34, () =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!A2:AH`,
    })
  );

  const rows = response.data.values || [];
  return rows.map((row, index) => rowToListing(row, index + 2));
}

export async function getListingById(id: string): Promise<Listing | null> {
  const listings = await getAllListings();
  return listings.find((l) => l.id === id) || null;
}

export async function addListing(listing: Listing): Promise<Listing> {
  const sheets = getSheets();
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID not configured");
  }

  const row = listingToRow(listing);

  await runWithExpansion(sheets, spreadsheetId, 34, () =>
    sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAME}!A:AH`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [row],
      },
    })
  );

  return listing;
}

export async function updateListing(id: string, listing: Listing): Promise<Listing | null> {
  const sheets = getSheets();
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID not configured");
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!AC2:AC`,
  });

  const idColumn = response.data.values || [];
  const rowIndex = idColumn.findIndex((row) => row[0] === id);

  if (rowIndex === -1) {
    return null;
  }

  const actualRowIndex = rowIndex + 2;
  const row = listingToRow({ ...listing, id });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!A${actualRowIndex}:AH${actualRowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row],
    },
  });

  return { ...listing, id };
}

/**
 * Look up a sheet tab name by its numeric gid (sheetId).
 * Returns null if the gid is not found.
 */
export async function getSheetTabNameByGid(spreadsheetId: string, gid: number): Promise<string | null> {
  const sheets = getSheets();
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const found = meta.data.sheets?.find((s: any) => s.properties?.sheetId === gid);
    return found?.properties?.title ?? null;
  } catch {
    return null;
  }
}

export async function getRowRange(startRow: number, endRow: number, spreadsheetId?: string, sheetTabName?: string): Promise<BatchRowData[]> {
  if (startRow < 2) throw new Error("startRow must be >= 2 (row 1 is the header)");
  if (endRow < startRow) throw new Error("endRow must be >= startRow");
  if (endRow - startRow > 499) throw new Error("Range too large (max 500 rows)");

  const sheets = getSheets();
  const spreadsheetId_ = spreadsheetId || process.env.SPREADSHEET_ID;
  if (!spreadsheetId_) throw new Error("SPREADSHEET_ID not configured");

  const tabName = sheetTabName || SHEET_NAME;

  // Fetch A-P as a contiguous range (all 16 display columns in one call) + AC separately
  let apRows: string[][] = [];
  let acValues: string[][] = [];
  let apStart = startRow;
  let acStart = startRow;

  // Parse the first row number from a range string like "Sheet1!A2:P50"
  const rangeStartRow = (rangeStr: string | null | undefined): number => {
    if (!rangeStr) return startRow;
    const m = rangeStr.match(/\D(\d+)(?::|$)/);
    return m ? parseInt(m[1], 10) : startRow;
  };

  try {
    const batchResponse = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: spreadsheetId_,
      ranges: [
        `${tabName}!A${startRow}:R${endRow}`,
        `${tabName}!AC${startRow}:AC${endRow}`,
      ],
    });
    const vr = batchResponse.data.valueRanges || [];
    apRows = (vr[0]?.values || []) as string[][];
    apStart = rangeStartRow(vr[0]?.range);
    acValues = (vr[1]?.values || []) as string[][];
    acStart = rangeStartRow(vr[1]?.range);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("exceeds grid limits")) throw err;
    // Sheet has fewer columns than AC — retry without AC
    const fallback = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: spreadsheetId_,
      ranges: [`${tabName}!A${startRow}:R${endRow}`],
    });
    const vr = fallback.data.valueRanges || [];
    apRows = (vr[0]?.values || []) as string[][];
    apStart = rangeStartRow(vr[0]?.range);
    // acValues stays empty — GEO IDs will be blank for this sheet
  }

  const count = endRow - startRow + 1;
  const results: BatchRowData[] = [];
  for (let i = 0; i < count; i++) {
    const rowNum = startRow + i;
    // A-R row (18 columns, indices 0-17)
    const apIdx = rowNum - apStart;
    const row = (apIdx >= 0 && apIdx < apRows.length) ? apRows[apIdx] : [];
    // AC column
    const acIdx = rowNum - acStart;
    const ac = (acIdx >= 0 && acIdx < acValues.length) ? (acValues[acIdx]?.[0] || "") : "";

    results.push({
      rowNumber: rowNum,
      colA: row[0] || "",   // A - BLASTED FORMAT
      colB: row[1] || "",   // B - Type
      colC: row[2] || "",   // C - Area
      colD: row[3] || "",   // D - City
      colE: row[4] || "",   // E - Lot Area
      colF: row[5] || "",   // F - Floor Area
      colG: row[6] || "",   // G - Price
      colH: row[7] || "",   // H - Sale or Lease
      colI: row[8] || "",   // I - With Income
      colJ: row[9] || "",   // J - Direct or Cobroker
      colK: row[10] || "",  // K - Owner/Broker
      colL: row[11] || "",  // L - Away
      colM: row[12] || "",  // M - Date Received
      colN: row[13] || "",  // N - Date Updated
      colO: row[14] || "",  // O - Status
      colP: row[15] || "",  // P - Listing Ownership
      colQ: row[16] || "",  // Q - custom col
      colR: row[17] || "",  // R - custom col
      colAC: ac,            // AC - GEO ID
    });
  }
  return results;
}

/** Write the assigned GEO ID back to COL AC of the MAIN tab row that matches sourceText.
 *  Since Sheet1 row numbers differ from MAIN tab row numbers, we search MAIN!A:A for the
 *  listing content and write to the found row. Falls back to rowNumber if no match found. */
export async function writeBatchSourceGeoId(
  spreadsheetId: string,
  rowNumber: number,
  geoId: string,
  sheetGid?: string,
  sourceText?: string
): Promise<void> {
  const sheets = getSheets();

  // Primary path: content-search in MAIN tab to find the correct row
  if (sourceText && sourceText.trim()) {
    try {
      const colAResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `MAIN!A:A`,
      });
      const colAValues = (colAResponse.data.values || []) as string[][];
      const firstLine = sourceText.trim().split('\n')[0].trim().toLowerCase();
      const foundIdx = colAValues.findIndex((row) => {
        const cellFirstLine = (row[0] || "").trim().split('\n')[0].trim().toLowerCase();
        return cellFirstLine.length > 10 && cellFirstLine === firstLine;
      });
      if (foundIdx >= 0) {
        const mainRow = foundIdx + 1; // 1-indexed
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `MAIN!AC${mainRow}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [[geoId]] },
        });
        console.log(`✅ Content match: wrote GEO ID ${geoId} to MAIN!AC${mainRow} (Sheet1 row was ${rowNumber})`);
        return;
      }
      console.warn(`⚠️ No MAIN tab row matched source text first line: "${firstLine.substring(0, 40)}". Falling back to row ${rowNumber}.`);
    } catch (err) {
      console.warn(`⚠️ MAIN tab content search failed:`, err instanceof Error ? err.message : err);
    }
  }

  // Fallback: write using the row number directly (works when row numbers match)
  let sheetTabName = "MAIN";
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const mainTab = meta.data.sheets?.find((s: any) => s.properties?.title === "MAIN");
    if (mainTab) {
      sheetTabName = "MAIN";
    } else if (sheetGid) {
      const gidNum = parseInt(sheetGid, 10);
      const byGid = meta.data.sheets?.find((s: any) => s.properties?.sheetId === gidNum);
      sheetTabName = byGid?.properties?.title ?? meta.data.sheets?.[0]?.properties?.title ?? SHEET_NAME;
    } else {
      sheetTabName = meta.data.sheets?.[0]?.properties?.title ?? SHEET_NAME;
    }
  } catch { /* keep "MAIN" */ }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetTabName}!AC${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[geoId]] },
  });
  console.log(`✅ Wrote GEO ID ${geoId} to ${sheetTabName}!AC${rowNumber} (row-number fallback)`);
}

export async function deleteListing(id: string, overrideSpreadsheetId?: string): Promise<boolean> {
  const sheets = getSheets();
  const spreadsheetId = overrideSpreadsheetId || process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID not configured");
  }

  // Resolve actual tab name (for backup sheets with different tab names)
  let sheetTabName = SHEET_NAME;
  if (overrideSpreadsheetId) {
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const found = meta.data.sheets?.find((s: any) => s.properties?.title === SHEET_NAME);
      sheetTabName = found?.properties?.title ?? meta.data.sheets?.[0]?.properties?.title ?? SHEET_NAME;
    } catch { /* keep SHEET_NAME */ }
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetTabName}!AC2:AC`,
  });

  const idColumn = response.data.values || [];
  const rowIndex = idColumn.findIndex((row) => row[0] === id);

  if (rowIndex === -1) {
    return false;
  }

  const actualRowIndex = rowIndex + 2;

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  const sheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === sheetTabName
  );

  if (!sheet?.properties?.sheetId) {
    throw new Error("Sheet not found");
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: "ROWS",
              startIndex: actualRowIndex - 1,
              endIndex: actualRowIndex,
            },
          },
        },
      ],
    },
  });

  return true;
}

import { google } from "googleapis";
import { JWT } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const SHEET_NAME = "Sheet1";

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
  BB_DATE_RECV: 53,         // BB - DATE RECV
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
};

// Which cells to annotate with an "Updated by" note, and by whom
export type NoteConfig = { updatedBy: string; cols: Set<number> };

// Interface for batch row data (col A + col AC + key display cols)
export interface BatchRowData {
  rowNumber: number;  // 1-indexed sheet row
  colA: string;       // BLASTED FORMAT (raw listing text)
  colAC: string;      // GEO ID (lookup key)
  colJ: string;       // Direct or with Cobroker
  colK: string;       // Owner/Broker name
  colL: string;       // How many broker away
  colM: string;       // Date Received
  colN: string;       // Date Resorted/Updated
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
}

// Interface for full row data (A-BO)
export interface GSheetFullRow extends GSheetDisplayData {
  geoId: string;              // AC
  main: string;               // AA
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
  supabaseDateRecv: string;   // BB
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
}

export function getAuth() {
  // Try to use the service account JSON file first (more reliable for local dev)
  const serviceAccountPath = path.join(process.cwd(), "service-account.json");

  if (fs.existsSync(serviceAccountPath)) {
    try {
      const credentialsJson = fs.readFileSync(serviceAccountPath, "utf-8");
      const credentials = JSON.parse(credentialsJson);
      console.log("GSheet Auth: Using service-account.json file");
      return new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: SCOPES,
      });
    } catch (fileError) {
      console.error("GSheet Auth: Error reading service-account.json:", fileError);
    }
  }

  // Fallback to environment variables (Production/Vercel)
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !privateKey) {
    throw new Error("Google service account credentials (EMAIL or PRIVATE_KEY) not configured");
  }

  // Robust private key parsing
  let processedKey = privateKey.trim();

  // 1. Handle JSON-stringified keys (removes wrapping quotes and unescapes \n)
  if (processedKey.startsWith('"') && processedKey.endsWith('"')) {
    try {
      processedKey = JSON.parse(processedKey);
    } catch {
      // Not valid JSON, strip quotes manually
      processedKey = processedKey.substring(1, processedKey.length - 1);
    }
  }

  // 2. Handle single-quote wrapping (sometimes added by Vercel UI)
  if (processedKey.startsWith("'") && processedKey.endsWith("'")) {
    processedKey = processedKey.substring(1, processedKey.length - 1);
  }

  // 3. Replace literal \n sequences with actual newlines
  processedKey = processedKey.replace(/\\n/g, "\n");

  // 4. Final safety: ensure the key format is correct for OpenSSL
  if (!processedKey.includes("-----BEGIN PRIVATE KEY-----")) {
    console.error("GSheet Auth: Key is missing BEGIN tag. Length:", processedKey.length);
  }

  return new JWT({
    email,
    key: processedKey,
    scopes: SCOPES,
  });
}

export function getSheets() {
  const auth = getAuth();
  return google.sheets({ version: "v4", auth });
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

  // Primary: search COL AC (GEO ID sync column)
  const acResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!AC2:AC`,
  });

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
 * Format: G##### (e.g., G11497 → G11498)
 */
export async function generateNextGeoId(): Promise<string> {
  const sheets = getSheets();
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID not configured");
  }

  // Read all GEO IDs from column AC
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!AC2:AC`,
  });

  const idColumn = response.data.values || [];

  // Find the highest number from all GEO IDs
  let maxNumber = 0;
  let prefix = "G"; // Default prefix

  for (const row of idColumn) {
    const geoId = row[0];
    if (!geoId) continue;

    // Extract prefix (letters) and number from GEO ID (e.g., "G11497" → "G", 11497)
    const match = geoId.match(/^([A-Z]+)(\d+)$/i);
    if (match) {
      const num = parseInt(match[2], 10);
      if (num > maxNumber) {
        maxNumber = num;
        prefix = match[1].toUpperCase();
      }
    }
  }

  // Generate next ID
  const nextNumber = maxNumber + 1;
  const nextGeoId = `${prefix}${nextNumber}`;

  console.log(`Generated next GEO ID: ${nextGeoId} (max was ${prefix}${maxNumber})`);
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
    supabaseDateRecv: row[GSHEET_COLUMNS.BB_DATE_RECV] || "",
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

export async function findRowByColAText(previewText: string): Promise<GSheetFullRow | null> {
  const sheets = getSheets();
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID not configured");
  }

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
    ranges: [`${SHEET_NAME}!A2:A`, `${SHEET_NAME}!AC2:AC`],
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
      const geoId = colACValues[i]?.[0] || "";
      const rowNumber = i + 2; // +2 for header and 0-indexing
      console.log(`GSheet COL A text match at row ${rowNumber}, GEO ID: ${geoId} (${Math.round(matchRatio * 100)}% match)`);

      // Read the full row (A-BO)
      const rowResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SHEET_NAME}!A${rowNumber}:BO${rowNumber}`,
      });
      const row = rowResponse.data.values?.[0] || [];
      return parseGSheetRow(row);
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
  dateRecv: string;         // BB
  dateUpdated: string;      // BC
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
}

/**
 * Update Supabase sync columns Z-BO for a listing by GEO ID
 */
export async function updateSyncColumns(geoId: string, data: GSheetSyncData, fallbackText?: string, noteConfig?: NoteConfig): Promise<boolean> {
  const sheets = getSheets();
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID not configured");
  }

  let rowNumber = await findRowByGeoId(geoId);
  if (!rowNumber && fallbackText) {
    console.log(`GEO ID ${geoId} not in COL AC — trying COL A text match as fallback`);
    rowNumber = await findRowNumberByColAText(fallbackText);
  }
  if (!rowNumber) {
    console.error(`GEO ID ${geoId} not found in GSheet (COL AC or COL A)`);
    return false;
  }

  // Build array for Z-BO (42 columns, indices 25-66 absolute, 0-41 relative)
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
    data.salePrice,        // AS (19)
    data.saleSqm,          // AT (20)
    data.leasePrice,       // AU (21)
    data.leaseSqm,         // AV (22)
    data.comments,         // AW (23)
    data.withIncome,       // AX (24)
    data.directBroker,     // AY (25)
    data.name,             // AZ (26)
    data.away,             // BA (27)
    data.dateRecv,         // BB (28)
    data.dateUpdated,      // BC (29)
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

  // Batch write: COL A (blastedFormat) + COL Z-BO (sync data) in one API call
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: `${SHEET_NAME}!A${rowNumber}`,
          values: [[blastedFormatToWrite]],
        },
        {
          range: `${SHEET_NAME}!Z${rowNumber}:BO${rowNumber}`,
          values: [rowData],
        },
      ],
    },
  });

  // Insert notes only on columns that actually changed
  if (noteConfig && noteConfig.cols.size > 0) {
    try {
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const sheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === SHEET_NAME
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
export async function updateDisplayColumns(geoId: string, data: GSheetDisplayData, fallbackText?: string, noteConfig?: NoteConfig): Promise<boolean> {
  const sheets = getSheets();
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID not configured");
  }

  let rowNumber = await findRowByGeoId(geoId);
  if (!rowNumber && fallbackText) {
    console.log(`GEO ID ${geoId} not in COL AC — trying COL A text match as fallback`);
    rowNumber = await findRowNumberByColAText(fallbackText);
  }
  if (!rowNumber) {
    console.error(`GEO ID ${geoId} not found in GSheet (COL AC or COL A)`);
    return false;
  }

  // Build row array for columns A-P (16 columns)
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
  ];

  // Write values
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!A${rowNumber}:P${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [rowData],
    },
  });

  // Apply font formatting: Calibri, size 11, no bold
  try {
    // Get sheet ID
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === SHEET_NAME
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
    dateReceived: fallback(gsheetRow.dateReceived, gsheetRow.supabaseDateRecv),
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
export async function addNewGSheetRow(data: GSheetDisplayData, overrideGeoId?: string, syncData?: GSheetSyncData): Promise<string> {
  const sheets = getSheets();
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID not configured");
  }

  // Use provided GEO ID or generate a new one
  const geoId = overrideGeoId || await generateNextGeoId();

  // Build full row (A to BO = 67 columns)
  // A-P = display columns (16)
  // Q-Y = empty (9)
  // Z-BO = Supabase sync columns (42)
  const rowData: string[] = new Array(67).fill("");

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
    rowData[GSHEET_COLUMNS.AS_SALE_PRICE] = syncData.salePrice || "";
    rowData[GSHEET_COLUMNS.AT_SALE_SQM] = syncData.saleSqm || "";
    rowData[GSHEET_COLUMNS.AU_LEASE_PRICE] = syncData.leasePrice || "";
    rowData[GSHEET_COLUMNS.AV_LEASE_SQM] = syncData.leaseSqm || "";
    rowData[GSHEET_COLUMNS.AW_COMMENTS] = syncData.comments || "";
    rowData[GSHEET_COLUMNS.AX_WITH_INCOME] = syncData.withIncome || "";
    rowData[GSHEET_COLUMNS.AY_DIRECT_BROKER] = syncData.directBroker || "";
    rowData[GSHEET_COLUMNS.AZ_NAME] = syncData.name || "";
    rowData[GSHEET_COLUMNS.BA_AWAY] = syncData.away || "";
    rowData[GSHEET_COLUMNS.BB_DATE_RECV] = syncData.dateRecv || "";
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
  }

  // Find the next empty row by checking the last row with data in col A and col AC.
  // Using values.update with an explicit range avoids the Sheets API table-detection
  // bug where append() can start writing at col BE instead of col A.
  const [colAResp, colACResp] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: `${SHEET_NAME}!A:A` }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: `${SHEET_NAME}!AC:AC` }),
  ]);
  const rowsInColA = (colAResp.data.values || []).length;
  const rowsInColAC = (colACResp.data.values || []).length;
  const nextRow = Math.max(rowsInColA, rowsInColAC) + 1;

  // Write with an explicit A{n}:BO{n} reference — col A is always index 0
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!A${nextRow}:BO${nextRow}`,
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
      (s) => s.properties?.title === SHEET_NAME
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
                  endColumnIndex: 67, // A-BO
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

  console.log(`✅ Added new GSheet row for ${geoId} (row ${rowNumber})`);
  return geoId;
}

// ============================================================================
// LEGACY FUNCTIONS - For backward compatibility with other parts of the app
// These use a different column structure and are kept for compatibility
// ============================================================================

import { Listing } from "@/types/listing";

const LEGACY_COLUMN_MAP = {
  region: 0,
  province: 1,
  city: 2,
  barangay: 3,
  area: 4,
  building: 5,
  residential: 6,
  commercial: 7,
  industrial: 8,
  agricultural: 9,
  lotArea: 10,
  floorArea: 11,
  status: 12,
  type: 13,
  salePrice: 14,
  salePricePerSqm: 15,
  leasePrice: 16,
  leasePricePerSqm: 17,
  lat: 18,
  long: 19,
  bedrooms: 20,
  toilets: 21,
  garage: 22,
  amenities: 23,
  corner: 24,
  compound: 25,
  photos: 26,
  rawListing: 27,
  id: 28,
  withIncome: 29,
  directOrCobroker: 30,
  ownerBroker: 31,
  howManyAway: 32,
  listingOwnership: 33,
};

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

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A2:AH`,
  });

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

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAME}!A:AH`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row],
    },
  });

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

export async function getRowRange(startRow: number, endRow: number, spreadsheetId?: string): Promise<BatchRowData[]> {
  if (startRow < 2) throw new Error("startRow must be >= 2 (row 1 is the header)");
  if (endRow < startRow) throw new Error("endRow must be >= startRow");
  if (endRow - startRow > 499) throw new Error("Range too large (max 500 rows)");

  const sheets = getSheets();
  const spreadsheetId_ = spreadsheetId || process.env.SPREADSHEET_ID;
  if (!spreadsheetId_) throw new Error("SPREADSHEET_ID not configured");

  // Google Sheets API trims leading AND trailing empty rows from the response.
  // e.g. if K2:K300 has data only at K276, the API returns values=[["Metrosummit"]]
  // with range="Sheet1!K276:K276" — NOT a padded array starting at row 2.
  // We must parse the actual start row from each returned range to correctly map values.

  // Parse the first row number from a range string like "Sheet1!K276:K300"
  const rangeStartRow = (rangeStr: string | null | undefined): number => {
    if (!rangeStr) return startRow;
    const m = rangeStr.match(/\D(\d+):/);
    return m ? parseInt(m[1], 10) : startRow;
  };

  // Look up a value for a specific sheet row, accounting for the API's trimmed start
  const colVal = (values: string[][], apiStart: number, rowNum: number): string => {
    const idx = rowNum - apiStart;
    return (idx >= 0 && idx < values.length) ? (values[idx]?.[0] || "") : "";
  };

  // Per-column start rows (filled after each batchGet)
  let aStart = startRow, acStart = startRow, jStart = startRow,
    kStart = startRow, lStart = startRow, mStart = startRow, nStart = startRow;

  let colAValues: string[][] = [];
  let colACValues: string[][] = [];
  let colJValues: string[][] = [];
  let colKValues: string[][] = [];
  let colLValues: string[][] = [];
  let colMValues: string[][] = [];
  let colNValues: string[][] = [];

  try {
    const batchResponse = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: spreadsheetId_,
      ranges: [
        `${SHEET_NAME}!A${startRow}:A${endRow}`,
        `${SHEET_NAME}!AC${startRow}:AC${endRow}`,
        `${SHEET_NAME}!J${startRow}:J${endRow}`,
        `${SHEET_NAME}!K${startRow}:K${endRow}`,
        `${SHEET_NAME}!L${startRow}:L${endRow}`,
        `${SHEET_NAME}!M${startRow}:M${endRow}`,
        `${SHEET_NAME}!N${startRow}:N${endRow}`,
      ],
    });
    const vr = batchResponse.data.valueRanges || [];
    colAValues = (vr[0]?.values || []) as string[][]; aStart = rangeStartRow(vr[0]?.range);
    colACValues = (vr[1]?.values || []) as string[][]; acStart = rangeStartRow(vr[1]?.range);
    colJValues = (vr[2]?.values || []) as string[][]; jStart = rangeStartRow(vr[2]?.range);
    colKValues = (vr[3]?.values || []) as string[][]; kStart = rangeStartRow(vr[3]?.range);
    colLValues = (vr[4]?.values || []) as string[][]; lStart = rangeStartRow(vr[4]?.range);
    colMValues = (vr[5]?.values || []) as string[][]; mStart = rangeStartRow(vr[5]?.range);
    colNValues = (vr[6]?.values || []) as string[][]; nStart = rangeStartRow(vr[6]?.range);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("exceeds grid limits")) throw err;
    // Sheet has fewer columns than AC — retry without it (M and N are always safe)
    const fallback = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: spreadsheetId_,
      ranges: [
        `${SHEET_NAME}!A${startRow}:A${endRow}`,
        `${SHEET_NAME}!J${startRow}:J${endRow}`,
        `${SHEET_NAME}!K${startRow}:K${endRow}`,
        `${SHEET_NAME}!L${startRow}:L${endRow}`,
        `${SHEET_NAME}!M${startRow}:M${endRow}`,
        `${SHEET_NAME}!N${startRow}:N${endRow}`,
      ],
    });
    const vr = fallback.data.valueRanges || [];
    colAValues = (vr[0]?.values || []) as string[][]; aStart = rangeStartRow(vr[0]?.range);
    colJValues = (vr[1]?.values || []) as string[][]; jStart = rangeStartRow(vr[1]?.range);
    colKValues = (vr[2]?.values || []) as string[][]; kStart = rangeStartRow(vr[2]?.range);
    colLValues = (vr[3]?.values || []) as string[][]; lStart = rangeStartRow(vr[3]?.range);
    colMValues = (vr[4]?.values || []) as string[][]; mStart = rangeStartRow(vr[4]?.range);
    colNValues = (vr[5]?.values || []) as string[][]; nStart = rangeStartRow(vr[5]?.range);
    // colACValues stays empty — GEO IDs will be blank for this sheet
  }

  const count = endRow - startRow + 1;
  const results: BatchRowData[] = [];
  for (let i = 0; i < count; i++) {
    const rowNum = startRow + i;
    results.push({
      rowNumber: rowNum,
      colA: colVal(colAValues, aStart, rowNum),
      colAC: colVal(colACValues, acStart, rowNum),
      colJ: colVal(colJValues, jStart, rowNum),
      colK: colVal(colKValues, kStart, rowNum),
      colL: colVal(colLValues, lStart, rowNum),
      colM: colVal(colMValues, mStart, rowNum),
      colN: colVal(colNValues, nStart, rowNum),
    });
  }
  return results;
}

export async function deleteListing(id: string): Promise<boolean> {
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
    return false;
  }

  const actualRowIndex = rowIndex + 2;

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  const sheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === SHEET_NAME
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

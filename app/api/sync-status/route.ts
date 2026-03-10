import { NextResponse } from "next/server";
import { syncPairedColumns, PairedColumnData } from "@/lib/google-sheets";

const str = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  return String(val);
};

export async function POST(request: Request) {
  // Verify shared secret sent by Supabase webhook
  const incomingSecret = request.headers.get("x-webhook-secret");
  const expectedSecret = process.env.SUPABASE_WEBHOOK_SECRET;

  if (!expectedSecret || incomingSecret !== expectedSecret) {
    console.warn("sync-status: unauthorized webhook call");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();

    // Supabase sends: { type, table, schema, record, old_record }
    const record = payload?.record;
    if (!record) {
      return NextResponse.json({ error: "No record in payload" }, { status: 400 });
    }

    const geoId = str(record["GEO ID"]);
    if (!geoId) {
      return NextResponse.json({ error: "No GEO ID in record" }, { status: 400 });
    }

    const data: PairedColumnData = {
      status:           str(record["STATUS"]),
      lotArea:          str(record["LOT AREA"]),
      floorArea:        str(record["FLOOR AREA"]),
      withIncome:       str(record["WITH INCOME"]),
      directBroker:     str(record["DIRECT OR BROKER"]),
      ownerBroker:      str(record["NAME"]),
      away:             str(record["AWAY"]),
      dateRecv:         str(record["DATE RECV"]),
      dateUpdated:      str(record["DATE UPDATED"]),
      listingOwnership: str(record["LISTING OWNERSHIP"]),
    };

    console.log(`=== SUPABASE WEBHOOK: syncing paired cols for ${geoId} ===`);
    console.log("STATUS:", data.status);

    // Sync working GSheet
    const workingResult = await syncPairedColumns(geoId, data).catch((err) => {
      console.error("Working GSheet sync failed:", err);
      return false;
    });

    // Sync 2nd backup GSheet (non-fatal)
    const backupId = process.env.BACKUP_SPREADSHEET_ID;
    const backupResult = backupId
      ? await syncPairedColumns(geoId, data, backupId).catch((err) => {
          console.warn("Backup GSheet sync failed (non-fatal):", err);
          return false;
        })
      : null;

    console.log(`✅ Working: ${workingResult}, Backup: ${backupResult}`);

    return NextResponse.json({
      success: true,
      geoId,
      working: workingResult,
      backup: backupResult,
    });
  } catch (err) {
    console.error("sync-status webhook error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}

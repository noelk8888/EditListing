import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getSheetTabNameByGid, getSheets } from "@/lib/google-sheets";

const CAPTURE_SETTING_KEY = "telegram-batch-capture";
const RUN_LOCK_KEY = "telegram-batch-run-lock";
const PROCESSING_LEASE_MS = 30 * 60 * 1000;
const RUN_LEASE_MS = 60 * 60 * 1000;

export type TelegramBatchStatus = "" | "PROCESSING" | "UPDATED" | "FOR MANUAL CHECKING";

export type TelegramBatchRow = {
  rowNumber: number;
  message1: string;
  message2: string;
  status: TelegramBatchStatus;
  pairId: string;
  queuedAt: string;
  processingStartedAt: string;
};

type CaptureSetting = {
  enabled: boolean;
  updated_at: string;
  updated_by?: string;
};

type RunLock = {
  token: string;
  started_at: string;
  started_by: string;
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getQueueConfig() {
  const spreadsheetId = process.env.TELEGRAM_BATCH_QUEUE_SPREADSHEET_ID;
  const gidRaw = process.env.TELEGRAM_BATCH_QUEUE_SHEET_GID;
  const gid = Number(gidRaw);
  if (!spreadsheetId) throw new Error("TELEGRAM_BATCH_QUEUE_SPREADSHEET_ID is not configured");
  if (!Number.isInteger(gid) || gid < 0) throw new Error("TELEGRAM_BATCH_QUEUE_SHEET_GID is not configured");
  return { spreadsheetId, gid };
}

async function getQueueSheet() {
  const { spreadsheetId, gid } = getQueueConfig();
  const tabName = await getSheetTabNameByGid(spreadsheetId, gid);
  if (!tabName) throw new Error(`Telegram batch queue tab with gid ${gid} was not found`);
  return { spreadsheetId, gid, tabName, sheets: getSheets() };
}

function processingExpired(value: string) {
  const startedAt = new Date(value).getTime();
  return !Number.isFinite(startedAt) || Date.now() - startedAt >= PROCESSING_LEASE_MS;
}

async function ensureHeaders() {
  const queue = await getQueueSheet();
  const response = await queue.sheets.spreadsheets.values.get({
    spreadsheetId: queue.spreadsheetId,
    range: `${queue.tabName}!A1:F1`,
  });
  const current = response.data.values?.[0] || [];
  const expected = ["MESSAGE 1", "MESSAGE 2", "STATUS", "PAIR ID", "QUEUED AT", "PROCESSING STARTED AT"];
  const next = expected.map((header, index) => String(current[index] || header));
  const headersChanged = next.some((value, index) => value !== String(current[index] || ""));
  if (headersChanged) {
    await queue.sheets.spreadsheets.values.update({
      spreadsheetId: queue.spreadsheetId,
      range: `${queue.tabName}!A1:F1`,
      valueInputOption: "RAW",
      requestBody: { values: [next] },
    });
    await queue.sheets.spreadsheets.batchUpdate({
      spreadsheetId: queue.spreadsheetId,
      requestBody: {
        requests: [{
          updateDimensionProperties: {
            range: { sheetId: queue.gid, dimension: "COLUMNS", startIndex: 3, endIndex: 6 },
            properties: { hiddenByUser: true },
            fields: "hiddenByUser",
          },
        }],
      },
    });
  }
  return queue;
}

export async function getTelegramBatchCapture() {
  const { data, error } = await getSupabase()
    .from("app_settings")
    .select("value")
    .eq("key", CAPTURE_SETTING_KEY)
    .maybeSingle();
  if (error) throw new Error(`Could not read Telegram batch setting: ${error.message}`);
  const value = (data?.value || {}) as Partial<CaptureSetting>;
  return { enabled: value.enabled === true, updatedAt: value.updated_at || null, updatedBy: value.updated_by || null };
}

export async function setTelegramBatchCapture(enabled: boolean, updatedBy: string) {
  const value: CaptureSetting = {
    enabled,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };
  const { error } = await getSupabase().from("app_settings").upsert(
    { key: CAPTURE_SETTING_KEY, value },
    { onConflict: "key" }
  );
  if (error) throw new Error(`Could not update Telegram batch setting: ${error.message}`);
  return value;
}

export async function appendTelegramBatchPair(input: {
  message1: string;
  message2: string;
  pairId: string;
  queuedAt: string;
}) {
  const queue = await ensureHeaders();
  const ids = await queue.sheets.spreadsheets.values.get({
    spreadsheetId: queue.spreadsheetId,
    range: `${queue.tabName}!D2:D`,
  });
  const existingIndex = (ids.data.values || []).findIndex((row) => String(row?.[0] || "") === input.pairId);
  if (existingIndex >= 0) return { rowNumber: existingIndex + 2, appended: false };

  const response = await queue.sheets.spreadsheets.values.append({
    spreadsheetId: queue.spreadsheetId,
    range: `${queue.tabName}!A:F`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[input.message1, input.message2, "", input.pairId, input.queuedAt, ""]],
    },
  });
  const updatedRange = response.data.updates?.updatedRange || "";
  const rowMatch = updatedRange.match(/!(?:[A-Z]+)(\d+):/);
  return { rowNumber: rowMatch ? Number(rowMatch[1]) : null, appended: true };
}

export async function listTelegramBatchRows() {
  const queue = await ensureHeaders();
  const response = await queue.sheets.spreadsheets.values.get({
    spreadsheetId: queue.spreadsheetId,
    range: `${queue.tabName}!A2:F`,
  });
  const allRows: TelegramBatchRow[] = (response.data.values || []).map((row, index) => ({
    rowNumber: index + 2,
    message1: String(row?.[0] || ""),
    message2: String(row?.[1] || ""),
    status: String(row?.[2] || "").trim().toUpperCase() as TelegramBatchStatus,
    pairId: String(row?.[3] || ""),
    queuedAt: String(row?.[4] || ""),
    processingStartedAt: String(row?.[5] || ""),
  }));

  return allRows.filter((row) =>
    row.message1.trim() &&
    row.message2.trim() &&
    row.pairId.trim() &&
    (row.status === "" || (row.status === "PROCESSING" && processingExpired(row.processingStartedAt)))
  );
}

async function findQueueRow(pairId: string) {
  const queue = await getQueueSheet();
  const response = await queue.sheets.spreadsheets.values.get({
    spreadsheetId: queue.spreadsheetId,
    range: `${queue.tabName}!C2:F`,
  });
  const index = (response.data.values || []).findIndex((row) => String(row?.[1] || "") === pairId);
  return { ...queue, rowNumber: index < 0 ? null : index + 2, row: index < 0 ? null : response.data.values?.[index] || [] };
}

export async function claimTelegramBatchRow(pairId: string) {
  const found = await findQueueRow(pairId);
  if (!found.rowNumber || !found.row) throw new Error("Queue row was not found");
  const status = String(found.row[0] || "").trim().toUpperCase();
  const processingStartedAt = String(found.row[3] || "");
  if (status && !(status === "PROCESSING" && processingExpired(processingStartedAt))) {
    throw new Error(`Queue row is already ${status}`);
  }
  const now = new Date().toISOString();
  await found.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: found.spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: `${found.tabName}!C${found.rowNumber}`, values: [["PROCESSING"]] },
        { range: `${found.tabName}!F${found.rowNumber}`, values: [[now]] },
      ],
    },
  });
  return { rowNumber: found.rowNumber, processingStartedAt: now };
}

export async function setTelegramBatchRowStatus(pairId: string, status: "UPDATED" | "FOR MANUAL CHECKING" | "") {
  const found = await findQueueRow(pairId);
  if (!found.rowNumber) throw new Error("Queue row was not found");
  await found.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: found.spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: `${found.tabName}!C${found.rowNumber}`, values: [[status]] },
        { range: `${found.tabName}!F${found.rowNumber}`, values: [[""]] },
      ],
    },
  });
}

export async function deleteUpdatedTelegramBatchRows() {
  const queue = await getQueueSheet();
  const [values, metadata] = await Promise.all([
    queue.sheets.spreadsheets.values.get({ spreadsheetId: queue.spreadsheetId, range: `${queue.tabName}!C2:C` }),
    queue.sheets.spreadsheets.get({ spreadsheetId: queue.spreadsheetId }),
  ]);
  const sheetId = metadata.data.sheets?.find((sheet) => sheet.properties?.title === queue.tabName)?.properties?.sheetId;
  if (sheetId === undefined) throw new Error(`Queue tab "${queue.tabName}" was not found`);
  const rows = (values.data.values || [])
    .map((row, index) => ({ rowNumber: index + 2, status: String(row?.[0] || "").trim().toUpperCase() }))
    .filter((row) => row.status === "UPDATED")
    .sort((a, b) => b.rowNumber - a.rowNumber);
  if (!rows.length) return { deleted: 0 };
  await queue.sheets.spreadsheets.batchUpdate({
    spreadsheetId: queue.spreadsheetId,
    requestBody: {
      requests: rows.map((row) => ({
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: row.rowNumber - 1, endIndex: row.rowNumber },
        },
      })),
    },
  });
  return { deleted: rows.length };
}

function lockExpired(lock: Partial<RunLock>) {
  const startedAt = new Date(lock.started_at || "").getTime();
  return !Number.isFinite(startedAt) || Date.now() - startedAt >= RUN_LEASE_MS;
}

export async function claimTelegramBatchRun(startedBy: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", RUN_LOCK_KEY).maybeSingle();
  if (error) throw new Error(`Could not read batch lock: ${error.message}`);
  const current = (data?.value || null) as RunLock | null;
  if (current && !lockExpired(current)) throw new Error(`A Batch Update is already running for ${current.started_by}`);

  const lock: RunLock = { token: randomUUID(), started_at: new Date().toISOString(), started_by: startedBy };
  if (!current) {
    const { error: insertError } = await supabase.from("app_settings").insert({ key: RUN_LOCK_KEY, value: lock });
    if (insertError) throw new Error("Another Batch Update started at the same time");
  } else {
    const { data: updated, error: updateError } = await supabase
      .from("app_settings")
      .update({ value: lock })
      .eq("key", RUN_LOCK_KEY)
      .contains("value", { token: current.token })
      .select("key")
      .maybeSingle();
    if (updateError || !updated) throw new Error("Another Batch Update started at the same time");
  }
  return lock;
}

export async function releaseTelegramBatchRun(token: string) {
  const { error } = await getSupabase()
    .from("app_settings")
    .delete()
    .eq("key", RUN_LOCK_KEY)
    .contains("value", { token });
  if (error) throw new Error(`Could not release batch lock: ${error.message}`);
}

export async function refreshTelegramBatchRun(token: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", RUN_LOCK_KEY)
    .contains("value", { token })
    .maybeSingle();
  if (error) throw new Error(`Could not validate batch lock: ${error.message}`);
  if (!data) throw new Error("This Batch Update lock has expired or was replaced");
  const current = data.value as RunLock;
  const next = { ...current, started_at: new Date().toISOString() };
  const { data: refreshed, error: refreshError } = await supabase
    .from("app_settings")
    .update({ value: next })
    .eq("key", RUN_LOCK_KEY)
    .contains("value", { token })
    .select("key")
    .maybeSingle();
  if (refreshError || !refreshed) throw new Error("This Batch Update lock has expired or was replaced");
}

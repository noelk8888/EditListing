import { createClient } from "@supabase/supabase-js";
import { shouldPurgeTelegramSetting, TELEGRAM_RECORD_RETENTION_MS } from "@/lib/telegram-record-retention";

const PAGE_SIZE = 1000;
const DELETE_BATCH_SIZE = 100;

type TransientSettingRow = {
  key: string;
  value: Record<string, unknown> | null;
  updated_at?: string | null;
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function purgeExpiredTelegramRecords(now = Date.now()) {
  const supabase = getSupabase();
  const rows: TransientSettingRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value, updated_at")
      .or("key.like.telegram-forward:%,key.like.telegram-lite-pending:%")
      .order("key", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not scan temporary Telegram records: ${error.message}`);
    const page = (data || []) as TransientSettingRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const expiredKeys = rows
    .filter((row) => shouldPurgeTelegramSetting({
      key: row.key,
      value: row.value,
      updatedAt: row.updated_at,
      now,
    }))
    .map((row) => row.key);

  for (let index = 0; index < expiredKeys.length; index += DELETE_BATCH_SIZE) {
    const keys = expiredKeys.slice(index, index + DELETE_BATCH_SIZE);
    const { error } = await supabase.from("app_settings").delete().in("key", keys);
    if (error) throw new Error(`Could not purge temporary Telegram records: ${error.message}`);
  }

  return {
    scanned: rows.length,
    deleted: expiredKeys.length,
    retained: rows.length - expiredKeys.length,
    retentionHours: TELEGRAM_RECORD_RETENTION_MS / (60 * 60 * 1000),
    cutoff: new Date(now - TELEGRAM_RECORD_RETENTION_MS).toISOString(),
  };
}

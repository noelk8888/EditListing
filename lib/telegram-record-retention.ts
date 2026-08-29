export const TELEGRAM_RECORD_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

const TRANSIENT_TELEGRAM_PREFIXES = [
  "telegram-forward:",
  // Legacy Auto Lite records are included so the retired workflow cleans up
  // naturally without requiring a one-time destructive database operation.
  "telegram-lite-pending:",
] as const;

export function isTransientTelegramSettingKey(key: string): boolean {
  return TRANSIENT_TELEGRAM_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function validTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function getTelegramRecordActivityTime(
  value: Record<string, unknown> | null | undefined,
  rowUpdatedAt?: string | null
): number | null {
  const candidates = [
    value?.deletion_requested_at,
    value?.processing_started_at,
    value?.created_at,
    value?.forwarded_at,
    rowUpdatedAt,
  ]
    .map(validTimestamp)
    .filter((timestamp): timestamp is number => timestamp !== null);

  return candidates.length ? Math.max(...candidates) : null;
}

export function shouldPurgeTelegramSetting(input: {
  key: string;
  value: Record<string, unknown> | null | undefined;
  updatedAt?: string | null;
  now?: number;
  retentionMs?: number;
}): boolean {
  if (!isTransientTelegramSettingKey(input.key)) return false;
  const activityTime = getTelegramRecordActivityTime(input.value, input.updatedAt);
  if (activityTime === null) return false;
  const now = input.now ?? Date.now();
  const retentionMs = input.retentionMs ?? TELEGRAM_RECORD_RETENTION_MS;
  return now - activityTime >= retentionMs;
}

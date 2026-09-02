const MANILA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIDNIGHT_SAFETY_BUFFER_MS = 2 * 60 * 1000;

/** Return the next midnight in Asia/Manila as an ISO timestamp. */
export function getNextManilaMidnight(now = new Date()) {
  const manilaTime = now.getTime() + MANILA_UTC_OFFSET_MS;
  const nextDayStart = Math.floor(manilaTime / DAY_MS) * DAY_MS + DAY_MS;
  return new Date(nextDayStart - MANILA_UTC_OFFSET_MS).toISOString();
}

/** Stop starting automatic work two minutes before Manila midnight. */
export function getManilaAutomaticBatchCutoff(now = new Date()) {
  return new Date(
    new Date(getNextManilaMidnight(now)).getTime() - MIDNIGHT_SAFETY_BUFFER_MS
  ).toISOString();
}

export function hasAutomaticBatchDeadlinePassed(deadlineAt?: string, now = new Date()) {
  if (!deadlineAt) return false;
  const deadline = new Date(deadlineAt).getTime();
  return Number.isFinite(deadline) && now.getTime() >= deadline;
}

export function getAutomaticBatchRetryRetentionSeconds(deadlineAt: string, now = new Date()) {
  const remainingSeconds = Math.ceil((new Date(deadlineAt).getTime() - now.getTime()) / 1000);
  return Math.max(60, Math.min(24 * 60 * 60, remainingSeconds));
}

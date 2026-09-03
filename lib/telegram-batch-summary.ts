export type AutomaticBatchSummary = {
  processed: number;
  updated: number;
  manualChecking: number;
  completedAt: string;
};

function formatManilaCompletionTime(completedAt: string) {
  const completed = new Date(completedAt);
  if (!Number.isFinite(completed.getTime())) throw new Error("Invalid Batch Lite completion time");

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).formatToParts(completed);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  const time = `${value("hour")}:${value("minute")}${value("dayPeriod").toLowerCase()}`;
  return `${time} ${value("month")} ${value("day")}, ${value("year")}`;
}

export function formatAutomaticBatchSummary(summary: AutomaticBatchSummary) {
  const listingLabel = summary.processed === 1 ? "listing was" : "listings were";
  const firstLine = `${summary.processed} ${listingLabel} automatically processed at ${formatManilaCompletionTime(summary.completedAt)}.`;
  if (!summary.manualChecking) return firstLine;

  const updatedLabel = summary.updated === 1 ? "listing updated" : "listings updated";
  const manualLabel = summary.manualChecking === 1 ? "listing" : "listings";
  return `${firstLine}\n${summary.updated} ${updatedLabel}; ${summary.manualChecking} ${manualLabel} marked FOR MANUAL CHECKING.`;
}

export async function sendAutomaticBatchSummaryToTelegram(summary: AutomaticBatchSummary) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_FORWARD_DESTINATION_CHAT_ID;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  if (!chatId) throw new Error("TELEGRAM_FORWARD_DESTINATION_CHAT_ID is not configured");

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatAutomaticBatchSummary(summary),
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(`Telegram Batch Lite summary error: ${result.description || response.statusText}`);
  }
}

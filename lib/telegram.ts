// Map group label → env var name
const GROUP_ENV_MAP: Record<string, string> = {
  "RESIDENTIAL":    "TELEGRAM_CHAT_RESIDENTIAL",
  "COMMERCIAL":     "TELEGRAM_CHAT_COMMERCIAL",
  "INDUSTRIAL":     "TELEGRAM_CHAT_INDUSTRIAL",
  "AGRICULTURAL":   "TELEGRAM_CHAT_AGRICULTURAL",
  "UPDATE LISTING": "TELEGRAM_CHAT_UPDATE_LISTING",
};

export async function sendTelegramNotification(
  message: string,
  groups?: string[]  // e.g. ["RESIDENTIAL", "COMMERCIAL"]
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  let chatIds: string[] = [];

  if (groups && groups.length > 0) {
    // Resolve each selected group to its chat ID env var
    for (const g of groups) {
      const envKey = GROUP_ENV_MAP[g];
      const id = envKey ? process.env[envKey] : undefined;
      if (id) chatIds.push(id.trim());
    }
  }

  // Fallback to TELEGRAM_CHAT_ID if no group IDs resolved
  if (chatIds.length === 0) {
    const fallback = process.env.TELEGRAM_CHAT_ID;
    if (!fallback) return;
    chatIds = fallback.split(",").map(id => id.trim()).filter(Boolean);
  }

  // Telegram max message length is 4096 chars
  const truncated = message.length > 4000 ? message.slice(0, 4000) + "\n...[truncated]" : message;

  for (const chatId of chatIds) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: truncated }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error(`Telegram API error for chat ${chatId}:`, err);
      }
    } catch (error) {
      // Don't throw — notification failure should never break the save flow
      console.error(`Telegram notification error for chat ${chatId}:`, error);
    }
  }
}

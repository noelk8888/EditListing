// Map group label → env var name
const GROUP_ENV_MAP: Record<string, string> = {
  "RESIDENTIAL": "TELEGRAM_CHAT_RESIDENTIAL",
  "COMMERCIAL": "TELEGRAM_CHAT_COMMERCIAL",
  "INDUSTRIAL": "TELEGRAM_CHAT_INDUSTRIAL",
  "AGRICULTURAL": "TELEGRAM_CHAT_AGRICULTURAL",
  "UPDATE LISTING": "TELEGRAM_CHAT_UPDATE_LISTING",
  "TEST OPTION": "TELEGRAM_CHAT_TEST_POSTING",
  "TEST": "TELEGRAM_CHAT_TEST_POSTING",
};

export async function sendTelegramNotification(
  message: string,
  groups?: string[]  // e.g. ["RESIDENTIAL", "COMMERCIAL"]
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("⚠️ Telegram notification skipped: TELEGRAM_BOT_TOKEN is missing.");
    return;
  }

  let chatIds: string[] = [];

  if (groups && groups.length > 0) {
    console.log("Resolving Telegram groups:", groups);
    // Resolve each selected group to its chat ID env var
    for (const g of groups) {
      const envKey = GROUP_ENV_MAP[g];
      const id = envKey ? process.env[envKey] : undefined;
      if (id) {
        chatIds.push(id.trim());
      } else {
        console.warn(`⚠️ Telegram group "${g}" (env: ${envKey}) has no chat ID set.`);
      }
    }
  }

  // Fallback to TELEGRAM_CHAT_ID if no group IDs resolved
  if (chatIds.length === 0) {
    const fallback = process.env.TELEGRAM_CHAT_ID;
    if (!fallback) {
      console.warn("⚠️ Telegram notification skipped: No chat IDs resolved and TELEGRAM_CHAT_ID is missing.");
      return;
    }
    console.log("Falling back to TELEGRAM_CHAT_ID");
    chatIds = fallback.split(",").map(id => id.trim()).filter(Boolean);
  }

  console.log(`Sending Telegram notification to ${chatIds.length} chat(s):`, chatIds);

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

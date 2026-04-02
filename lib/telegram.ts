import { fetchTelegramChatIds } from "./supabase";

// Map group label → env var name
const GROUP_ENV_MAP: Record<string, string> = {
  "DIRECT": "TELEGRAM_CHAT_DIRECT",
  "RESIDENTIAL": "TELEGRAM_CHAT_RESIDENTIAL",
  "COMMERCIAL": "TELEGRAM_CHAT_COMMERCIAL",
  "INDUSTRIAL": "TELEGRAM_CHAT_INDUSTRIAL",
  "COM 'L / IND'L": "TELEGRAM_CHAT_COMMERCIAL",
  "AGRICULTURAL": "TELEGRAM_CHAT_AGRICULTURAL",
  "BUSINESS FOR SALE": "TELEGRAM_CHAT_BUSINESS_FOR_SALE",
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
    
    const dbLookupGroups: string[] = [];

    // 1. First check ENV vars for legacy groups
    for (const g of groups) {
      const envKey = GROUP_ENV_MAP[g];
      const id = envKey ? process.env[envKey] : undefined;
      if (id) {
        chatIds.push(id.trim());
      } else {
        dbLookupGroups.push(g);
      }
    }

    // 2. Fetch remaining from Supabase
    if (dbLookupGroups.length > 0) {
      const dbIds = await fetchTelegramChatIds(dbLookupGroups);
      chatIds = Array.from(new Set([...chatIds, ...dbIds]));
    }
  }

  // Always include TELEGRAM_CHAT_ID as the base destination
  const mainGroup = process.env.TELEGRAM_CHAT_ID;
  if (mainGroup) {
    const mainIds = mainGroup.split(",").map(id => id.trim()).filter(Boolean);
    chatIds = Array.from(new Set([...mainIds, ...chatIds]));
  }

  if (chatIds.length === 0) {
    console.warn("⚠️ Telegram notification skipped: No chat IDs resolved (check TELEGRAM_CHAT_ID and category groups).");
    return;
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

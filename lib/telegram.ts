export async function sendTelegramNotification(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIdEnv = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatIdEnv) return; // silently skip if not configured

  // Support comma-separated list of chat IDs
  const chatIds = chatIdEnv.split(",").map(id => id.trim()).filter(Boolean);

  // Telegram max message length is 4096 chars
  const truncated = message.length > 4000 ? message.slice(0, 4000) + "\n...[truncated]" : message;

  for (const chatId of chatIds) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: truncated,
        }),
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

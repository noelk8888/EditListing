import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("Telegram Webhook received:", JSON.stringify(body, null, 2));

    const message = body.message;
    if (!message || !message.text) return NextResponse.json({ ok: true });

    const chatId = message.chat.id.toString();
    const chatTitle = message.chat.title;
    const text = message.text.trim();

    // Only respond to /id command
    if (text === "/id" || text === "/id@LuxeEditBot") {
      if (!chatTitle) {
        return reply(chatId, "This command only works in Groups and Channels with a Title.");
      }

      console.log(`Searching for group: "${chatTitle}" to link ID: ${chatId}`);

      // Try exact match first (case-insensitive)
      let { data, error } = await supabase
        .from("luxe_telegram_groups")
        .select("id, name")
        .ilike("name", chatTitle)
        .single();

      // Fallback: find DB group name contained within the Telegram title
      if (error || !data) {
        const { data: allGroups } = await supabase
          .from("luxe_telegram_groups")
          .select("id, name")
          .is("chat_id", null);

        const titleLower = chatTitle.toLowerCase();
        const match = allGroups?.find(g => titleLower.includes(g.name.toLowerCase()));
        if (match) {
          data = match;
        }
      }

      if (!data) {
        return reply(chatId, `⚠️ Could not find a group matching "${chatTitle}" in the Luxe Hub database. Please check the Admin Hub to verify the group name.`);
      }

      // Update the chat_id
      const { error: updateError } = await supabase
        .from("luxe_telegram_groups")
        .update({ chat_id: chatId })
        .eq("id", data.id);

      if (updateError) {
        return reply(chatId, `❌ Failed to update database: ${updateError.message}`);
      }

      return reply(chatId, `✅ Successfully linked **${data.name}**!\n\nDatabase ID: \`${data.id}\` \nTelegram ID: \`${chatId}\`\n\nThis group is now ready for automated notifications.`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Telegram Webhook Error:", err);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}

async function reply(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ ok: true });

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown"
    }),
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

      // Normalize whitespace (replace all types of spaces/newlines with a single space)
      const normalizedTitle = chatTitle.replace(/\s+/g, " ").trim();
      console.log(`Searching for group: "${normalizedTitle}" to link ID: ${chatId}`);

      // 1. Try exact match (case-insensitive, normalized)
      let { data, error: fetchError } = await supabase
        .from("luxe_telegram_groups")
        .select("id, name")
        .ilike("name", normalizedTitle)
        .single();

      // 2. Fallback: Search by ID if the text is like "/id name" or "/id uuid"
      if (!data && text.startsWith("/id ")) {
        const query = text.replace("/id ", "").trim();
        const { data: idMatch } = await supabase
          .from("luxe_telegram_groups")
          .select("id, name")
          .or(`id.eq.${query},name.ilike.%${query}%`)
          .single();
        if (idMatch) data = idMatch;
      }

      // 3. Fallback: Keyword-based fuzzy search
      if (!data) {
        const { data: allGroups } = await supabase
          .from("luxe_telegram_groups")
          .select("id, name")
          .is("chat_id", null);

        // Common words to ignore for fuzzy matching
        const ignoreWords = ["x", "luxe", "realty", "city", "properties", "property", "the", "&", "and"];
        const titleWords = normalizedTitle.toLowerCase().split(/\s+/)
          .filter((w: string) => w.length > 2 && !ignoreWords.includes(w));
        
        // Match group where the name contains the most unique words from the title
        const match = allGroups?.find(g => {
          const groupNameNormalized = g.name.replace(/\s+/g, " ").trim().toLowerCase();
          const groupWords = groupNameNormalized.split(/\s+/);
          
          const matchingWords = titleWords.filter((tw: string) => groupWords.includes(tw));
          // Need at least one unique word match (if title contains unique words)
          return matchingWords.length > 0 && matchingWords.length >= Math.ceil(titleWords.length / 2);
        });

        if (match) {
          data = match;
          console.log(`Fuzzy match found: "${match.name}"`);
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

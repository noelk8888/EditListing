import { NextResponse } from "next/server";
import { sendTelegramNotification } from "@/lib/telegram";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, groups, summary, geoId, photoLink } = body;

    if (!message && !summary) {
      return NextResponse.json({ error: "Message or summary is required" }, { status: 400 });
    }

    console.log("=== SEND ONLY TELEGRAM ===");
    console.log("Message:", message);
    console.log("Groups:", groups);
    if (geoId) console.log("GeoId:", geoId);
    if (photoLink) console.log("PhotoLink:", photoLink);

    // Send the Telegram notification
    const selectedGroups: string[] | undefined = Array.isArray(groups) ? groups : undefined;

    let sentMessageIds: Record<string, number> | undefined = undefined;
    // 1. Send the listing summary if provided
    if (summary && geoId) {
      const mainWithId = summary.startsWith(geoId) ? summary : `${geoId}\n${summary}`;
      sentMessageIds = await sendTelegramNotification(mainWithId, selectedGroups, photoLink);
    }

    // 2. Send the custom message if provided
    if (message) {
      await sendTelegramNotification(message, selectedGroups, null, sentMessageIds);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("send-telegram-only API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send Telegram message" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { sendTelegramNotification } from "@/lib/telegram";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, groups } = body;

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    console.log("=== SEND ONLY TELEGRAM ===");
    console.log("Message:", message);
    console.log("Groups:", groups);

    // Send the Telegram notification
    const selectedGroups: string[] | undefined = Array.isArray(groups) ? groups : undefined;
    await sendTelegramNotification(message, selectedGroups);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("send-telegram-only API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send Telegram message" },
      { status: 500 }
    );
  }
}

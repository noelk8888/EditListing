import { NextResponse } from "next/server";
import { sendTelegramNotification } from "@/lib/telegram";

export async function GET() {
    const results: any = {
        env: {
            hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
            hasFallbackChatId: !!process.env.TELEGRAM_CHAT_ID,
            groups: {
                RESIDENTIAL: !!process.env.TELEGRAM_CHAT_RESIDENTIAL,
                COMMERCIAL: !!process.env.TELEGRAM_CHAT_COMMERCIAL,
                INDUSTRIAL: !!process.env.TELEGRAM_CHAT_INDUSTRIAL,
                AGRICULTURAL: !!process.env.TELEGRAM_CHAT_AGRICULTURAL,
                UPDATE_LISTING: !!process.env.TELEGRAM_CHAT_UPDATE_LISTING,
            }
        },
        testSend: null,
        error: null
    };

    try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
            results.error = "TELEGRAM_BOT_TOKEN is missing";
        } else {
            // Test the token with getMe
            const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
            results.botMe = await meRes.json();

            if (meRes.ok) {
                // Try a test notification to the fallback group
                await sendTelegramNotification("🛠️ Telegram Debug: Diagnostic test message.");
                results.testSend = "Check your Telegram group for the debug message.";
            }
        }
    } catch (err) {
        results.error = err instanceof Error ? err.message : String(err);
    }

    return NextResponse.json(results);
}

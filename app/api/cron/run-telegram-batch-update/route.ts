import { NextResponse } from "next/server";
import { requireTrustedInternalRequest } from "@/lib/internal-request-auth";
import { startAutomaticTelegramBatchRun } from "@/lib/telegram-batch-auto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    requireTrustedInternalRequest(request);
    const result = await startAutomaticTelegramBatchRun();
    return NextResponse.json(result, { status: result.started ? 202 : 200 });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Automatic Batch Lite start failed";
    if (message.startsWith("A Batch Update is already running")) {
      return NextResponse.json({ started: false, skipped: true, reason: message });
    }
    console.error("Automatic Batch Lite cron failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


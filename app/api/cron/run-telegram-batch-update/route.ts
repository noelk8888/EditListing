import { NextResponse } from "next/server";
import { requireTrustedInternalRequest } from "@/lib/internal-request-auth";
import {
  isAutomaticBatchLockConflict,
  queueAutomaticTelegramBatchStartRetry,
  startAutomaticTelegramBatchRun,
} from "@/lib/telegram-batch-auto";
import { getManilaAutomaticBatchCutoff } from "@/lib/telegram-batch-schedule";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const deadlineAt = getManilaAutomaticBatchCutoff();
  try {
    requireTrustedInternalRequest(request);
    const result = await startAutomaticTelegramBatchRun({ deadlineAt });
    return NextResponse.json(result, { status: result.started ? 202 : 200 });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Automatic Batch Lite start failed";
    if (isAutomaticBatchLockConflict(error)) {
      const retry = await queueAutomaticTelegramBatchStartRetry(deadlineAt);
      return NextResponse.json({
        started: false,
        deferred: true,
        retryQueued: true,
        scheduledAt: retry.scheduledAt,
        deadlineAt: retry.deadlineAt,
        reason: message,
      }, { status: 202 });
    }
    console.error("Automatic Batch Lite cron failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

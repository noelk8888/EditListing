import { handleCallback } from "@vercel/queue";
import {
  AutoBatchStartPayload,
  isAutomaticBatchLockConflict,
  startAutomaticTelegramBatchRun,
} from "@/lib/telegram-batch-auto";
import { hasAutomaticBatchDeadlinePassed } from "@/lib/telegram-batch-schedule";

export const runtime = "nodejs";

const queueCallback = handleCallback<AutoBatchStartPayload>(
  async (payload) => {
    if (hasAutomaticBatchDeadlinePassed(payload.deadlineAt)) {
      console.warn(
        `Automatic Batch Lite scheduled for ${payload.scheduledAt} reached its same-day cutoff`
      );
      return;
    }
    try {
      await startAutomaticTelegramBatchRun({ deadlineAt: payload.deadlineAt });
    } catch (error) {
      if (isAutomaticBatchLockConflict(error)) {
        console.warn(
          `Automatic Batch Lite scheduled for ${payload.scheduledAt} is waiting for the active run lock`
        );
      }
      throw error;
    }
  },
  {
    visibilityTimeoutSeconds: 5 * 60,
    retry: (_error, metadata) => ({
      afterSeconds: Math.min(15 * 60, 5 * 60 * Math.max(1, metadata.deliveryCount)),
    }),
  }
);

export async function POST(request: Request) {
  return queueCallback(request);
}

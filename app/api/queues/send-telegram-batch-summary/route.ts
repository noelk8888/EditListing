import { handleCallback } from "@vercel/queue";
import type { AutoBatchSummaryPayload } from "@/lib/telegram-batch-auto";
import { sendAutomaticBatchSummaryToTelegram } from "@/lib/telegram-batch-summary";

export const runtime = "nodejs";

const queueCallback = handleCallback<AutoBatchSummaryPayload>(
  async (payload) => {
    await sendAutomaticBatchSummaryToTelegram(payload);
  },
  {
    visibilityTimeoutSeconds: 5 * 60,
    retry: (_error, metadata) => ({
      afterSeconds: Math.min(15 * 60, 60 * Math.max(1, metadata.deliveryCount)),
    }),
  }
);

export async function POST(request: Request) {
  return queueCallback(request);
}

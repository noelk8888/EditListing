import { handleCallback } from "@vercel/queue";
import {
  AutoBatchPayload,
  failAutomaticTelegramBatchRow,
  processAutomaticTelegramBatchRow,
} from "@/lib/telegram-batch-auto";

export const runtime = "nodejs";

const queueCallback = handleCallback<AutoBatchPayload>(
  async (payload, metadata) => {
    try {
      await processAutomaticTelegramBatchRow(payload);
    } catch (error) {
      if (metadata.deliveryCount < 5) throw error;
      await failAutomaticTelegramBatchRow(payload, error);
    }
  },
  {
    visibilityTimeoutSeconds: 15 * 60,
    retry: (_error, metadata) => ({
      afterSeconds: Math.min(5 * 60, 30 * metadata.deliveryCount),
    }),
  }
);

export async function POST(request: Request) {
  return queueCallback(request);
}


import { handleCallback } from "@vercel/queue";
import { processTelegramBatchPair } from "@/lib/telegram-pending-deletion";

export const runtime = "nodejs";

const queueCallback = handleCallback<{ chatId: string; listingMessageId: number }>(
  async (payload) => {
    await processTelegramBatchPair(payload);
  },
  {
    retry: (_error, metadata) => {
      if (metadata.deliveryCount >= 12) return { acknowledge: true };
      return { afterSeconds: Math.min(300, 15 * metadata.deliveryCount) };
    },
  }
);

export async function POST(request: Request) {
  return queueCallback(request);
}

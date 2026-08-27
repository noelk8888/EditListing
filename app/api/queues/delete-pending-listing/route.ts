import { handleCallback } from "@vercel/queue";
import { deleteScheduledPendingListing } from "@/lib/telegram-pending-deletion";

export const runtime = "nodejs";

const queueCallback = handleCallback<{ chatId: string; messageId: number }>(
  async (payload) => {
    await deleteScheduledPendingListing(payload);
  },
  {
    retry: (_error, metadata) => {
      // A missing permission or removed bot cannot be fixed by retrying forever.
      if (metadata.deliveryCount >= 5) return { acknowledge: true };
      return { afterSeconds: 60 };
    },
  }
);

export async function POST(request: Request) {
  return queueCallback(request);
}

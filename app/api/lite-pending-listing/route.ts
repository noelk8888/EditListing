import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@/lib/auth";

const PENDING_PREFIX = "telegram-lite-pending:";
const PROCESSING_LEASE_MS = 30 * 60 * 1000;

type PendingListing = {
  listing_text: string;
  detected_status: string | null;
  destination_chat_id: string;
  destination_listing_message_id: number;
  destination_update_message_id: number;
  created_at: string;
  state: "ready" | "processing" | "completed" | "manual";
  processing_started_at?: string;
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function processingLeaseExpired(value: PendingListing) {
  if (value.state !== "processing") return false;
  const startedAt = new Date(value.processing_started_at || "").getTime();
  return !Number.isFinite(startedAt) || Date.now() - startedAt >= PROCESSING_LEASE_MS;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await getSupabase()
    .from("app_settings")
    .select("key, value")
    .like("key", `${PENDING_PREFIX}%`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const item = (data || [])
    .map((row) => ({ key: row.key as string, value: row.value as PendingListing }))
    .filter((row) =>
      (row.value?.state === "ready" || processingLeaseExpired(row.value)) &&
      row.value?.listing_text?.trim()
    )
    .sort((a, b) => new Date(a.value.created_at).getTime() - new Date(b.value.created_at).getTime())[0];

  return NextResponse.json({ item: item || null });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key, action } = await req.json();
  if (typeof key !== "string" || !key.startsWith(PENDING_PREFIX)) {
    return NextResponse.json({ error: "Invalid pending listing" }, { status: 400 });
  }
  if (action !== "claim" && action !== "complete" && action !== "defer") {
    return NextResponse.json({ error: "Invalid pending listing action" }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.message || "Not found" }, { status: 404 });

  const value = data.value as PendingListing;
  if (action === "claim") {
    const canClaim = value.state === "ready" || processingLeaseExpired(value);
    if (!canClaim) {
      return NextResponse.json({ error: "This pair is already being processed" }, { status: 409 });
    }

    // JSON containment makes this a compare-and-set update: only one open
    // LITE tab can claim the pair, including when replacing an expired lease.
    const nextValue = { ...value, state: "processing" as const, processing_started_at: new Date().toISOString() };
    const expectedValue = value.state === "processing"
      ? { state: "processing", processing_started_at: value.processing_started_at }
      : { state: "ready" };
    const { data: claimed, error: claimError } = await getSupabase()
      .from("app_settings")
      .update({ value: nextValue })
      .eq("key", key)
      .contains("value", expectedValue)
      .select("key, value")
      .maybeSingle();
    if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });
    if (!claimed) return NextResponse.json({ error: "This pair was claimed in another LITE tab" }, { status: 409 });
    return NextResponse.json({ item: claimed });
  }

  if (value.state !== "processing") {
    return NextResponse.json({ error: "This pair is not currently being processed" }, { status: 409 });
  }

  if (action === "complete") {
    if (!value.destination_chat_id || !value.destination_listing_message_id || !value.destination_update_message_id) {
      return NextResponse.json({ error: "Pending listing is missing its Telegram message details" }, { status: 400 });
    }
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return NextResponse.json({ error: "Telegram bot is not configured" }, { status: 500 });

    for (const messageId of [value.destination_listing_message_id, value.destination_update_message_id]) {
    const reactionResponse = await fetch(`https://api.telegram.org/bot${token}/setMessageReaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: value.destination_chat_id,
        message_id: messageId,
        reaction: [{ type: "emoji", emoji: "👍" }],
      }),
    });
    const reactionResult = await reactionResponse.json();
    if (!reactionResponse.ok || !reactionResult.ok) {
      return NextResponse.json({ error: reactionResult.description || "Could not add Telegram acknowledgement" }, { status: 502 });
    }
    }
  }

  const nextState = action === "complete" ? "completed" : "manual";
  const { error: updateError } = await getSupabase()
    .from("app_settings")
    .update({ value: { ...value, state: nextState } })
    .eq("key", key);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

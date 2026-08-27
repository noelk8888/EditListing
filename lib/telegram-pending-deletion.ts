import { createClient } from "@supabase/supabase-js";
import { send } from "@vercel/queue";

const FORWARD_RECORD_PREFIX = "telegram-forward";
const DELETE_TOPIC = "pending-listing-delete";
const DELETE_DELAY_SECONDS = 15 * 60;
const PAIRING_WINDOW_MS = 5 * 60 * 1000;

type ForwardRecord = {
  source_chat_id: string;
  source_message_id: number;
  destination_chat_id: string;
  destination_message_id: number;
  forwarded_at: string;
  sender_id?: number;
  kind: "listing" | "update";
  partner_message_id?: number;
  deletion_status?: "scheduled" | "cancelled" | "deleted";
  deletion_requested_by?: number;
  deletion_requested_at?: string;
};

type SettingRow = { key: string; value: ForwardRecord };

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function recordKey(chatId: string, messageId: number) {
  return `${FORWARD_RECORD_PREFIX}:${chatId}:${messageId}`;
}

function isUpdateNotice(message: any) {
  const text = (message.text || message.caption || "").toUpperCase();
  return /\b(?:LISTING\s+)?UPDATE\b/.test(text);
}

async function saveRecord(record: ForwardRecord) {
  const { error } = await getSupabase().from("app_settings").upsert(
    { key: recordKey(record.destination_chat_id, record.destination_message_id), value: record },
    { onConflict: "key" }
  );

  if (error) throw new Error(`Could not save Telegram forward record: ${error.message}`);
}

async function loadRecord(chatId: string, messageId: number) {
  const { data, error } = await getSupabase()
    .from("app_settings")
    .select("key, value")
    .eq("key", recordKey(chatId, messageId))
    .maybeSingle();

  if (error) throw new Error(`Could not read Telegram forward record: ${error.message}`);
  return (data as SettingRow | null)?.value || null;
}

export async function recordForwardedListing(
  sourceMessage: any,
  sourceChatId: string,
  destinationChatId: string,
  destinationMessageId: number
) {
  const now = new Date();
  const record: ForwardRecord = {
    source_chat_id: sourceChatId,
    source_message_id: sourceMessage.message_id,
    destination_chat_id: destinationChatId,
    destination_message_id: destinationMessageId,
    forwarded_at: now.toISOString(),
    sender_id: sourceMessage.from?.id,
    kind: isUpdateNotice(sourceMessage) ? "update" : "listing",
  };

  // An update message is paired with the most recent unpaired listing from the
  // same source/sender. This reflects the two-message listing format used in
  // LISTING UPDATES while avoiding unrelated messages in PENDING LISTINGS.
  if (record.kind === "update") {
    const { data, error } = await getSupabase()
      .from("app_settings")
      .select("key, value")
      .like("key", `${FORWARD_RECORD_PREFIX}:${destinationChatId}:%`);

    if (error) throw new Error(`Could not find Telegram listing pair: ${error.message}`);

    const partner = ((data || []) as SettingRow[])
      .map((row) => row.value)
      .filter((candidate) =>
        candidate.source_chat_id === sourceChatId &&
        candidate.kind === "listing" &&
        !candidate.partner_message_id &&
        candidate.sender_id === record.sender_id &&
        now.getTime() - new Date(candidate.forwarded_at).getTime() <= PAIRING_WINDOW_MS
      )
      .sort((a, b) => new Date(b.forwarded_at).getTime() - new Date(a.forwarded_at).getTime())[0];

    if (partner) {
      record.partner_message_id = partner.destination_message_id;
      partner.partner_message_id = record.destination_message_id;
      await saveRecord(partner);
    }
  }

  await saveRecord(record);
  console.log(`Recorded forwarded listing ${destinationMessageId}${record.partner_message_id ? ` paired with ${record.partner_message_id}` : ""}.`);
}

async function isChatOwner(chatId: string, userId: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  const response = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, user_id: userId }),
  });
  const result = await response.json();
  return Boolean(response.ok && result.ok && result.result?.status === "creator");
}

function includesThumbsUp(reactions: any[]) {
  return reactions?.some((reaction) => reaction.type === "emoji" && reaction.emoji === "👍");
}

export async function handlePendingListingReaction(reaction: any) {
  const destinationChatId = process.env.TELEGRAM_FORWARD_DESTINATION_CHAT_ID;
  const chatId = reaction.chat?.id?.toString();
  const userId = reaction.user?.id;
  const messageId = reaction.message_id;

  if (!destinationChatId || chatId !== destinationChatId || !userId || !messageId) return;
  if (!(await isChatOwner(chatId, userId))) return;

  const hadThumbsUp = includesThumbsUp(reaction.old_reaction || []);
  const hasThumbsUp = includesThumbsUp(reaction.new_reaction || []);
  if (hadThumbsUp === hasThumbsUp) return;

  const record = await loadRecord(chatId, messageId);
  if (!record) {
    console.log(`Ignoring reaction for untracked PENDING LISTINGS message ${messageId}.`);
    return;
  }

  if (!hasThumbsUp) {
    record.deletion_status = "cancelled";
    await saveRecord(record);
    if (record.partner_message_id) {
      const partner = await loadRecord(chatId, record.partner_message_id);
      if (partner) {
        partner.deletion_status = "cancelled";
        await saveRecord(partner);
      }
    }
    console.log(`Cancelled deletion for PENDING LISTINGS message ${messageId}.`);
    return;
  }

  const requestedAt = new Date().toISOString();
  record.deletion_status = "scheduled";
  record.deletion_requested_by = userId;
  record.deletion_requested_at = requestedAt;
  await saveRecord(record);
  if (record.partner_message_id) {
    const partner = await loadRecord(chatId, record.partner_message_id);
    if (partner) {
      partner.deletion_status = "scheduled";
      partner.deletion_requested_by = userId;
      partner.deletion_requested_at = requestedAt;
      await saveRecord(partner);
    }
  }

  await send(
    DELETE_TOPIC,
    { chatId, messageId },
    {
      delaySeconds: DELETE_DELAY_SECONDS,
      retentionSeconds: 60 * 60,
      idempotencyKey: `pending-listing-delete:${chatId}:${messageId}:${requestedAt}`,
    }
  );
  console.log(`Scheduled deletion for PENDING LISTINGS message ${messageId}.`);
}

export async function deleteScheduledPendingListing(payload: { chatId: string; messageId: number }) {
  const record = await loadRecord(payload.chatId, payload.messageId);
  if (!record || record.deletion_status !== "scheduled") return;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  const messageIds = [record.destination_message_id];
  if (record.partner_message_id) messageIds.push(record.partner_message_id);

  const response = await fetch(`https://api.telegram.org/bot${token}/deleteMessages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: payload.chatId, message_ids: Array.from(new Set(messageIds)) }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(`Telegram deleteMessages error: ${result.description || response.statusText}`);
  }

  for (const messageId of messageIds) {
    const saved = await loadRecord(payload.chatId, messageId);
    if (saved) {
      saved.deletion_status = "deleted";
      await saveRecord(saved);
    }
  }
  console.log(`Deleted PENDING LISTINGS message pair: ${messageIds.join(", ")}.`);
}

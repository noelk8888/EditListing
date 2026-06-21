import { fetchTelegramChatIds, supabase } from "./supabase";
import { google } from "googleapis";
import { getAuth } from "./google-sheets";
import sharp from "sharp";
import path from "path";
import fs from "fs";

// Map group label → env var name
const GROUP_ENV_MAP: Record<string, string> = {
  "DIRECT": "TELEGRAM_CHAT_DIRECT",
  "RESIDENTIAL": "TELEGRAM_CHAT_RESIDENTIAL",
  "COMMERCIAL": "TELEGRAM_CHAT_COMMERCIAL",
  "INDUSTRIAL": "TELEGRAM_CHAT_INDUSTRIAL",
  "COM 'L / IND'L": "TELEGRAM_CHAT_COMMERCIAL",
  "AGRICULTURAL": "TELEGRAM_CHAT_AGRICULTURAL",
  "BUSINESS FOR SALE": "TELEGRAM_CHAT_BUSINESS_FOR_SALE",
  "UPDATE LISTING": "TELEGRAM_CHAT_UPDATE_LISTING",
  "TEST OPTION": "TELEGRAM_CHAT_TEST_POSTING",
  "TEST": "TELEGRAM_CHAT_TEST_POSTING",
};

async function getFirstGoogleDriveImageUrl(photoLink: string): Promise<string | null> {
  if (!photoLink) return null;
  // Use the first link in case of comma-separated or space-separated inputs
  const linkStr = String(photoLink).split(/[\s,]+/)[0].trim();
  
  try {
    // 1. Try to match Google Photos links (e.g. photos.app.goo.gl or photos.google.com)
    if (linkStr.includes("photos.app.goo.gl") || linkStr.includes("photos.google.com")) {
      console.log(`[Telegram Photo Resolver] Google Photos link detected: ${linkStr}`);
      const res = await fetch(linkStr, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36"
        }
      });
      const html = await res.text();
      const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                           html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
      if (ogImageMatch) {
        let ogImageUrl = ogImageMatch[1];
        if (ogImageUrl.includes("=")) {
          ogImageUrl = ogImageUrl.split("=")[0] + "=s1600";
        }
        console.log(`[Telegram Photo Resolver] Resolved Google Photos image: ${ogImageUrl}`);
        return ogImageUrl;
      }
      console.warn(`[Telegram Photo Resolver] Could not find og:image in Google Photos page: ${linkStr}`);
    }

    // 2. Try to match Google Drive folder ID
    const folderMatch = linkStr.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) {
      const folderId = folderMatch[1];
      console.log(`[Telegram Photo Resolver] Folder ID detected: ${folderId}`);
      const auth = getAuth();
      const drive = google.drive({ version: "v3", auth });
      
      const res = await drive.files.list({
        q: `'${folderId}' in parents and mimeType startswith 'image/' and trashed = false`,
        orderBy: "name",
        fields: "files(id, name)",
        pageSize: 1,
      });
      
      const files = res.data.files || [];
      console.log(`[Telegram Photo Resolver] Found ${files.length} images in folder ${folderId}`);
      if (files.length > 0 && files[0].id) {
        const fileId = files[0].id;
        console.log(`[Telegram Photo Resolver] Selected first image: ${files[0].name} (${fileId})`);
        return `https://drive.google.com/uc?export=view&id=${fileId}`;
      }
    }
    
    // 3. Try to match Google Drive file ID directly
    const fileMatch = linkStr.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || linkStr.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileMatch) {
      const fileId = fileMatch[1];
      console.log(`[Telegram Photo Resolver] Direct file ID detected: ${fileId}`);
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }

    // 4. Fallback for non-Drive direct image URLs
    if (/^https?:\/\//i.test(linkStr)) {
      if (/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(linkStr) || linkStr.includes("lh3.googleusercontent.com") || linkStr.includes("googleusercontent.com")) {
        console.log(`[Telegram Photo Resolver] Using direct image URL: ${linkStr}`);
        return linkStr;
      }
    }
  } catch (err) {
    console.error("[Telegram Photo Resolver] Error resolving image URL:", err);
  }
  
  return null;
}

/**
 * Fetches an image from a URL and composites the LUXE Realty logo as a
 * semi-transparent watermark on the bottom-right corner.
 * Returns a JPEG buffer, or null if anything fails.
 */
async function applyLuxeWatermark(imageUrl: string): Promise<Buffer | null> {
  try {
    // Fetch the source image
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    if (!response.ok) {
      console.warn(`[Watermark] Failed to fetch image: ${response.status}`);
      return null;
    }
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // Get source image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const imgW = metadata.width || 1200;
    const imgH = metadata.height || 800;

    // Load LUXE logo from public directory
    const logoPath = path.join(process.cwd(), "public", "luxe-logo.png");
    if (!fs.existsSync(logoPath)) {
      console.warn("[Watermark] LUXE logo not found, sending without watermark.");
      return null;
    }

    // Resize logo to ~15% of image width (min 80px, max 195px) — 25% smaller than original 20%
    const logoWidth = Math.min(195, Math.max(80, Math.round(imgW * 0.15)));

    // Resize logo and apply 70% opacity (0.7 alpha)
    const logoResized = await sharp(logoPath)
      .resize(logoWidth)
      .ensureAlpha()
      .linear([1, 1, 1, 0.7], [0, 0, 0, 0])
      .toBuffer();

    // Composite watermark onto source image at top-right with padding
    const padding = Math.round(imgW * 0.025); // 2.5% padding
    const left = imgW - logoWidth - padding;
    const top = padding;

    const watermarked = await sharp(imageBuffer)
      .composite([{
        input: logoResized,
        left: Math.max(0, left),
        top: Math.max(0, top),
        blend: "over"
      }])
      .jpeg({ quality: 88 })
      .toBuffer();

    console.log(`[Watermark] Applied LUXE logo watermark (${logoWidth}px wide, 70% opacity) to ${imgW}×${imgH} image`);
    return watermarked;
  } catch (err) {
    console.error("[Watermark] Error applying watermark:", err);
    return null;
  }
}

/**
 * Sends a photo buffer to Telegram using multipart/form-data upload.
 * Falls back to URL-based send if buffer is null.
 */
async function sendTelegramPhoto(
  token: string,
  chatId: string,
  photoBuffer: Buffer | null,
  fallbackUrl: string,
  caption?: string
): Promise<number | undefined> {
  // Try buffer upload first (watermarked)
  if (photoBuffer) {
    try {
      const formData = new FormData();
      formData.append("chat_id", chatId);
      formData.append(
        "photo",
        new Blob([photoBuffer as any], { type: "image/jpeg" }),
        "listing.jpg"
      );
      if (caption) {
        formData.append("caption", caption);
      }

      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`[Telegram Photo Upload] Successfully sent watermarked photo to chat ${chatId}`);
        return data.result?.message_id;
      } else {
        const err = await res.text();
        console.error(`[Telegram Photo Upload] Buffer upload failed for chat ${chatId}:`, err);
      }
    } catch (err) {
      console.error(`[Telegram Photo Upload] Exception for chat ${chatId}:`, err);
    }
  }

  // Fallback: send by URL (no watermark)
  console.log(`[Telegram Photo URL] Falling back to URL send for chat ${chatId}`);
  try {
    const payload: Record<string, unknown> = { chat_id: chatId, photo: fallbackUrl };
    if (caption) payload.caption = caption;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return data.result?.message_id;
    } else {
      const err = await res.text();
      console.error(`[Telegram Photo URL] Error for chat ${chatId}:`, err);
    }
  } catch (err) {
    console.error(`[Telegram Photo URL] Exception for chat ${chatId}:`, err);
  }

  return undefined;
}

export interface TelegramMessageObj {
  line1: string;
  line2: string;
  line3: string;
  line4: string;
  notes: string;
}

function getMajorGroup(groupName: string): number {
  const gName = groupName.trim();
  if (gName === "UPDATE LISTING" || gName === "TEST") {
    return 1;
  }
  if (gName === "DIRECT" || gName === "RESIDENTIAL" || gName === "COM 'L / IND'L" || gName === "AGRICULTURAL") {
    return 2;
  }
  return 3;
}

function formatTelegramMessageObj(msg: TelegramMessageObj, majorGroup: number): string | null {
  if (majorGroup === 3) {
    return null;
  }
  if (majorGroup === 1) {
    const headerLines = [
      msg.line1,
      msg.line2,
      msg.line3,
      msg.line4,
    ].filter(Boolean);
    return headerLines.join("\n");
  }
  if (majorGroup === 2) {
    const headerLines = [
      msg.line3,
      msg.line4,
    ].filter(Boolean);
    const trimmedNotes = (msg.notes || "").trim();
    return trimmedNotes
      ? `${headerLines.join("\n")}\n\n${trimmedNotes}`
      : headerLines.join("\n");
  }
  return null;
}

export async function sendTelegramNotification(
  message: string | TelegramMessageObj,
  groups?: string[],  // e.g. ["RESIDENTIAL", "COMMERCIAL"]
  photoLink?: string | null,
  replyToMessageIds?: Record<string, number> | null
): Promise<Record<string, number>> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("⚠️ Telegram notification skipped: TELEGRAM_BOT_TOKEN is missing.");
    return {};
  }

  const chatIdToGroup: Record<string, string> = {};
  let chatIds: string[] = [];

  if (groups && groups.length > 0) {
    console.log("Resolving Telegram groups for dynamic routing:", groups);
    
    const dbLookupGroups: string[] = [];

    // 1. First check ENV vars for legacy groups
    for (const g of groups) {
      const envKey = GROUP_ENV_MAP[g];
      const id = envKey ? process.env[envKey] : undefined;
      if (id) {
        const cid = id.trim();
        chatIds.push(cid);
        chatIdToGroup[cid] = g;
      } else {
        dbLookupGroups.push(g);
      }
    }

    // 2. Fetch remaining from Supabase to preserve group name mappings
    if (dbLookupGroups.length > 0) {
      try {
        const { data, error } = await supabase
          .from('luxe_telegram_groups')
          .select('name, chat_id')
          .in('name', dbLookupGroups)
          .not('chat_id', 'is', null)
          .not('chat_id', 'eq', '');
        
        if (error) {
          console.error("Error fetching chat IDs from Supabase:", error);
        } else if (data) {
          for (const row of data) {
            if (row.chat_id) {
              const cid = row.chat_id.trim();
              chatIds.push(cid);
              chatIdToGroup[cid] = row.name;
            }
          }
        }
      } catch (err) {
        console.error("Supabase query exception:", err);
      }
    }
  }

  // Only fall back to UPDATE LISTING if no groups were explicitly selected
  if (!groups || groups.length === 0) {
    const updateListingId = process.env.TELEGRAM_CHAT_UPDATE_LISTING;
    if (updateListingId) {
      const cid = updateListingId.trim();
      chatIds = [cid];
      chatIdToGroup[cid] = "UPDATE LISTING";
    }
  }

  if (chatIds.length === 0) {
    console.warn("⚠️ Telegram notification skipped: No chat IDs resolved.");
    return {};
  }

  // Deduplicate chat IDs
  chatIds = Array.from(new Set(chatIds));

  console.log(`Sending Telegram notification to ${chatIds.length} chat(s):`, chatIds);

  // Resolve photo URL first if photoLink is provided
  let resolvedPhotoUrl: string | null = null;
  if (photoLink) {
    resolvedPhotoUrl = await getFirstGoogleDriveImageUrl(photoLink);
  }

  // Apply LUXE watermark to the resolved photo (done once, reused for all chats)
  let watermarkedPhotoBuffer: Buffer | null = null;
  if (resolvedPhotoUrl) {
    console.log("[Watermark] Applying LUXE logo watermark to photo...");
    watermarkedPhotoBuffer = await applyLuxeWatermark(resolvedPhotoUrl);
  }

  const sentMessageIds: Record<string, number> = {};

  for (const chatId of chatIds) {
    // Determine the text to send for this specific chat
    let textToSend: string | null = null;
    if (typeof message === "string") {
      textToSend = message;
    } else if (message && typeof message === "object") {
      const groupName = chatIdToGroup[chatId] || "";
      const majorGroup = getMajorGroup(groupName);
      textToSend = formatTelegramMessageObj(message, majorGroup);
    }

    if (textToSend === null) {
      console.log(`[Telegram API] Skipping TEXT 2 (metadata block) for chat ${chatId} (Group category 3)`);
      continue;
    }

    // Telegram max message length is 4096 chars
    const truncated = textToSend.length > 4000 ? textToSend.slice(0, 4000) + "\n...[truncated]" : textToSend;

    let firstMessageId: number | undefined = undefined;
    let photoSentCombined = false;

    // 1. Check if we can combine photo and text as caption (only for TEXT 1 string messages)
    const isText1 = typeof message === "string";
    if (isText1 && resolvedPhotoUrl && truncated.length <= 1024) {
      console.log(`[Telegram Photo Caption] Sending watermarked photo with caption to chat ${chatId}`);
      const msgId = await sendTelegramPhoto(token, chatId, watermarkedPhotoBuffer, resolvedPhotoUrl, truncated);
      if (msgId) {
        firstMessageId = msgId;
        photoSentCombined = true;
      }
    }

    // 2. If not combined, send photo first then text message
    if (!photoSentCombined) {
      if (resolvedPhotoUrl) {
        console.log(`[Telegram Photo] Sending watermarked photo to chat ${chatId}`);
        const msgId = await sendTelegramPhoto(token, chatId, watermarkedPhotoBuffer, resolvedPhotoUrl);
        if (msgId) {
          firstMessageId = msgId;
        }
      }

      // Send the text message second
      try {
        const payload: any = {
          chat_id: chatId,
          text: truncated,
          disable_web_page_preview: true,
        };

        if (replyToMessageIds && replyToMessageIds[chatId]) {
          payload.reply_to_message_id = replyToMessageIds[chatId];
        }

        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.text();
          console.error(`Telegram sendMessage error for chat ${chatId}:`, err);
        } else {
          console.log(`[Telegram Message API] Successfully sent text message to chat ${chatId}`);
          const data = await res.json();
          const msgId = data.result?.message_id;
          if (!firstMessageId && msgId) {
            firstMessageId = msgId;
          }
        }
      } catch (error) {
        console.error(`Telegram sendMessage error for chat ${chatId}:`, error);
      }
    }

    if (firstMessageId) {
      sentMessageIds[chatId] = firstMessageId;
    }
  }

  return sentMessageIds;
}


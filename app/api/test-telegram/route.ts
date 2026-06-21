import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import sharp from "sharp";

export async function GET() {
  const diagnostics: Record<string, any> = {};

  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = "-5123274541"; // Test chat ID

    diagnostics.tokenExists = !!token;
    diagnostics.chatId = chatId;

    // Load logo
    const logoPath = path.join(process.cwd(), "public", "luxe-logo.png");
    if (!fs.existsSync(logoPath)) {
      return NextResponse.json({ error: "Logo not found at " + logoPath });
    }

    const sampleUrl = "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1200&q=80";
    const response = await fetch(sampleUrl);
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch sample image: " + response.status });
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const imgMeta = await sharp(imageBuffer).metadata();
    const logoWidth = Math.min(195, Math.max(80, Math.round((imgMeta.width || 1200) * 0.15)));

    const logoResized = await sharp(logoPath)
      .resize(logoWidth)
      .ensureAlpha()
      .linear([1, 1, 1, 0.7], [0, 0, 0, 0])
      .toBuffer();

    const padding = Math.round((imgMeta.width || 1200) * 0.025);
    const left = (imgMeta.width || 1200) - logoWidth - padding;
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

    diagnostics.watermarkedLength = watermarked.length;

    // Now attempt Telegram upload
    try {
      const formData = new FormData();
      formData.append("chat_id", chatId);
      formData.append(
        "photo",
        new Blob([watermarked as any], { type: "image/jpeg" }),
        "listing.jpg"
      );
      formData.append("caption", "Diagnostics post - testing watermark upload on Vercel");

      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        body: formData,
      });

      diagnostics.telegramStatus = res.status;
      diagnostics.telegramStatusText = res.statusText;

      const resText = await res.text();
      diagnostics.telegramResponse = resText;

      try {
        diagnostics.telegramResponseJson = JSON.parse(resText);
      } catch (e) {}

    } catch (tgErr: any) {
      diagnostics.telegramUploadException = tgErr.message;
      diagnostics.telegramUploadStack = tgErr.stack;
    }

  } catch (err: any) {
    diagnostics.outerException = err.message;
    diagnostics.outerStack = err.stack;
  }

  return NextResponse.json(diagnostics);
}

import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import sharp from "sharp";

export async function GET() {
  const diagnostics: Record<string, any> = {};

  try {
    diagnostics.cwd = process.cwd();
    diagnostics.dirname = __dirname;

    // Check logo path options
    const pathOptions = [
      path.join(process.cwd(), "public", "luxe-logo.png"),
      path.join(process.cwd(), "luxe-logo.png"),
      path.join(process.cwd(), ".next", "server", "public", "luxe-logo.png"),
      path.join(__dirname, "..", "..", "..", "public", "luxe-logo.png"),
      path.join(__dirname, "..", "..", "..", "..", "public", "luxe-logo.png"),
    ];

    diagnostics.pathsChecked = pathOptions.map(p => ({
      path: p,
      exists: fs.existsSync(p)
    }));

    // Find any existing logo path
    const logoPath = pathOptions.find(p => fs.existsSync(p));
    diagnostics.resolvedLogoPath = logoPath || null;

    if (logoPath) {
      const stats = fs.statSync(logoPath);
      diagnostics.logoSize = stats.size;

      // Try running sharp on it
      try {
        const metadata = await sharp(logoPath).metadata();
        diagnostics.sharpLogoMetadata = metadata;
      } catch (sharpErr: any) {
        diagnostics.sharpLogoError = sharpErr.message;
      }
    }

    // Try watermarking a sample image
    const sampleUrl = "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1200&q=80";
    try {
      const response = await fetch(sampleUrl);
      if (!response.ok) {
        diagnostics.sampleFetchStatus = response.status;
      } else {
        const imageBuffer = Buffer.from(await response.arrayBuffer());
        diagnostics.sampleImageSize = imageBuffer.length;

        const imgMeta = await sharp(imageBuffer).metadata();
        diagnostics.sampleImageMeta = imgMeta;

        if (logoPath) {
          const logoWidth = Math.min(195, Math.max(80, Math.round((imgMeta.width || 1200) * 0.15)));
          
          const logoResized = await sharp(logoPath)
            .resize(logoWidth)
            .ensureAlpha()
            .linear([1, 1, 1, 0.7], [0, 0, 0, 0])
            .toBuffer();

          diagnostics.resizedLogoSize = logoResized.length;

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

          diagnostics.watermarkSuccess = true;
          diagnostics.watermarkedSize = watermarked.length;
        } else {
          diagnostics.watermarkSuccess = false;
          diagnostics.watermarkError = "No logo found to apply";
        }
      }
    } catch (wmErr: any) {
      diagnostics.watermarkException = wmErr.message;
      diagnostics.watermarkStack = wmErr.stack;
    }

  } catch (err: any) {
    diagnostics.outerException = err.message;
    diagnostics.outerStack = err.stack;
  }

  return NextResponse.json(diagnostics);
}

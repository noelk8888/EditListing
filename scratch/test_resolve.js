const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const linkStr = 'https://photos.app.goo.gl/ZVu4EMZiPJkZnrXq6';

async function getFirstGoogleDriveImageUrl(photoLink) {
  if (!photoLink) return null;
  const linkStr = String(photoLink).split(/[\s,]+/)[0].trim();
  
  try {
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
      // Let's write the HTML to scratch to see what's in there
      fs.writeFileSync('/Users/noelk/repos/LUXE Edit/luxe-listings/scratch/google_photos.html', html);
    }
  } catch (err) {
    console.error("[Telegram Photo Resolver] Error resolving image URL:", err);
  }
  return null;
}

async function test() {
  const url = await getFirstGoogleDriveImageUrl(linkStr);
  console.log("Resolved URL:", url);
}

test();

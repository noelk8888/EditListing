import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { purgeExpiredTelegramRecords } from "@/lib/telegram-record-cleanup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = Boolean(
    cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`
  );
  if (isCron) return true;

  const session = await auth();
  return session?.user?.role === "SUPERADMIN";
}

async function cleanup(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await purgeExpiredTelegramRecords();
    console.info(
      `[Telegram cleanup] scanned=${result.scanned} deleted=${result.deleted} retained=${result.retained} cutoff=${result.cutoff}`
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Telegram record cleanup failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Telegram cleanup failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return cleanup(request);
}

export async function POST(request: Request) {
  return cleanup(request);
}

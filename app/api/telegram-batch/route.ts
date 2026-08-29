import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  claimTelegramBatchRow,
  claimTelegramBatchRun,
  getTelegramBatchCapture,
  listTelegramBatchRows,
  refreshTelegramBatchRun,
  releaseTelegramBatchRun,
  setTelegramBatchCapture,
  setTelegramBatchRowStatus,
} from "@/lib/telegram-batch-queue";

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Response("Unauthorized", { status: 401 });
  if (session.user.role !== "SUPERADMIN") throw new Response("Forbidden", { status: 403 });
  return session.user.email.toLowerCase();
}

export async function GET() {
  try {
    await requireSuperAdmin();
    const [capture, rows] = await Promise.all([
      getTelegramBatchCapture(),
      listTelegramBatchRows(),
    ]);
    return NextResponse.json({ capture, pendingCount: rows.length });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not read Telegram batch state" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const email = await requireSuperAdmin();
    const body = await request.json();
    const action = String(body?.action || "");

    if (action === "start_capture" || action === "stop_capture") {
      const capture = await setTelegramBatchCapture(action === "start_capture", email);
      return NextResponse.json({ capture });
    }

    if (action === "start_run") {
      const lock = await claimTelegramBatchRun(email);
      try {
        const rows = await listTelegramBatchRows();
        if (!rows.length) {
          await releaseTelegramBatchRun(lock.token);
          return NextResponse.json({ error: "There are no pending Telegram batch rows" }, { status: 409 });
        }
        return NextResponse.json({ lockToken: lock.token, rows });
      } catch (error) {
        await releaseTelegramBatchRun(lock.token).catch(() => undefined);
        throw error;
      }
    }

    if (action === "claim_row") {
      if (!body.pairId || !body.lockToken) return NextResponse.json({ error: "pairId and lockToken are required" }, { status: 400 });
      await refreshTelegramBatchRun(String(body.lockToken));
      return NextResponse.json(await claimTelegramBatchRow(String(body.pairId)));
    }

    if (action === "mark_updated" || action === "mark_manual" || action === "release_row") {
      if (!body.pairId || !body.lockToken) return NextResponse.json({ error: "pairId and lockToken are required" }, { status: 400 });
      await refreshTelegramBatchRun(String(body.lockToken));
      const status = action === "mark_updated" ? "UPDATED" : action === "mark_manual" ? "FOR MANUAL CHECKING" : "";
      await setTelegramBatchRowStatus(String(body.pairId), status, action === "mark_updated" ? String(body.geoId || "") : undefined);
      return NextResponse.json({ ok: true });
    }

    if (action === "finish_run") {
      if (!body.lockToken) return NextResponse.json({ error: "lockToken is required" }, { status: 400 });
      await refreshTelegramBatchRun(String(body.lockToken));
      await releaseTelegramBatchRun(String(body.lockToken));
      return NextResponse.json({ ok: true, updatedRowsRetained: true });
    }

    if (action === "exit_run") {
      if (!body.lockToken) return NextResponse.json({ error: "lockToken is required" }, { status: 400 });
      await refreshTelegramBatchRun(String(body.lockToken));
      if (body.pairId) await setTelegramBatchRowStatus(String(body.pairId), "").catch(() => undefined);
      await releaseTelegramBatchRun(String(body.lockToken));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid Telegram batch action" }, { status: 400 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Telegram batch operation failed" }, { status: 500 });
  }
}

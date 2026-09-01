import { timingSafeEqual } from "node:crypto";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Allow Vercel Cron and trusted internal workers to reuse authenticated APIs. */
export function isTrustedInternalRequest(request: Request) {
  const secret = process.env.CRON_SECRET || "";
  const authorization = request.headers.get("authorization") || "";
  return Boolean(secret && safeEqual(authorization, `Bearer ${secret}`));
}

export function requireTrustedInternalRequest(request: Request) {
  if (!isTrustedInternalRequest(request)) throw new Response("Unauthorized", { status: 401 });
}


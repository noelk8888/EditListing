import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@/lib/auth";

const PENDING_PREFIX = "telegram-lite-pending:";

type PendingListing = {
  listing_text: string;
  detected_status: string | null;
  created_at: string;
  state: "ready" | "loaded";
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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
    .filter((row) => row.value?.state === "ready" && row.value?.listing_text?.trim())
    .sort((a, b) => new Date(a.value.created_at).getTime() - new Date(b.value.created_at).getTime())[0];

  return NextResponse.json({ item: item || null });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key } = await req.json();
  if (typeof key !== "string" || !key.startsWith(PENDING_PREFIX)) {
    return NextResponse.json({ error: "Invalid pending listing" }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.message || "Not found" }, { status: 404 });

  const value = data.value as PendingListing;
  const { error: updateError } = await getSupabase()
    .from("app_settings")
    .update({ value: { ...value, state: "loaded" } })
    .eq("key", key);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

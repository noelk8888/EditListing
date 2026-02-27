import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deleteListing } from "@/lib/google-sheets";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TABLE_NAME = "KIU Properties";

export async function POST(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "GEO ID is required" }, { status: 400 });
    }

    console.log("=== DELETING LISTING ===", id);

    // Delete from GSheet
    const gsheetDeleted = await deleteListing(id);
    console.log(gsheetDeleted ? `✅ GSheet row deleted for ${id}` : `⚠️ ${id} not found in GSheet`);

    // Delete from Supabase
    const { error, count } = await supabase
      .from(TABLE_NAME)
      .delete({ count: "exact" })
      .eq("GEO ID", id);

    if (error) {
      console.error("Supabase delete error:", error);
      return NextResponse.json({ error: `Supabase delete failed: ${error.message}` }, { status: 500 });
    }

    console.log(`✅ Supabase deleted ${count} row(s) for ${id}`);

    return NextResponse.json({
      success: true,
      gsheetDeleted,
      supabaseDeleted: (count ?? 0) > 0,
    });
  } catch (err) {
    console.error("Delete error:", err);
    return NextResponse.json(
      { error: "Delete failed", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

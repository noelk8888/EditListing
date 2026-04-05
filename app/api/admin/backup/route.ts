import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSpreadsheetBackup } from "@/lib/google-sheets";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function extractSpreadsheetId(urlOrId: string) {
  if (!urlOrId) return null;
  // If it's a full URL, extract the ID
  const match = urlOrId.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : urlOrId;
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPERADMIN" && session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "backup_config")
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching backup config:", error);
    }

    const config = data?.value || { destination_url: "", last_backup_at: null };
    return NextResponse.json(config);
  } catch (err: any) {
    console.error("Backup Settings API Error:", err);
    return NextResponse.json({ error: "Failed to fetch backup settings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // 1. Check for Vercel Cron Secret (Automated trigger)
    const authHeader = req.headers.get("authorization");
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    // 2. Check for Admin Session (Manual trigger)
    let isAdmin = false;
    if (!isCron) {
      const session = await auth();
      if (session?.user?.role === "SUPERADMIN" || session?.user?.role === "ADMIN") {
        isAdmin = true;
      }
    }

    if (!isCron && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Attempt to parse custom destination URL if passed
    let destinationUrl = "";
    try {
      const body = await req.json();
      destinationUrl = body.destinationUrl || "";
    } catch {
      // Body might be empty during cron, fallback to fetching from DB
    }

    // If destinationUrl wasn't provided, fetch from DB
    if (!destinationUrl) {
      const { data } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "backup_config")
        .single();
      
      if (data?.value?.destination_url) {
        destinationUrl = data.value.destination_url;
      }
    }

    console.log(`Admin Backup triggered by ${isCron ? "CRON" : "MANUAL"}, Custom Target: ${destinationUrl}`);

    const targetSheetId = extractSpreadsheetId(destinationUrl) || undefined;

    // 3. Perform the backup
    const result = await createSpreadsheetBackup(targetSheetId);

    // 4. Record Success in DB
    const updateTime = new Date().toISOString();
    
    // Update config with latest time and custom URL 
    await supabaseAdmin
      .from("app_settings")
      .upsert({
        key: "backup_config",
        value: {
          destination_url: destinationUrl || result.url,
          last_backup_at: updateTime
        },
        updated_at: updateTime
      });
      
    // Insert into logs
    await supabaseAdmin
      .from("backup_logs")
      .insert({
        status: "SUCCESS",
        type: "COPY",
        destination_url: destinationUrl || result.url
      });

    return NextResponse.json({
      success: true,
      message: `Backup created: ${result.name}`,
      backup: result
    });
  } catch (err: any) {
    console.error("Backup API Error:", err);
    
    // Log failure
    await supabaseAdmin
      .from("backup_logs")
      .insert({
        status: "FAILED",
        type: "COPY",
        error_message: err.message || "Failed to create backup"
      });

    return NextResponse.json(
      { error: err.message || "Failed to create backup" },
      { status: 500 }
    );
  }
}

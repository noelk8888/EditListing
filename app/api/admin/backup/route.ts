import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSpreadsheetBackup } from "@/lib/google-sheets";

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

    console.log(`Admin Backup triggered by ${isCron ? "CRON" : "MANUAL"}`);

    // 3. Perform the backup
    const result = await createSpreadsheetBackup();

    return NextResponse.json({
      success: true,
      message: `Backup created: ${result.name}`,
      backup: result
    });
  } catch (err: any) {
    console.error("Backup API Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create backup" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { ALL_FEATURES } from "@/lib/permissions";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function canManage(role: string) {
  return role === "SUPERADMIN" || role === "ADMIN";
}

// GET role-level permissions or per-user overrides
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const userEmail = searchParams.get("userEmail");

  if (userEmail) {
    // Per-user overrides
    const { data, error } = await supabase
      .from("user_permission_overrides")
      .select("feature, enabled")
      .eq("user_email", userEmail.toLowerCase());
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ overrides: data || [] });
  }

  // Role-level permissions
  // SA can see/edit AD+BR+V; AD can only see/edit BR+V
  const roles = session.user.role === "SUPERADMIN"
    ? ["ADMIN", "BROKER", "VIEWER"]
    : ["BROKER", "VIEWER"];

  const { data, error } = await supabase
    .from("role_permissions")
    .select("role, feature, enabled")
    .in("role", roles);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ permissions: data || [], editableRoles: roles });
}

// PUT — toggle a single feature for a role or user
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { targetRole, feature, enabled, userEmail } = body;

  if (!ALL_FEATURES.includes(feature)) {
    return NextResponse.json({ error: "Unknown feature: " + feature }, { status: 400 });
  }

  if (userEmail) {
    // Per-user override
    if (session.user.role === "ADMIN") {
      // AD can only override BR/V users
      const { data: targetUser } = await supabase
        .from("app_users")
        .select("role")
        .eq("email", userEmail.toLowerCase())
        .single();
      if (!targetUser || !["BROKER", "VIEWER"].includes(targetUser.role)) {
        return NextResponse.json({ error: "AD can only override BR/V user permissions" }, { status: 403 });
      }
    }

    const { error } = await supabase
      .from("user_permission_overrides")
      .upsert(
        { user_email: userEmail.toLowerCase(), feature, enabled, updated_by: session.user.email },
        { onConflict: "user_email,feature" }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Role-level toggle
  if (!targetRole) return NextResponse.json({ error: "targetRole is required" }, { status: 400 });

  // AD cannot change AD-level permissions
  if (session.user.role === "ADMIN" && targetRole === "ADMIN") {
    return NextResponse.json({ error: "ADMIN cannot change ADMIN-level permissions" }, { status: 403 });
  }
  // Only SA can change AD-level permissions
  if (targetRole === "SUPERADMIN") {
    return NextResponse.json({ error: "Cannot change SUPERADMIN permissions" }, { status: 403 });
  }

  const { error } = await supabase
    .from("role_permissions")
    .upsert(
      { role: targetRole, feature, enabled, updated_by: session.user.email },
      { onConflict: "role,feature" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

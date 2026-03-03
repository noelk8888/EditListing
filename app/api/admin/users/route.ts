import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MANAGEABLE_ROLES = ["ADMIN", "EDITOR"];

function canManageUsers(role: string) {
  return role === "SUPERADMIN" || role === "ADMIN";
}

// SA and AD can assign ADMIN/EDITOR (neither can assign SUPERADMIN via UI)
function canAssignRole(managerRole: string, targetRole: string): boolean {
  if (!MANAGEABLE_ROLES.includes(targetRole)) return false;
  return canManageUsers(managerRole);
}

// GET — list all users visible to the requester
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, name, role, created_at, created_by")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // SA sees everyone; AD does not see SA rows (SA rows are not in app_users anyway)
  return NextResponse.json({ users: data || [] });
}

// POST — create a new user
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, name, role } = await request.json();
  if (!email || !name || !role) {
    return NextResponse.json({ error: "email, name, and role are required" }, { status: 400 });
  }
  if (!canAssignRole(session.user.role, role)) {
    return NextResponse.json({ error: "Cannot assign role: " + role }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("app_users")
    .insert({ email: email.toLowerCase().trim(), name: name.trim(), role, created_by: session.user.email })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data }, { status: 201 });
}

// PATCH — update a user's role
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, role } = await request.json();
  if (!email || !role) return NextResponse.json({ error: "email and role are required" }, { status: 400 });
  if (email.toLowerCase() === session.user.email.toLowerCase()) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }
  if (!canAssignRole(session.user.role, role)) {
    return NextResponse.json({ error: "Cannot assign role: " + role }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("app_users")
    .update({ role })
    .eq("email", email.toLowerCase())
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}

// DELETE — remove a user
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email query param required" }, { status: 400 });
  if (email.toLowerCase() === session.user.email.toLowerCase()) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const { error } = await supabase
    .from("app_users")
    .delete()
    .eq("email", email.toLowerCase());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

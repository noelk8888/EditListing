import { createClient } from "@supabase/supabase-js";

// ── Feature types ─────────────────────────────────────────────────────────────
export type Feature =
  | "add_listing"
  | "edit_listing"
  | "delete_listing"
  | "telegram_send"
  | "batch_review"
  | "ai_extract"
  | "geocoding"
  | "view_pricing"
  | "view_contact"
  | "view_geo_id"
  | "view_photos"
  | "export_data"
  | "manage_users"
  | "sheet2";

export const ALL_FEATURES: Feature[] = [
  "add_listing",
  "edit_listing",
  "delete_listing",
  "telegram_send",
  "batch_review",
  "ai_extract",
  "geocoding",
  "view_pricing",
  "view_contact",
  "view_geo_id",
  "view_photos",
  "export_data",
  "manage_users",
  "sheet2",
];

export const FEATURE_LABELS: Record<Feature, string> = {
  add_listing:    "Add Listing",
  edit_listing:   "Edit Listing",
  delete_listing: "Delete Listing",
  telegram_send:  "Send Telegram Notifications",
  batch_review:   "Batch Review Mode",
  ai_extract:     "AI Extract (Claude)",
  geocoding:      "Geocoding (Lat/Long)",
  view_pricing:   "View Pricing",
  view_contact:   "View Contact Info",
  view_geo_id:    "View GEO IDs",
  view_photos:    "View Photos",
  export_data:    "Export Data",
  manage_users:   "Manage Users",
  sheet2:         "Sheet2 Features (Superadmin only)",
};

export const FEATURE_GROUPS: { label: string; features: Feature[] }[] = [
  {
    label: "Listing Operations",
    features: ["add_listing", "edit_listing", "delete_listing"],
  },
  {
    label: "Communication",
    features: ["telegram_send"],
  },
  {
    label: "Power Tools",
    features: ["batch_review", "ai_extract", "geocoding"],
  },
  {
    label: "Data Visibility",
    features: ["view_pricing", "view_contact", "view_geo_id", "view_photos", "export_data"],
  },
  {
    label: "Administration",
    features: ["manage_users"],
  },
];

// ── Role defaults (used when no DB override exists) ───────────────────────────
export const ROLE_DEFAULTS: Record<"ADMIN" | "EDITOR", Record<Feature, boolean>> = {
  ADMIN: {
    add_listing:    true,
    edit_listing:   true,
    delete_listing: true,
    telegram_send:  true,
    batch_review:   true,
    ai_extract:     true,
    geocoding:      true,
    view_pricing:   true,
    view_contact:   true,
    view_geo_id:    true,
    view_photos:    true,
    export_data:    true,
    manage_users:   true,
    sheet2:         false,
  },
  EDITOR: {
    add_listing:    false,
    edit_listing:   false,
    delete_listing: false,
    telegram_send:  false,
    batch_review:   false,
    ai_extract:     false,
    geocoding:      false,
    view_pricing:   false,
    view_contact:   false,
    view_geo_id:    false,
    view_photos:    true,
    export_data:    false,
    manage_users:   false,
    sheet2:         false,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ── Main resolver ─────────────────────────────────────────────────────────────
/**
 * Returns a permission map for the given user.
 * Priority: per-user override > role DB override > role code default.
 */
export async function getUserPermissions(
  email: string,
  role: string
): Promise<Record<Feature, boolean>> {
  // SA always has everything
  if (role === "SUPERADMIN") {
    return Object.fromEntries(ALL_FEATURES.map((f) => [f, true])) as Record<Feature, boolean>;
  }

  // UNAUTHORIZED / unknown role → deny everything
  if (!["ADMIN", "EDITOR"].includes(role)) {
    return Object.fromEntries(ALL_FEATURES.map((f) => [f, false])) as Record<Feature, boolean>;
  }

  const supabase = getSupabase();
  const typedRole = role as "ADMIN" | "EDITOR";

  // Start with code defaults for this role
  const perms: Record<Feature, boolean> = { ...ROLE_DEFAULTS[typedRole] };

  // Apply role-level DB overrides
  const { data: rolePerms } = await supabase
    .from("role_permissions")
    .select("feature, enabled")
    .eq("role", role);

  if (rolePerms) {
    for (const row of rolePerms) {
      if (ALL_FEATURES.includes(row.feature as Feature)) {
        perms[row.feature as Feature] = row.enabled;
      }
    }
  }

  // Apply per-user overrides (highest priority)
  const { data: userOverrides } = await supabase
    .from("user_permission_overrides")
    .select("feature, enabled")
    .eq("user_email", email.toLowerCase());

  if (userOverrides) {
    for (const row of userOverrides) {
      if (ALL_FEATURES.includes(row.feature as Feature)) {
        perms[row.feature as Feature] = row.enabled;
      }
    }
  }

  // noelkiu@gmail.com always has batch_review access
  if (email.toLowerCase() === "noelkiu@gmail.com") {
    perms.batch_review = true;
  }

  return perms;
}

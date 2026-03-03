"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ALL_FEATURES, FEATURE_LABELS, FEATURE_GROUPS, ROLE_DEFAULTS } from "@/lib/permissions";
import type { Feature } from "@/lib/permissions";

type PermRow = { role: string; feature: string; enabled: boolean };

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<PermRow[]>([]);
  const [editableRoles, setEditableRoles] = useState<string[]>([]);
  const [myRole, setMyRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string>(""); // "role:feature" key currently saving
  const [error, setError] = useState("");

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const [permRes, myRes] = await Promise.all([
        fetch("/api/admin/permissions"),
        fetch("/api/my-permissions"),
      ]);
      const permData = await permRes.json();
      const myData = await myRes.json();
      setPermissions(permData.permissions || []);
      setEditableRoles(permData.editableRoles || []);
      setMyRole(myData.role || "");
    } catch {
      setError("Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

  // Resolve current value for a role+feature (DB override or code default)
  function getValue(role: string, feature: Feature): boolean {
    const dbRow = permissions.find((p) => p.role === role && p.feature === feature);
    if (dbRow) return dbRow.enabled;
    const defaults = ROLE_DEFAULTS[role as "ADMIN" | "EDITOR"];
    return defaults?.[feature] ?? false;
  }

  async function toggle(role: string, feature: Feature, newVal: boolean) {
    const key = `${role}:${feature}`;
    setSaving(key);
    setError("");
    try {
      const res = await fetch("/api/admin/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole: role, feature, enabled: newVal }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Save failed"); return; }
      // Optimistic update
      setPermissions((prev) => {
        const existing = prev.findIndex((p) => p.role === role && p.feature === feature);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = { ...next[existing], enabled: newVal };
          return next;
        }
        return [...prev, { role, feature, enabled: newVal }];
      });
    } catch {
      setError("Network error");
    } finally {
      setSaving("");
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground p-4">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Permissions</h1>
        <p className="text-muted-foreground">
          {myRole === "SUPERADMIN"
            ? "Configure feature access for ADMIN and EDITOR roles."
            : "Configure feature access for EDITOR role."}
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-6 font-medium w-64">Feature</th>
                {editableRoles.map((role) => (
                  <th key={role} className="py-2 pr-6 font-medium text-center w-24">{role}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_GROUPS.map((group) => (
                <>
                  <tr key={group.label}>
                    <td
                      colSpan={editableRoles.length + 1}
                      className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {group.label}
                    </td>
                  </tr>
                  {group.features.map((feature) => (
                    <tr key={feature} className="border-b last:border-0">
                      <td className="py-2 pr-6">{FEATURE_LABELS[feature]}</td>
                      {editableRoles.map((role) => {
                        const val = getValue(role, feature);
                        const key = `${role}:${feature}`;
                        const isSaving = saving === key;
                        return (
                          <td key={role} className="py-2 pr-6 text-center">
                            <button
                              onClick={() => toggle(role, feature, !val)}
                              disabled={isSaving}
                              className={`
                                w-10 h-5 rounded-full transition-colors relative
                                ${val ? "bg-green-500" : "bg-gray-300"}
                                ${isSaving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                              `}
                              title={val ? "Enabled — click to disable" : "Disabled — click to enable"}
                            >
                              <span
                                className={`
                                  absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                                  ${val ? "translate-x-5" : "translate-x-0.5"}
                                `}
                              />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        SUPERADMIN always has all permissions and cannot be toggled.
        Changes take effect on the user&apos;s next page load.
      </p>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, UserPlus, Pencil } from "lucide-react";

type AppUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
  created_by: string;
};

type FormState = { email: string; name: string; role: string };

const EMPTY_FORM: FormState = { email: "", name: "", role: "BROKER" };
const ROLE_BADGE: Record<string, string> = {
  SUPERADMIN: "bg-red-100 text-red-700",
  ADMIN:      "bg-purple-100 text-purple-700",
  BROKER:     "bg-blue-100 text-blue-700",
  VIEWER:     "bg-gray-100 text-gray-700",
};

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editEmail, setEditEmail] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [myRole, setMyRole] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, permRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/my-permissions"),
      ]);
      const usersData = await usersRes.json();
      const permData = await permRes.json();
      setUsers(usersData.users || []);
      setMyRole(permData.role || "");
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function openAdd() {
    setEditEmail(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setError("");
  }

  function openEdit(user: AppUser) {
    setEditEmail(user.email);
    setForm({ email: user.email, name: user.name, role: user.role });
    setShowForm(true);
    setError("");
  }

  async function handleSave() {
    if (!form.email || !form.name || !form.role) {
      setError("All fields are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const method = editEmail ? "PATCH" : "POST";
      const res = await fetch("/api/admin/users", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Save failed"); return; }
      setShowForm(false);
      fetchUsers();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(email: string) {
    if (!confirm(`Delete user ${email}?`)) return;
    const res = await fetch(`/api/admin/users?email=${encodeURIComponent(email)}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json(); setError(d.error || "Delete failed"); return; }
    fetchUsers();
  }

  const assignableRoles = ["ADMIN", "BROKER", "VIEWER"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Add, edit, or remove user accounts</p>
        </div>
        <Button onClick={openAdd}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Add / Edit form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editEmail ? "Edit User" : "Add New User"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="user@example.com"
                  disabled={!!editEmail}
                />
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users table */}
      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet. Add one above.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Added by</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.email} className="border-b last:border-0">
                    <td className="py-2 pr-4">{u.name}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{u.email}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_BADGE[u.role] || ""}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground text-xs">{u.created_by}</td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(u.email)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {myRole === "SUPERADMIN" && (
        <p className="text-xs text-muted-foreground">
          SUPERADMIN accounts are configured via the <code>SUPERADMIN_EMAILS</code> environment variable and do not appear in this table.
        </p>
      )}
    </div>
  );
}

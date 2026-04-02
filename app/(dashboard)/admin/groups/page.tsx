"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Trash2, 
  Plus, 
  Pencil, 
  Search, 
  Loader2, 
  Send, 
  ExternalLink,
  Save,
  X,
  RefreshCw,
  Hash
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

type TelegramGroup = {
  id: string;
  name: string;
  keywords: string[];
  invite_link: string | null;
  chat_id: string | null;
  is_active: boolean;
  updated_at: string;
};

export default function TelegramGroupsPage() {
  const [groups, setGroups] = useState<TelegramGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  type EditFormState = Partial<TelegramGroup> & { keywordsInput?: string };
  const [editForm, setEditForm] = useState<EditFormState>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/groups");
      const data = await res.json();
      if (res.ok) setGroups(data.groups || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load groups", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const filteredGroups = useMemo(() => {
    const term = search.toLowerCase();
    return groups.filter(g => 
      g.name.toLowerCase().includes(term) || 
      g.chat_id?.includes(term) ||
      g.keywords.some(kw => kw.toLowerCase().includes(term))
    );
  }, [groups, search]);

  const stats = useMemo(() => {
    const MAIN_GROUP_NAMES = [
      'MAIN GROUPS', 'UPDATE LISTING', 'DIRECT', 'RESIDENTIAL', 
      'COML/INDL', 'BUSINESS FOR SALE', 'TEST'
    ];
    
    // Filter out the "Main Group" headers/categories
    const chatGroups = groups.filter(g => !MAIN_GROUP_NAMES.includes(g.name));
    
    const total = chatGroups.length;
    const identified = chatGroups.filter(g => !!g.chat_id?.trim()).length;
    
    return { total, identified };
  }, [groups]);

  async function handleSave(id: string) {
    setSaving(true);
    try {
      // Parse keywords back to array right before saving
      const payloadToSave = { ...editForm };
      if (payloadToSave.keywordsInput !== undefined) {
        payloadToSave.keywords = payloadToSave.keywordsInput.split(",").map(k => k.trim()).filter(Boolean);
        delete payloadToSave.keywordsInput;
      }

      const res = await fetch("/api/admin/groups", {
        method: id === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id === "new" ? payloadToSave : { id, ...payloadToSave }),
      });
      if (res.ok) {
        toast({ title: "Success", description: "Group updated successfully" });
        setEditingId(null);
        fetchGroups();
      } else {
        const d = await res.json();
        toast({ title: "Error", description: d.error || "Save failed", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Permanently delete group "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/groups?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Deleted", description: "Group removed" });
        fetchGroups();
      }
    } catch (err) {
      toast({ title: "Error", description: "Delete failed", variant: "destructive" });
    }
  }

  function startEdit(group: TelegramGroup) {
    setEditingId(group.id);
    setEditForm({ ...group, keywordsInput: group.keywords?.join(", ") || "" });
  }

  function startAdd() {
    setEditingId("new");
    setEditForm({ name: "", keywords: [], keywordsInput: "", invite_link: "", chat_id: "", is_active: true });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Telegram Pro Hub for @LuxeRealtyListingUpdateBot</h1>
          <p className="text-muted-foreground italic">Manage your 135+ notification channels and smart keywords</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" onClick={fetchGroups} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={startAdd} disabled={editingId === "new"}>
            <Plus className="h-4 w-4 mr-2" />
            Add Group
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-lg border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, Chat ID, or keywords..." 
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="text-sm font-medium text-slate-500 hidden md:block">
          {filteredGroups.length} of {groups.length} groups
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50 border-b">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Group Name</th>
                  <th className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                       Chat ID / Link
                       <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-500 font-mono">
                         {stats.identified}/{stats.total}
                       </span>
                    </div>
                  </th>
                  <th className="px-4 py-3 font-medium">Keywords</th>
                  <th className="px-4 py-3 font-medium text-center">Active</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {editingId === "new" && (
                  <tr className="bg-blue-50/30">
                    <td className="px-4 py-3">
                      <Input 
                        placeholder="Group Name" 
                        value={editForm.name} 
                        onChange={e => setEditForm({...editForm, name: e.target.value})}
                        className="h-8"
                      />
                    </td>
                    <td className="px-4 py-3 space-y-2">
                       <Input 
                        placeholder="Chat ID (e.g. -100...)" 
                        value={editForm.chat_id || ""} 
                        onChange={e => setEditForm({...editForm, chat_id: e.target.value})}
                        className="h-8"
                      />
                      <Input 
                        placeholder="Invite Link" 
                        value={editForm.invite_link || ""} 
                        onChange={e => setEditForm({...editForm, invite_link: e.target.value})}
                        className="h-8"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input 
                        placeholder="Comma separated keywords" 
                        value={editForm.keywordsInput !== undefined ? editForm.keywordsInput : editForm.keywords?.join(", ")} 
                        onChange={e => setEditForm({...editForm, keywordsInput: e.target.value})}
                        className="h-8"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                       <Checkbox 
                        checked={editForm.is_active} 
                        onCheckedChange={v => setEditForm({...editForm, is_active: !!v})} 
                      />
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4"/></Button>
                      <Button size="sm" onClick={() => handleSave("new")} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}
                      </Button>
                    </td>
                  </tr>
                )}
                {loading && groups.length === 0 ? (
                  <tr><td colSpan={5} className="py-20 text-center text-muted-foreground">Loading groups...</td></tr>
                ) : filteredGroups.length === 0 ? (
                  <tr><td colSpan={5} className="py-20 text-center text-muted-foreground">No groups found matching your search.</td></tr>
                ) : (
                  filteredGroups.map(group => (
                    <tr key={group.id} className={cn("hover:bg-slate-50 group", editingId === group.id && "bg-blue-50/20")}>
                      <td className="px-4 py-3 font-medium">
                        {editingId === group.id ? (
                           <Input 
                            value={editForm.name} 
                            onChange={e => setEditForm({...editForm, name: e.target.value})}
                            className="h-8"
                          />
                        ) : group.name}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === group.id ? (
                          <div className="space-y-1">
                            <Input 
                              placeholder="Chat ID"
                              value={editForm.chat_id || ""} 
                              onChange={e => setEditForm({...editForm, chat_id: e.target.value})}
                              className="h-8"
                            />
                             <Input 
                              placeholder="Invite Link"
                              value={editForm.invite_link || ""} 
                              onChange={e => setEditForm({...editForm, invite_link: e.target.value})}
                              className="h-8"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
                              <Hash className="h-3 w-3" />
                              {group.chat_id || <span className="text-[10px] italic text-red-400">Missing ID</span>}
                            </div>
                            {group.invite_link && (
                              <a href={group.invite_link} target="_blank" className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5">
                                Link <ExternalLink className="h-2 w-2"/>
                              </a>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                         {editingId === group.id ? (
                           <Input 
                            value={editForm.keywordsInput !== undefined ? editForm.keywordsInput : editForm.keywords?.join(", ")} 
                            onChange={e => setEditForm({...editForm, keywordsInput: e.target.value})}
                            className="h-8 shadow-inner"
                          />
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {group.keywords.slice(0, 3).map(kw => (
                              <span key={kw} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">
                                {kw}
                              </span>
                            ))}
                            {group.keywords.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">+{group.keywords.length - 3}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingId === group.id ? (
                          <Checkbox 
                            checked={editForm.is_active} 
                            onCheckedChange={v => setEditForm({...editForm, is_active: !!v})} 
                          />
                        ) : (
                          <div className={cn("h-2 w-2 rounded-full mx-auto", group.is_active ? "bg-green-500" : "bg-slate-300")} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editingId === group.id ? (
                           <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4"/></Button>
                              <Button size="sm" onClick={() => handleSave(group.id)} disabled={saving}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}
                              </Button>
                           </div>
                        ) : (
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="ghost" onClick={() => startEdit(group)}>
                              <Pencil className="h-4 w-4"/>
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(group.id, group.name)}>
                              <Trash2 className="h-4 w-4"/>
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-4">
        <div className="p-2 bg-blue-600 text-white rounded-md shadow-lg rotate-3 shrink-0">
          <Send className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h4 className="font-semibold text-blue-900 flex items-center gap-2">
            Auto-ID Harvester
            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-mono uppercase tracking-wider">Experimental</span>
          </h4>
          <p className="text-sm text-blue-800 leading-relaxed">
            Invite your bot (<strong>@LuxeBot</strong>) to any of these groups and send <code className="bg-blue-200/50 px-1 rounded font-bold text-blue-900">/id</code>. 
            The hub will automatically detect the group and capture its numeric Chat ID, eliminating manual work!
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type Ownership = {
  id: string;
  name: string;
};

export default function ListingOwnershipPage() {
  const [ownerships, setOwnerships] = useState<Ownership[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOwnershipName, setNewOwnershipName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchOwnerships = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ownership");
      const data = await res.json();
      if (res.ok) setOwnerships(data.ownerships || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load listing ownerships", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchOwnerships();
  }, [fetchOwnerships]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newOwnershipName.trim()) return;

    setAdding(true);
    try {
      const res = await fetch("/api/admin/ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOwnershipName }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to add ownership");
      
      setOwnerships((prev) => [...prev, data.ownership].sort((a, b) => a.name.localeCompare(b.name)));
      setNewOwnershipName("");
      toast({ title: "Success", description: "Listing ownership added" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this listing ownership?")) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/ownership?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to delete ownership");

      setOwnerships((prev) => prev.filter((o) => o.id !== id));
      toast({ title: "Success", description: "Listing ownership deleted" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Listing Ownership</h1>
          <p className="text-muted-foreground mt-2">
            Manage the options available in the "Listing Ownership" dropdown.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New Ownership</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex gap-2">
            <Input
              placeholder="e.g., Broker Nicole Rodil"
              value={newOwnershipName}
              onChange={(e) => setNewOwnershipName(e.target.value)}
              disabled={adding}
              className="max-w-sm"
            />
            <Button type="submit" disabled={adding || !newOwnershipName.trim()}>
              {adding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Ownerships</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : ownerships.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No ownerships found. Add one above.
            </div>
          ) : (
            <div className="rounded-md border divide-y">
              {ownerships.map((o) => (
                <div key={o.id} className="flex items-center justify-between p-4 bg-card">
                  <div className="font-medium">{o.name}</div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(o.id)}
                    disabled={deletingId === o.id}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {deletingId === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, AlertCircle } from "lucide-react";

const LUXE_DBASE_URL =
  "https://docs.google.com/spreadsheets/d/12Z8X3RmYRBMiihsxf-J0f650Ifj2irxRQsYC64Cgbw0/edit";

interface DuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DuplicatesModal({ isOpen, onClose }: DuplicatesModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleScan = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl: LUXE_DBASE_URL }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");

      if (data.duplicateCount === 0 || !data.groups?.length) {
        setError("✅ No duplicates found — LUXE DBASE is clean!");
        setLoading(false);
        return;
      }

      // Store results and navigate to full review page
      localStorage.setItem(
        "luxe_dup_review_data",
        JSON.stringify({
          groups: data.groups,
          spreadsheetId: data.spreadsheetId,
          summary: {
            photoMatchCount: data.photoMatchCount,
            fuzzyMatchCount: data.fuzzyMatchCount,
            tabName: data.tabName,
            outputUrl: data.outputUrl,
          },
        })
      );

      onClose();
      router.push("/admin/duplicates/review");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Copy className="h-5 w-5 text-purple-600" />
            Check for Duplicates
          </DialogTitle>
          <DialogDescription>
            Scans <strong>LUXE DBASE Sheet1</strong> using photo link and fuzzy
            text matching. Results open in a full review page.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {!loading && !error && (
            <div className="p-4 bg-muted/50 rounded-lg border border-dashed text-sm text-muted-foreground space-y-1.5">
              <p>📸 <strong>Phase 1 — Photo Match:</strong> Col AB photo link slugs</p>
              <p>📜 <strong>Phase 2 — Fuzzy Match:</strong> Col A text at 80% threshold</p>
              <p className="text-xs pt-1 text-muted-foreground/60">
                Found groups open in a full-page review where you choose the Original listing per group.
              </p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
              <p className="font-medium">Scanning LUXE DBASE…</p>
              <p className="text-xs text-muted-foreground">This may take 20–40 seconds.</p>
            </div>
          )}

          {error && (
            <div className={`flex items-start gap-3 p-4 rounded-lg border text-sm ${
              error.startsWith("✅")
                ? "bg-green-50 border-green-200 text-green-900"
                : "bg-red-50 border-red-200 text-red-900"
            }`}>
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {!loading && (
            <div className="flex gap-2">
              {error ? (
                <>
                  <Button variant="outline" className="flex-1" onClick={() => setError(null)}>
                    Try Again
                  </Button>
                  <Button className="flex-1" onClick={handleClose}>Close</Button>
                </>
              ) : (
                <Button
                  onClick={handleScan}
                  className="w-full h-11 text-base bg-purple-600 hover:bg-purple-700"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Run Duplicate Check
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

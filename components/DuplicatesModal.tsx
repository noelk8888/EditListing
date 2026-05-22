"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Copy,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// Always scans LUXE DBASE master spreadsheet
const LUXE_DBASE_URL =
  "https://docs.google.com/spreadsheets/d/12Z8X3RmYRBMiihsxf-J0f650Ifj2irxRQsYC64Cgbw0/edit";

interface DuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DupResult {
  duplicateCount: number;
  tabName?: string;
  outputUrl?: string;
  photoMatchCount?: number;
  fuzzyMatchCount?: number;
  message?: string;
}

export function DuplicatesModal({ isOpen, onClose }: DuplicatesModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl: LUXE_DBASE_URL }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to run duplicate check");

      setResult(data);
      toast({
        title: data.duplicateCount > 0 ? "Duplicates Found" : "No Duplicates",
        description:
          data.duplicateCount > 0
            ? `Found ${data.duplicateCount} duplicate groups.`
            : "LUXE DBASE is clean — no duplicates found!",
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Copy className="h-5 w-5 text-purple-600" />
            Check for Duplicates
          </DialogTitle>
          <DialogDescription>
            Scans <strong>LUXE DBASE Sheet1</strong> for duplicate listings using
            photo links and fuzzy text matching.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {/* Pre-run info */}
          {!result && !error && !loading && (
            <div className="p-4 bg-muted/50 rounded-lg border border-dashed space-y-2">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  📸 <strong>Phase 1 — Photo Match:</strong> Compares the unique
                  slug in Col AB photo links.
                </p>
                <p>
                  📜 <strong>Phase 2 — Fuzzy Match:</strong> Analyzes Col A
                  listing text at an 80% similarity threshold.
                </p>
                <p className="pt-1 text-xs text-muted-foreground/70">
                  Results are written to a new tab in LUXE DBASE named{" "}
                  <em>Duplicates – [today's date]</em>.
                </p>
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              <p className="text-sm font-medium text-muted-foreground">
                Scanning LUXE DBASE for duplicates…
              </p>
              <p className="text-xs text-muted-foreground/60">
                This may take 20–40 seconds for large sheets.
              </p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-900">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Check Failed</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Result state */}
          {result && (
            <div
              className={`p-4 rounded-lg border animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                result.duplicateCount > 0
                  ? "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800"
                  : "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
              }`}
            >
              <div className="flex items-start gap-3">
                {result.duplicateCount > 0 ? (
                  <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                )}
                <div className="space-y-2 w-full">
                  <p
                    className={`font-bold text-base ${
                      result.duplicateCount > 0
                        ? "text-orange-900 dark:text-orange-300"
                        : "text-green-900 dark:text-green-300"
                    }`}
                  >
                    {result.duplicateCount > 0
                      ? `Found ${result.duplicateCount} duplicate group${result.duplicateCount > 1 ? "s" : ""}!`
                      : "No duplicates found — LUXE DBASE is clean!"}
                  </p>

                  {result.duplicateCount > 0 && (
                    <>
                      <div className="text-sm text-orange-800 dark:text-orange-400 space-y-1">
                        <p>
                          Results tab:{" "}
                          <strong className="font-mono text-xs">{result.tabName}</strong>
                        </p>
                        <div className="flex gap-5 pt-0.5">
                          <span>📸 Photo matches: <strong>{result.photoMatchCount}</strong></span>
                          <span>📜 Fuzzy matches: <strong>{result.fuzzyMatchCount}</strong></span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="mt-1 border-orange-300 hover:bg-orange-100 dark:border-orange-700 dark:hover:bg-orange-900/30"
                      >
                        <a
                          href={result.outputUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-2 h-3 w-3" />
                          Open in LUXE DBASE
                        </a>
                      </Button>
                    </>
                  )}

                  {result.message && (
                    <p className="text-sm text-green-800 dark:text-green-400">
                      {result.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!loading && (
            <div className="flex gap-2 pt-1">
              {!result ? (
                <Button
                  onClick={handleRun}
                  disabled={loading}
                  className="w-full h-11 text-base bg-purple-600 hover:bg-purple-700"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Run Duplicate Check
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => { setResult(null); setError(null); }}
                    className="flex-1"
                  >
                    Run Again
                  </Button>
                  <Button onClick={handleClose} className="flex-1">
                    Done
                  </Button>
                </>
              )}
            </div>
          )}

          {error && !loading && (
            <Button
              variant="ghost"
              onClick={() => { setError(null); }}
              className="w-full text-sm"
            >
              Try Again
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

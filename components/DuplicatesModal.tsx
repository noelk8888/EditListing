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
            : "LUXE DBASE is clean!",
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
            Scan LUXE DBASE for duplicate listings using photo links and fuzzy
            text matching.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Source info */}
          {!result && !error && (
            <div className="p-4 bg-muted/50 rounded-lg border border-dashed space-y-3">
              <p className="text-sm text-muted-foreground">
                Scanning <strong>Sheet1</strong> of the LUXE DBASE master
                spreadsheet. Results will be written to a new tab named{" "}
                <em>Duplicates – [today's date]</em>.
              </p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>📸 <strong>Phase 1:</strong> Photo link matching (Col AB)</p>
                <p>📜 <strong>Phase 2:</strong> Fuzzy text matching (Col A, 80% threshold)</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-900">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Check Failed</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Result state */}
          {result && (
            <div
              className={`p-4 rounded-lg border animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                result.duplicateCount > 0
                  ? "bg-orange-50 border-orange-200"
                  : "bg-green-50 border-green-200"
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
                        ? "text-orange-900"
                        : "text-green-900"
                    }`}
                  >
                    {result.duplicateCount > 0
                      ? `Found ${result.duplicateCount} duplicate group${result.duplicateCount > 1 ? "s" : ""}!`
                      : "No duplicates found!"}
                  </p>

                  {result.duplicateCount > 0 && (
                    <>
                      <div className="text-sm text-orange-800 space-y-1">
                        <p>
                          Results written to tab:{" "}
                          <strong>{result.tabName}</strong>
                        </p>
                        <div className="flex gap-4">
                          <span>📸 Photo: {result.photoMatchCount}</span>
                          <span>📜 Fuzzy: {result.fuzzyMatchCount}</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild className="mt-2 border-orange-300 hover:bg-orange-100">
                        <a
                          href={result.outputUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-2 h-3 w-3" />
                          Open Spreadsheet
                        </a>
                      </Button>
                    </>
                  )}

                  {result.message && (
                    <p className="text-sm text-green-800">{result.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            {!result ? (
              <Button
                onClick={handleRun}
                disabled={loading}
                className="w-full h-11 text-base"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Run Duplicate Check
                  </>
                )}
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

          {error && (
            <Button variant="ghost" onClick={() => setError(null)} className="w-full">
              Try Again
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

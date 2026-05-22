"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  ChevronRight,
  SkipForward,
  Pencil,
  ExternalLink,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DupListing {
  rowNumber: number;
  geoId: string;
  colA: string;
}

interface DupGroup {
  matchType: string;
  listings: DupListing[];
}

interface ReviewData {
  groups: DupGroup[];
  spreadsheetId: string;
  summary: {
    photoMatchCount: number;
    fuzzyMatchCount: number;
    tabName: string;
    outputUrl: string;
  };
}

type GroupPhase = "selecting" | "marking" | "done";

export default function DuplicateReviewPage() {
  const router = useRouter();

  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [groupPhase, setGroupPhase] = useState<GroupPhase>("selecting");

  const [selectedOriginalRow, setSelectedOriginalRow] = useState<number | null>(null);
  const [editedText, setEditedText] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [markedCount, setMarkedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [isMarking, setIsMarking] = useState(false);

  // Load data from localStorage
  useEffect(() => {
    const raw = localStorage.getItem("luxe_dup_review_data");
    if (!raw) {
      router.push("/");
      return;
    }
    try {
      setReviewData(JSON.parse(raw));
    } catch {
      router.push("/");
    }
  }, [router]);

  const totalGroups = reviewData?.groups.length ?? 0;
  const currentGroup = reviewData?.groups[currentIndex] ?? null;
  const isLastGroup = currentIndex >= totalGroups - 1;

  const originalListing = currentGroup?.listings.find(
    (l) => l.rowNumber === selectedOriginalRow
  );
  const duplicateListings = currentGroup?.listings.filter(
    (l) => l.rowNumber !== selectedOriginalRow
  ) ?? [];

  const resetGroup = useCallback(() => {
    setSelectedOriginalRow(null);
    setEditedText("");
    setShowEdit(false);
    setError(null);
    setGroupPhase("selecting");
  }, []);

  const handleSelectOriginal = (listing: DupListing) => {
    setSelectedOriginalRow(listing.rowNumber);
    setEditedText(listing.colA);
    setShowEdit(false);
  };

  const handleSkip = () => {
    setSkippedCount((c) => c + 1);
    if (isLastGroup) {
      setAllDone(true);
    } else {
      setCurrentIndex((i) => i + 1);
      resetGroup();
    }
  };

  const handleMarkDuplicates = async () => {
    if (!selectedOriginalRow || !originalListing || !reviewData) return;
    setIsMarking(true);
    setGroupPhase("marking");
    setError(null);

    try {
      const res = await fetch("/api/duplicates/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetId: reviewData.spreadsheetId,
          originalRowNumber: selectedOriginalRow,
          originalGeoId: originalListing.geoId,
          duplicateRowNumbers: duplicateListings.map((l) => l.rowNumber),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mark failed");

      setMarkedCount((c) => c + 1);
      setGroupPhase("done");
      toast({
        title: "Duplicates Marked",
        description: `${data.markedCount} row${data.markedCount !== 1 ? "s" : ""} formatted in LUXE DBASE.`,
      });
    } catch (err: any) {
      setError(err.message);
      setGroupPhase("selecting");
    } finally {
      setIsMarking(false);
    }
  };

  const handleOpenOriginalInAdd = () => {
    const text = showEdit ? editedText : (originalListing?.colA ?? "");
    localStorage.setItem("luxe_prefill_text", text);
    window.open("/add", "_blank");
  };

  const handleNextGroup = () => {
    if (isLastGroup) {
      setAllDone(true);
    } else {
      setCurrentIndex((i) => i + 1);
      resetGroup();
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!reviewData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  // ── All done state ─────────────────────────────────────────────────────────
  if (allDone) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-8">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">All Groups Reviewed!</h1>
          <p className="text-muted-foreground text-lg">
            {markedCount} group{markedCount !== 1 ? "s" : ""} marked as duplicates
            {skippedCount > 0 && ` · ${skippedCount} skipped`}
          </p>
        </div>
        <div className="flex gap-3">
          {reviewData.summary.outputUrl && (
            <Button variant="outline" asChild>
              <a href={reviewData.summary.outputUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Duplicates Report
              </a>
            </Button>
          )}
          <Button onClick={() => {
            localStorage.removeItem("luxe_dup_review_data");
            router.push("/");
          }}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!currentGroup) return null;

  const gridCols =
    currentGroup.listings.length === 2
      ? "grid-cols-2"
      : currentGroup.listings.length === 3
      ? "grid-cols-3"
      : "grid-cols-2 xl:grid-cols-4";

  // ── Main review UI ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 bg-background border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </button>
            <div className="h-4 border-l" />
            <div className="flex items-center gap-3">
              <Copy className="h-5 w-5 text-purple-600" />
              <h1 className="font-bold text-lg">Duplicate Review</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Progress */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Group</span>
              <span className="font-bold text-lg text-purple-600">
                {currentIndex + 1}
              </span>
              <span className="text-muted-foreground">of {totalGroups}</span>
              <span className={cn(
                "ml-2 inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold",
                currentGroup.matchType === "Photo Match"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                  : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
              )}>
                {currentGroup.matchType}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-600 rounded-full transition-all"
                style={{ width: `${((currentIndex) / totalGroups) * 100}%` }}
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={handleSkip}
              disabled={isMarking}
            >
              <SkipForward className="h-4 w-4" />
              Skip (False Duplicate)
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 flex flex-col gap-6">

        {/* Instruction */}
        {groupPhase === "selecting" && (
          <p className="text-sm text-muted-foreground text-center">
            {!selectedOriginalRow
              ? "Click <strong>Mark as Original</strong> on the listing that should be kept."
              : `Original selected: Row ${selectedOriginalRow} · ${originalListing?.geoId || "—"} — the other ${duplicateListings.length} listing${duplicateListings.length !== 1 ? "s" : ""} will be marked as duplicates.`}
          </p>
        )}

        {/* ── Listing cards grid ── */}
        {groupPhase !== "done" && (
          <div className={cn("grid gap-4", gridCols)}>
            {currentGroup.listings.map((listing) => {
              const isSelected = listing.rowNumber === selectedOriginalRow;
              const isDuplicate = selectedOriginalRow !== null && !isSelected;

              return (
                <div
                  key={listing.rowNumber}
                  className={cn(
                    "rounded-xl border-2 flex flex-col transition-all duration-200 overflow-hidden",
                    isSelected
                      ? "border-green-500 shadow-lg shadow-green-100 dark:shadow-green-900/20"
                      : isDuplicate
                      ? "border-border opacity-60"
                      : "border-border hover:border-purple-300"
                  )}
                >
                  {/* Card header */}
                  <div className={cn(
                    "px-4 py-3 flex items-center justify-between border-b",
                    isSelected
                      ? "bg-green-50 dark:bg-green-950/30"
                      : "bg-muted/50"
                  )}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold">Row {listing.rowNumber}</span>
                      {listing.geoId && (
                        <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-mono bg-background">
                          {listing.geoId}
                        </span>
                      )}
                    </div>
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 rounded bg-green-600 text-white text-xs font-semibold px-2.5 py-1">
                        <CheckCircle2 className="h-3 w-3" />
                        ORIGINAL
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant={selectedOriginalRow ? "ghost" : "outline"}
                        className="h-7 text-xs"
                        onClick={() => handleSelectOriginal(listing)}
                        disabled={groupPhase === "marking"}
                      >
                        Mark as Original
                      </Button>
                    )}
                  </div>

                  {/* Col A text */}
                  <div className="flex-1 p-4 overflow-y-auto max-h-[480px]">
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/90">
                      {listing.colA}
                    </pre>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── After marking: done state ── */}
        {groupPhase === "done" && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="p-6 rounded-xl bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-800 flex items-start gap-4 max-w-xl w-full">
              <CheckCircle2 className="h-6 w-6 text-green-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-bold text-green-900 dark:text-green-300 text-lg">
                  {duplicateListings.length} duplicate{duplicateListings.length !== 1 ? "s" : ""} marked in LUXE DBASE
                </p>
                <p className="text-sm text-green-800 dark:text-green-400">
                  Row{duplicateListings.length !== 1 ? "s" : ""}{" "}
                  {duplicateListings.map((l) => l.rowNumber).join(", ")} →
                  Black background · Bold white text · First line updated
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xl">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={handleOpenOriginalInAdd}
              >
                <ExternalLink className="h-4 w-4" />
                Open Original (Row {selectedOriginalRow}) in Add Listing
                <span className="text-xs text-muted-foreground">(new tab)</span>
              </Button>
              <Button className="flex-1 gap-2" onClick={handleNextGroup}>
                {isLastGroup ? (
                  <>Finish <CheckCircle2 className="h-4 w-4" /></>
                ) : (
                  <>Next Group <ChevronRight className="h-4 w-4" /></>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Edit + action bar ── */}
        {groupPhase === "selecting" && selectedOriginalRow && (
          <div className="border rounded-xl p-5 bg-muted/30 space-y-4 max-w-4xl mx-auto w-full">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                Original: Row {selectedOriginalRow} · {originalListing?.geoId}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground h-8"
                onClick={() => setShowEdit((v) => !v)}
              >
                <Pencil className="h-3.5 w-3.5" />
                {showEdit ? "Hide Editor" : "Edit Original Text"}
              </Button>
            </div>

            {showEdit && (
              <Textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="font-mono text-xs min-h-[180px]"
                placeholder="Edit the original listing text here…"
              />
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 rounded bg-red-50 border border-red-200 text-red-800 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <Button
              className="w-full h-11 text-base"
              onClick={handleMarkDuplicates}
              disabled={isMarking}
            >
              {isMarking ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Marking in LUXE DBASE…</>
              ) : (
                <>Mark {duplicateListings.length} Duplicate{duplicateListings.length !== 1 ? "s" : ""} &amp; Continue <ChevronRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

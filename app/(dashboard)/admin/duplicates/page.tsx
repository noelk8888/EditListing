"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Search, CheckCircle2, AlertCircle, ExternalLink, Copy } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function DuplicatesPage() {
  const { toast } = useToast();
  const [sheetUrl, setSheetUrl] = useState("https://docs.google.com/spreadsheets/d/12Z8X3RmYRBMiihsxf-J0f650Ifj2irxRQsYC64Cgbw0/edit");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    duplicateCount: number;
    tabName?: string;
    outputUrl?: string;
    photoMatchCount?: number;
    fuzzyMatchCount?: number;
    message?: string;
    groups?: any[];
    spreadsheetId?: string;
  } | null>(null);

  const runCheck = async (scanMode: "content" | "geoid") => {
    if (!sheetUrl) {
      toast({
        variant: "destructive",
        title: "Missing URL",
        description: "Please provide a Google Sheets URL.",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl, mode: scanMode }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to run duplicate check");

      setResult(data);
      if (data.duplicateCount > 0) {
        toast({
          title: "Check Complete",
          description: `Found ${data.duplicateCount} duplicate/collision groups. New tab "${data.tabName}" created.`,
        });
      } else {
        toast({
          title: "No Duplicates",
          description: "Sheet1 is clean!",
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-4xl py-10 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Duplicate Gsheet</h1>
        <p className="text-muted-foreground">
          Scan Sheet1 for duplicate properties using photo links and fuzzy text matching.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Source Spreadsheet</CardTitle>
          <CardDescription>
            Enter the URL of the Google Sheet you want to scan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sheetUrl">Google Sheets URL</Label>
            <div className="space-y-4">
              <Input
                id="sheetUrl"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                disabled={loading}
                className="w-full"
              />
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => runCheck("content")} disabled={loading} className="flex-1 bg-purple-600 hover:bg-purple-700">
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Scan Content Duplicates
                </Button>
                <Button onClick={() => runCheck("geoid")} disabled={loading} variant="outline" className="flex-1 border-purple-500 text-purple-700 hover:bg-purple-50">
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  Scan GEO ID Collisions
                </Button>
              </div>
            </div>
          </div>

          {result && (
            <div className={`p-4 rounded-lg border ${result.duplicateCount > 0 ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200"}`}>
              <div className="flex items-start gap-3">
                {result.duplicateCount > 0 ? (
                  <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                )}
                <div className="space-y-1 w-full">
                  <p className={`font-semibold ${result.duplicateCount > 0 ? "text-orange-900" : "text-green-900"}`}>
                    {result.duplicateCount > 0 
                      ? `Found ${result.duplicateCount} collision/duplicate groups!` 
                      : "No duplicates found!"}
                  </p>
                  {result.duplicateCount > 0 && (
                    <>
                      <div className="text-sm text-orange-800 space-y-1">
                        <p>Results have been written to a new tab: <strong>{result.tabName}</strong></p>
                        {result.photoMatchCount !== undefined && result.fuzzyMatchCount !== undefined && (
                          <div className="flex gap-4 pt-1">
                            {result.photoMatchCount > 0 && <span>📸 Photo Matches: {result.photoMatchCount}</span>}
                            {result.fuzzyMatchCount > 0 && <span>📜 Fuzzy Matches: {result.fuzzyMatchCount}</span>}
                          </div>
                        )}
                      </div>
                      <div className="pt-3 flex gap-2">
                        <Button 
                          onClick={() => {
                            localStorage.setItem(
                              "luxe_dup_review_data",
                              JSON.stringify({
                                groups: result.groups,
                                spreadsheetId: result.spreadsheetId,
                                summary: {
                                  photoMatchCount: result.photoMatchCount || 0,
                                  fuzzyMatchCount: result.fuzzyMatchCount || 0,
                                  tabName: result.tabName,
                                  outputUrl: result.outputUrl,
                                },
                              })
                            );
                            window.open("/admin/duplicates/review", "_blank");
                          }}
                          className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
                          size="sm"
                        >
                          Launch Side-by-Side Review
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a href={result.outputUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-3 w-3" />
                            Open Spreadsheet
                          </a>
                        </Button>
                      </div>
                    </>
                  )}
                  {result.message && <p className="text-sm text-green-800">{result.message}</p>}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="p-1 bg-blue-100 rounded text-blue-700"><Search className="h-4 w-4" /></span>
              How it works
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. <strong>Photo Link:</strong> First, it compares the unique "slug" in the photo links (Col AB). If two rows have the same photo, they are a match.</p>
            <p>2. <strong>Fuzzy Text:</strong> For rows without photos, it analyzes the listing text (Col A) and looks for an 80% match on significant lines.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="p-1 bg-purple-100 rounded text-purple-700"><Copy className="h-4 w-4" /></span>
              Output Format
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>A new tab is created in your spreadsheet with:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>GEO ID(s) (Col A)</li>
              <li>Source Row Numbers (Col B)</li>
              <li>Sample Listing Text (Col C)</li>
              <li>Match Type (Col D)</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

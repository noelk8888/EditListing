"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Search, CheckCircle2, AlertCircle, ExternalLink, ShieldCheck, Copy, Database } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function CrossCheckPage() {
  const { toast } = useToast();
  const [sourceUrl, setSourceUrl] = useState("https://docs.google.com/spreadsheets/d/12Z8X3RmYRBMiihsxf-J0f650Ifj2irxRQsYC64Cgbw0/edit#gid=498307951");
  const [targetUrl, setTargetUrl] = useState("https://docs.google.com/spreadsheets/d/12Z8X3RmYRBMiihsxf-J0f650Ifj2irxRQsYC64Cgbw0/edit#gid=1361278820");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    count: number;
    tabName?: string;
    outputUrl?: string;
    photoMatchCount?: number;
    fuzzyMatchCount?: number;
    message?: string;
  } | null>(null);

  const runCrossCheck = async () => {
    if (!sourceUrl || !targetUrl) {
      toast({
        variant: "destructive",
        title: "Missing URLs",
        description: "Please provide both Source and Target URLs.",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/cross-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl, targetUrl }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to run cross-check");

      setResult(data);
      if (data.count > 0) {
        toast({
          title: "Cross-Check Complete",
          description: `Found ${data.count} matches from Source present in Target.`,
        });
      } else {
        toast({
          title: "Clean Result",
          description: "No items from the Source were found in the Target tab.",
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
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-blue-600" />
          CROSS CHECK
        </h1>
        <p className="text-muted-foreground">
          Find which listings from the <strong>Source</strong> tab are already present in the <strong>Target</strong> tab (using photos and text).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-t-4 border-t-blue-600">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Check for presence of Source listings within the Target spreadsheet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="sourceUrl" className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5" />
                Source (Tab A - The list to check)
              </Label>
              <Input
                id="sourceUrl"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetUrl" className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5" />
                Target (Tab B - The existing inventory)
              </Label>
              <Input
                id="targetUrl"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button onClick={runCrossCheck} disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning Target for Source Listings...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Run Cross-Check
                </>
              )}
            </Button>

            {result && (
              <div className={`p-5 rounded-lg border ${result.count > 0 ? "bg-blue-50 border-blue-200" : "bg-emerald-50 border-emerald-200"}`}>
                <div className="flex items-start gap-4">
                  {result.count > 0 ? (
                    <AlertCircle className="h-6 w-6 text-blue-600 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 mt-0.5" />
                  )}
                  <div className="space-y-3 flex-1">
                    <p className={`font-bold text-lg ${result.count > 0 ? "text-blue-900" : "text-emerald-900"}`}>
                      {result.count > 0 
                        ? `Detected ${result.count} existing listings!` 
                        : "No duplicates found in Target!"}
                    </p>
                    {result.count > 0 && (
                      <>
                        <div className="text-sm text-blue-800 bg-white/60 p-3 rounded border border-blue-100 space-y-2">
                          <p>A detailed report of matching listings has been created on the **Target** spreadsheet in a new tab: <strong>{result.tabName}</strong></p>
                          <div className="flex gap-4 pt-1 font-semibold">
                            <span>📸 Photo Matches: {result.photoMatchCount}</span>
                            <span>📜 Text Matches: {result.fuzzyMatchCount}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button variant="outline" size="sm" asChild className="bg-white hover:bg-blue-100 w-fit">
                            <a href={result.outputUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open Target Spreadsheet
                            </a>
                          </Button>
                          <div className="flex flex-col gap-1">
                             <p className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">Result URL:</p>
                             <p className="text-xs break-all font-mono text-blue-800 bg-blue-100/30 p-2 rounded border border-blue-100 select-all cursor-text leading-tight">
                               {result.outputUrl}
                             </p>
                          </div>
                        </div>
                      </>
                    )}
                    {result.message && <p className="text-sm text-emerald-800 font-medium">{result.message}</p>}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4 text-orange-500" />
              Global Matching
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>Unlike "Compare Sheets" which checks row-by-row, <strong>CROSS CHECK</strong> scans the entire Target tab to find any match, regardless of row position.</p>
            <p>It uses both <strong>Photo Link Slugs</strong> (Col AB) and <strong>Listing Text</strong> (Col A) fuzzy matching to ensure 99% accuracy.</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Copy className="h-4 w-4 text-blue-500" />
              Reporting
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>All items found in Target are listed in a new tab with their original Source row and the corresponding Target GEO ID.</p>
            <p>Items NOT found in Target are safe to be added as New Listings.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

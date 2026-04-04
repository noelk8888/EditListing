"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Scale, CheckCircle2, AlertCircle, ExternalLink, Diff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function CompareSheetsPage() {
  const { toast } = useToast();
  const [url1, setUrl1] = useState("https://docs.google.com/spreadsheets/d/1T-LUc3cKn0ojq1p3VvgpFs4NzB8Z6ZKV4iJaoEhfwKM/edit");
  const [url2, setUrl2] = useState("https://docs.google.com/spreadsheets/d/12Z8X3RmYRBMiihsxf-J0f650Ifj2irxRQsYC64Cgbw0/edit");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    diffCount: number;
    tabName?: string;
    outputUrl?: string;
    message?: string;
  } | null>(null);

  const runComparison = async () => {
    if (!url1 || !url2) {
      toast({
        variant: "destructive",
        title: "Missing URLs",
        description: "Please provide both Google Sheets URLs.",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/compare-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url1, url2 }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to compare sheets");

      setResult(data);
      if (data.diffCount > 0) {
        toast({
          title: "Comparison Complete",
          description: `Found ${data.diffCount} differences. New tab "${data.tabName}" created on GSheet 2.`,
        });
      } else {
        toast({
          title: "Comparison Complete",
          description: "Sheets are virtually identical (ignoring status)!",
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
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Compare Sheets</h1>
        <p className="text-muted-foreground">
          Compare row-by-row listings between two spreadsheets while ignoring status changes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Spreadsheet Configuration</CardTitle>
            <CardDescription>
              Enter the URLs of the two spreadsheets you want to compare.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="url1">GSheet 1 (Reference)</Label>
              <Input
                id="url1"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={url1}
                onChange={(e) => setUrl1(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url2">GSheet 2 (Target & Output)</Label>
              <Input
                id="url2"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={url2}
                onChange={(e) => setUrl2(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground italic">
                *The results tab will be created here.
              </p>
            </div>

            <Button onClick={runComparison} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Comparing Rows...
                </>
              ) : (
                <>
                  <Scale className="mr-2 h-4 w-4" />
                  Run Comparison
                </>
              )}
            </Button>

            {result && (
              <div className={`p-4 rounded-lg border ${result.diffCount > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
                <div className="flex items-start gap-3">
                  {result.diffCount > 0 ? (
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                  )}
                  <div className="space-y-2">
                    <p className={`font-semibold ${result.diffCount > 0 ? "text-amber-900" : "text-emerald-900"}`}>
                      {result.diffCount > 0 
                        ? `Detected ${result.diffCount} differences!` 
                        : "Sheets match (ignoring status)!"}
                    </p>
                    {result.diffCount > 0 && (
                      <>
                        <div className="text-sm text-amber-800">
                          <p>A comparison report has been generated in a new tab: <strong>{result.tabName}</strong></p>
                        </div>
                        <Button variant="outline" size="sm" asChild className="bg-white hover:bg-amber-100">
                          <a href={result.outputUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-3 w-3" />
                            Open GSheet 2 Results
                          </a>
                        </Button>
                      </>
                    )}
                    {result.message && <p className="text-sm text-emerald-800">{result.message}</p>}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Diff className="h-4 w-4 text-blue-500" />
              Comparison Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>1. <strong>Identical Rows:</strong> If two rows are perfectly identical (or only the status like FOR SALE vs SOLD changed), they are ignored.</p>
            <p>2. <strong>Photo Link Match:</strong> If the photo link (goo.gl) is the same but the text differs, it's flagged as <code>FOR MANUAL CHECKING</code>.</p>
            <p>3. <strong>Geo ID:</strong> The output will include Geo IDs from Col AC from both sheets for easy tracking.</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4 text-amber-500" />
              Output Tab
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>A new tab named <strong>Comparison - [Date]</strong> will be created on GSheet 2 with the following columns:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Row #</li>
              <li>GEO ID (G1 & G2)</li>
              <li>Col A (Gsheet1 & Gsheet2)</li>
              <li>Notes (Status of difference)</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

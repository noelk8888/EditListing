"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, ClipboardPaste } from "lucide-react";
import { ParsedListing } from "@/types/listing";

interface ListingParserProps {
  onParsed: (listing: ParsedListing) => void;
}

export function ListingParser({ onParsed }: ListingParserProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!text.trim()) {
      setError("Please enter a listing to parse");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error("Failed to parse listing");
      }

      const data = await response.json();
      onParsed(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse listing");
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      setText(clipboardText);
    } catch (err) {
      setError("Failed to read from clipboard");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI-Powered Listing Parser
        </CardTitle>
        <CardDescription>
          Paste your raw property listing below and let AI extract all the details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Textarea
            placeholder={`*FOR SALE*
P. Dela Cruz St., Sitio Gitna Brgy. Nagkaisang Nayon, Quezon City
Lot Area: 15,430 sqm
Price: P617,200,000 (P40k/sqm) gross negotiable
Direct to owner
Photos: https://photos.app.goo.gl/example`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="resize-none font-mono text-sm"
          />
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2"
            onClick={handlePaste}
            type="button"
          >
            <ClipboardPaste className="h-4 w-4 mr-1" />
            Paste
          </Button>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setText("");
              setError(null);
            }}
            disabled={loading}
          >
            Clear
          </Button>
          <Button onClick={handleParse} disabled={loading || !text.trim()}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Parsing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Extract Data
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

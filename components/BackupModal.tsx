"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Database, ExternalLink, AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BackupModal({ isOpen, onClose }: BackupModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ name: string; url: string; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunBackup = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create backup");
      }

      setResult(data.backup);
      toast({
        title: "Backup Created",
        description: `Successfully backed up to ${data.backup.name}`,
      });
    } catch (err: any) {
      console.error("Backup Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isApiDisabled = error?.toLowerCase().includes("google drive api") || 
                        error?.toLowerCase().includes("disabled");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "ID copied to clipboard",
    });
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Database className="h-5 w-5 text-blue-600" />
            Backup Management
          </DialogTitle>
          <DialogDescription>
            Create a full snapshot of your working Google Sheet for safety and redundancy.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {!result && !error && (
            <div className="text-center space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">
                  Running a backup will clone the current listings spreadsheet into the Service Account's Google Drive. 
                  The new file will be named with today's date.
                </p>
              </div>
              <Button 
                onClick={handleRunBackup} 
                className="w-full h-12 text-lg shadow-sm"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Clone...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-5 w-5" />
                    Run Backup Now
                  </>
                )}
              </Button>
            </div>
          )}

          {error && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-900">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="font-bold">Backup Failed</h4>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>

              {isApiDisabled && (
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 space-y-3">
                  <h4 className="font-bold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    How to fix this:
                  </h4>
                  <ol className="text-sm list-decimal list-inside space-y-2 opacity-90">
                    <li>Visit the Google Cloud Console using the link below.</li>
                    <li>Click the <strong>ENABLE</strong> button.</li>
                    <li>Wait ~1 minute and try the backup again.</li>
                  </ol>
                  <Button 
                    variant="outline" 
                    className="w-full bg-white border-blue-300 hover:bg-blue-100" 
                    asChild
                  >
                    <a 
                      href="https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=812891541856" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Go to Google Cloud Console
                    </a>
                  </Button>
                </div>
              )}
              
              <Button variant="ghost" onClick={() => setError(null)} className="w-full">
                Try Again
              </Button>
            </div>
          )}

          {result && (
            <div className="w-full max-w-full space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="w-full max-w-full flex items-start gap-3 p-4 rounded-lg bg-green-50 border border-green-200 text-green-900 overflow-hidden">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold truncate" title={result.name}>{result.name}</h4>
                  <p className="text-sm mt-1 opacity-80">Your Parallel syncs are now secure.</p>
                  
                  <div className="mt-4 p-3 bg-white/50 rounded border border-green-200 space-y-2">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-green-700">BACKUP GSHEET LINK</p>
                    <div className="flex items-center gap-2 w-full max-w-full">
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <code className="block text-[11px] bg-white px-2 py-1.5 rounded border overflow-hidden text-ellipsis whitespace-nowrap font-mono w-full">
                          {result.url}
                        </code>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-green-100 shrink-0" 
                        onClick={() => copyToClipboard(result.url)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" asChild>
                  <a href={result.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Sheet
                  </a>
                </Button>
                <Button className="flex-1" onClick={handleClose}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="sm:justify-start">
          <p className="text-[10px] text-muted-foreground">
            Backups provide critical redundancy. It is recommended to run a manual backup after major listing updates.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
import { Loader2, Database, ExternalLink, AlertCircle, CheckCircle2, Copy, Lock, Unlock } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useEffect } from "react";

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BackupModal({ isOpen, onClose }: BackupModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ name: string; url: string; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [destinationUrl, setDestinationUrl] = useState("https://docs.google.com/spreadsheets/d/1_COUN2E42JCCAPk_IEEfiIAOaVOqrknJ-XodBSJg9rU/edit?gid=1307446787#gid=1307446787");
  const [isUrlLocked, setIsUrlLocked] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/admin/backup")
        .then((res) => res.json())
        .then((data) => {
          if (data && data.destination_url) {
            setDestinationUrl(data.destination_url);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  const handleRunBackup = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationUrl })
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

        <div className="py-6 w-full max-w-full overflow-hidden">
          {!result && !error && (
            <div className="text-center space-y-4 w-full">
              <div className="p-4 bg-muted/50 rounded-lg border border-dashed text-left space-y-4">
                <p className="text-sm text-muted-foreground">
                  Running a backup will clone the current listings spreadsheet into the Google Drive - maximum 60 tabs. 
                  The new file will be named with today's date/time.
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Destination URL (LUXE Copy)</label>
                  <div className="flex bg-white border rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-slate-400 transition-shadow">
                    <input 
                      type="text" 
                      value={destinationUrl}
                      onChange={(e) => setDestinationUrl(e.target.value)}
                      disabled={isUrlLocked}
                      className="flex-1 px-3 py-2 text-sm outline-none bg-transparent disabled:opacity-60 disabled:bg-slate-50 disabled:cursor-not-allowed"
                    />
                    <button 
                      type="button"
                      onClick={() => setIsUrlLocked(!isUrlLocked)}
                      className="px-3 bg-slate-100 hover:bg-slate-200 border-l border-slate-200 text-slate-600 transition-colors"
                      title={isUrlLocked ? "Unlock to edit" : "Lock"}
                    >
                      {isUrlLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4 text-amber-600" />}
                    </button>
                  </div>
                  
                  {!isUrlLocked && (
                    <div className="mt-6 p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 space-y-3 shadow-inner">
                      <h4 className="font-bold flex items-center gap-2 text-sm">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        Setting a New Destination?
                      </h4>
                      <p className="text-xs text-blue-800">The automatic backup needs permission to write to your new sheet.</p>
                      <ol className="text-xs list-decimal list-inside space-y-2 text-blue-900/90 ml-1">
                        <li>Open your new Google Sheet in the browser.</li>
                        <li>Click the big <strong>Share</strong> button in the top right corner.</li>
                        <li>Paste the following email address into the "Add people" box:
                            <code className="block mt-2 mb-1 bg-blue-100 border border-blue-200 px-2 py-1.5 rounded select-all font-mono text-blue-800 text-[11px]">
                              geo-id-sync@sync-geo-id.iam.gserviceaccount.com
                            </code>
                        </li>
                        <li>Make sure the role is set to <strong>"Editor"</strong>.</li>
                        <li>Click <strong>Send / Share</strong>.</li>
                      </ol>
                    </div>
                  )}
                </div>
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
            <div className="space-y-4 w-full">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-900">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold">Backup Failed</h4>
                  <p className="text-sm mt-1 break-words">{error}</p>
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
            <div className="grid grid-cols-1 w-full max-w-full space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-400">
              <div className="grid grid-cols-[auto_1fr] gap-3 p-4 rounded-xl bg-green-50/50 border border-green-200 text-green-900 overflow-hidden box-border">
                <div className="pt-0.5">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                </div>
                <div className="min-w-0 w-full overflow-hidden">
                  <h4 className="font-bold truncate text-base" title={result.name}>{result.name}</h4>
                  <p className="text-sm mt-0.5 opacity-80">Your Parallel syncs are now secure.</p>
                  
                  <div className="mt-4 p-3 bg-white/80 rounded-lg border border-green-100 space-y-2 shadow-sm">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-green-700/70">BACKUP GSHEET LINK</p>
                    <div className="grid grid-cols-[1fr_auto] items-center gap-2 w-full">
                      <div className="min-w-0 overflow-hidden">
                        <code className="block text-[11px] bg-white px-2.5 py-2 rounded-md border border-green-100 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-green-800">
                          {result.url}
                        </code>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-green-100 text-green-600 shrink-0" 
                        onClick={() => copyToClipboard(result.url)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button variant="outline" className="w-full border-green-200 hover:bg-green-50 text-green-700" asChild>
                  <a href={result.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Sheet
                  </a>
                </Button>
                <Button className="w-full bg-slate-900 hover:bg-slate-800" onClick={handleClose}>
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

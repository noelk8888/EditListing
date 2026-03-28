"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Database, Download, History, Loader2, ShieldCheck } from "lucide-react";

export default function BackupPage() {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const { toast } = useToast();

  const handleManualBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to create backup");

      toast({
        title: "Backup Successful",
        description: data.message,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Backup Failed",
        description: err.message,
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Backup Management</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Manual Backup
            </CardTitle>
            <CardDescription>
              Create an immediate copy of the Google Sheet for safety.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will create a full duplicate of the listings spreadsheet in your Google Drive, 
              named with today's date.
            </p>
            <Button 
              onClick={handleManualBackup} 
              disabled={isBackingUp}
              className="w-full sm:w-auto"
            >
              {isBackingUp ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Backup...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  Backup Now
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Automated Backups
            </CardTitle>
            <CardDescription>
              Automatic daily redundancy schedule.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/50">
              <ShieldCheck className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900">Daily Cron Active</p>
                <p className="text-xs text-green-700">
                  The system is configured to perform a full backup every day at midnight (Asia/Manila time).
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic">
              * Note: Backups are stored in the Google Drive associated with the Service Account.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

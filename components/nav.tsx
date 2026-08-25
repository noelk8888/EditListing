"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Plus, LogOut, Users, ShieldCheck, Sun, Moon, Database, Send, Copy, Scale, SearchCheck, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_VERSION } from "@/lib/version";
import { BackupModal } from "@/components/BackupModal";
import { DuplicatesModal } from "@/components/DuplicatesModal";

interface NavProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
  };
  permissions?: Record<string, boolean>;
}

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  ADMIN:  { label: "AD", className: "bg-purple-100 text-purple-700" },
  EDITOR: { label: "ED", className: "bg-green-100 text-green-700" },
};

export function Nav({ user, permissions }: NavProps) {
  const pathname = usePathname();
  const role = user?.role || "";
  const { theme, setTheme } = useTheme();
  const isAdmin = role === "SUPERADMIN" || role === "ADMIN";
  const isSuperAdmin = role === "SUPERADMIN";
  const canBackup = isAdmin || role === "EDITOR";
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isDuplicatesOpen, setIsDuplicatesOpen] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);

  useEffect(() => {
    if (canBackup) {
      const fetchBackupState = async () => {
        try {
          const res = await fetch("/api/admin/backup");
          if (res.ok) {
            const data = await res.json();
            if (data.last_backup_at) {
              setLastBackupAt(data.last_backup_at);
            }
          }
        } catch (e) {
          console.error("Failed to fetch backup state:", e);
        }
      };

      fetchBackupState();
      const interval = setInterval(fetchBackupState, 5 * 60 * 1000); // Poll every 5 minutes
      return () => clearInterval(interval);
    }
  }, [canBackup]);

  const isBackupUrgent = () => {
    if (!lastBackupAt) return true; // If no record, assume urgent
    const lastBackupTime = new Date(lastBackupAt).getTime();
    const sixHours = 6 * 60 * 60 * 1000;
    return Date.now() - lastBackupTime > sixHours;
  };

  const links = [
    { href: "/add", label: "Add Listing", icon: Plus },
    ...(isAdmin
      ? [
          { href: "/admin/users", label: "Users", icon: Users },
        ]
      : []),
    ...(permissions?.manage_ownership
      ? [
          { href: "/admin/ownership", label: "Ownership", icon: UserCheck },
        ]
      : []),
    ...(isAdmin
      ? [
          { href: "/admin/duplicates/declare", label: "Duplicate Tagging", icon: Copy }
        ]
      : []),
  ];

  const superAdminFooterLinks = [
    { href: "/admin/permissions", label: "Permissions", icon: ShieldCheck },
    { href: "/admin/groups", label: "Telegram Hub", icon: Send },
    { href: "/admin/duplicates", label: "Duplicate Gsheet", icon: Copy },
    {
      label: "Duplicate App",
      icon: Copy,
      onClick: () => setIsDuplicatesOpen(true),
    },
    { href: "/admin/compare-sheets", label: "Compare Sheets", icon: Scale },
    { href: "/admin/cross-check", label: "Cross Check", icon: SearchCheck },
    { href: "/admin/format-rows", label: "Format Rows", icon: Copy },
  ];

  const badge = ROLE_BADGE[role];

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Row 1: Logo & Title Centered & 50% Bigger */}
        <div className="container flex items-center justify-center px-4 py-3 sm:py-5">
          <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-4">
            <div className="flex items-center justify-center overflow-hidden">
              <img src="/luxe-branding.png" alt="Luxe Logo" className="h-10 w-10 object-contain sm:h-16 sm:w-16" />
            </div>
            <span className="min-w-0 text-center text-base font-extrabold leading-tight tracking-tight text-foreground sm:text-2xl">
              Luxe Realty and Development Corporation
            </span>
            <span className="hidden self-end mb-1.5 font-mono text-xs text-muted-foreground sm:inline">{APP_VERSION}</span>
          </Link>
        </div>

        {/* Row 2: Sub-navigation & Backup as Pills (Left) + Theme Toggle & User Info (Right) */}
        <div className="border-t bg-muted/20 py-2.5">
          <div className="container flex flex-col gap-3 px-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
            <nav className="flex w-full gap-2 overflow-x-auto pb-1 text-sm font-medium sm:w-auto sm:flex-wrap sm:overflow-visible sm:pb-0 hide-scrollbar">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-all shadow-sm",
                      isActive
                        ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                        : "bg-background text-muted-foreground border-muted-foreground/20 hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {link.label}
                  </Link>
                );
              })}

              {/* Backup Modal Trigger */}
              {canBackup && (
                <button
                  onClick={() => setIsBackupOpen(true)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-all shadow-sm",
                    isBackupUrgent()
                      ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50"
                      : "bg-background text-muted-foreground border-muted-foreground/20 hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Database className="h-3.5 w-3.5" />
                  {lastBackupAt ? (
                    (() => {
                      const dt = new Date(lastBackupAt);
                      const mmm = dt.toLocaleString('en-US', { month: 'short' });
                      const dd = dt.toLocaleString('en-US', { day: '2-digit' });
                      const time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
                      return `Backup (last backup - ${mmm}-${dd}-${time})`;
                    })()
                  ) : "Backup"}
                </button>
              )}
            </nav>

            <div className="flex w-full items-center justify-between sm:w-auto sm:justify-start sm:space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                title="Toggle dark mode"
                className="h-10 w-10 rounded-full px-0 sm:h-8 sm:w-8"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              {user && (
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-2">
                    {badge && (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                    )}
                    <span className="max-w-[12rem] truncate text-xs text-muted-foreground sm:max-w-none sm:text-sm">{user.email}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="h-10 rounded-full border border-border bg-background px-3 text-xs hover:bg-accent hover:text-foreground sm:h-8"
                  >
                    <LogOut className="h-3.5 w-3.5 mr-1.5" />
                    Sign Out
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <BackupModal isOpen={isBackupOpen} onClose={() => setIsBackupOpen(false)} onBackupSuccess={(at) => setLastBackupAt(at)} />
        <DuplicatesModal isOpen={isDuplicatesOpen} onClose={() => setIsDuplicatesOpen(false)} />
      </header>

      {/* SUPERADMIN-only sticky footer */}
      {isSuperAdmin && (
        <footer className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-12 items-center justify-start gap-5 overflow-x-auto whitespace-nowrap px-4 sm:h-11 sm:justify-center sm:gap-6 hide-scrollbar">
            {superAdminFooterLinks.map((link) => {
              const Icon = link.icon;
              if (link.onClick) {
                return (
                  <button
                    key={link.label}
                    onClick={link.onClick}
                    className="flex shrink-0 items-center gap-2 text-sm font-medium transition-colors text-foreground/60 hover:text-foreground/80"
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </button>
                );
              }
              return (
                <Link
                  key={link.href}
                  href={link.href!}
                  className={cn(
                    "flex shrink-0 items-center gap-2 text-sm font-medium transition-colors hover:text-foreground/80",
                    pathname === link.href || pathname.startsWith(link.href + "/")
                      ? "text-foreground"
                      : "text-foreground/60"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </footer>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Plus, LogOut, Users, ShieldCheck, Sun, Moon, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_VERSION } from "@/lib/version";
import { BackupModal } from "@/components/BackupModal";

interface NavProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
  };
}

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  ADMIN:  { label: "AD", className: "bg-purple-100 text-purple-700" },
  EDITOR: { label: "ED", className: "bg-green-100 text-green-700" },
};

export function Nav({ user }: NavProps) {
  const pathname = usePathname();
  const role = user?.role || "";
  const { theme, setTheme } = useTheme();
  const isAdmin = role === "SUPERADMIN" || role === "ADMIN";
  const [isBackupOpen, setIsBackupOpen] = useState(false);

  const links = [
    { href: "/add", label: "Add Listing", icon: Plus },
    ...(isAdmin
      ? [
          { href: "/admin/users", label: "Users", icon: Users },
        ]
      : []),
    ...(role === "SUPERADMIN"
      ? [{ href: "/admin/permissions", label: "Permissions", icon: ShieldCheck }]
      : []),
  ];

  const badge = ROLE_BADGE[role];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-3">
            <div className="flex items-center justify-center overflow-hidden">
              <img src="/luxe-branding.png" alt="Luxe Logo" className="h-10 w-10 object-contain" />
            </div>
            <span className="font-bold text-lg tracking-tight">Luxe Realty and Development Corporation</span>
            <span className="text-xs text-muted-foreground font-mono self-end mb-1">{APP_VERSION}</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 transition-colors hover:text-foreground/80",
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
            
            {/* Backup Modal Trigger (Admin only) */}
            {isAdmin && (
              <button
                onClick={() => setIsBackupOpen(true)}
                className={cn(
                  "flex items-center gap-2 transition-colors hover:text-foreground/80 text-sm font-medium text-foreground/60",
                )}
              >
                <Database className="h-4 w-4" />
                Backup
              </button>
            )}
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title="Toggle dark mode"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {badge && (
                  <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${badge.className}`}>
                    {badge.label}
                  </span>
                )}
                <span className="text-sm text-muted-foreground">{user.email}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </div>

      <BackupModal isOpen={isBackupOpen} onClose={() => setIsBackupOpen(false)} />
    </header>
  );
}

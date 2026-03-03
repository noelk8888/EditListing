"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Building2, Plus, List, LogOut, Users, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_VERSION } from "@/lib/version";

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
  const isAdmin = role === "SUPERADMIN" || role === "ADMIN";

  const links = [
    { href: "/", label: "Dashboard", icon: Building2 },
    { href: "/add", label: "Add Listing", icon: Plus },
    { href: "/listings", label: "All Listings", icon: List },
    ...(isAdmin
      ? [{ href: "/admin/users", label: "Users", icon: Users }]
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
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Building2 className="h-6 w-6" />
            <span className="font-bold">LUXE Listings</span>
            <span className="text-xs text-muted-foreground font-mono">{APP_VERSION}</span>
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
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-4">
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
              <form action="/api/auth/signout" method="POST">
                <Button variant="ghost" size="sm" type="submit">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

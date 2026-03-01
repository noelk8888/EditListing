import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center px-4">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Access Denied</h1>
        <p className="text-muted-foreground text-lg">
          Your Google account is not authorized to access this application.
        </p>
        <p className="text-muted-foreground text-sm">
          Contact an administrator to request access.
        </p>
      </div>
      <Link
        href="/api/auth/signout"
        className="text-sm underline text-muted-foreground hover:text-foreground"
      >
        Sign out
      </Link>
    </div>
  );
}

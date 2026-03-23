import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

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
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <Button
          type="submit"
          variant="outline"
          className="text-muted-foreground hover:text-foreground"
        >
          Sign out
        </Button>
      </form>
    </div>
  );
}

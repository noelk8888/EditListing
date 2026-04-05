import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { getUserPermissions } from "@/lib/permissions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  // Block users who authenticated via Google but are not registered in the system
  if (session.user.role === "UNAUTHORIZED") {
    redirect("/unauthorized");
  }

  const permissions = await getUserPermissions(session.user.email, session.user.role || "EDITOR");

  const isSuperAdmin = session.user.role === "SUPERADMIN";

  return (
    <div className="relative flex min-h-screen flex-col">
      <Nav user={session.user} permissions={permissions} />
      <main className={`flex-1 ${isSuperAdmin ? "pb-16" : ""}`}>
        <div className="container py-6">{children}</div>
      </main>
    </div>
  );
}

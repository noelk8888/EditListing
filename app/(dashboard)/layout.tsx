import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Block users who authenticated via Google but are not registered in the system
  if (session.user.role === "UNAUTHORIZED") {
    redirect("/unauthorized");
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <Nav user={session.user} />
      <main className="flex-1">
        <div className="container py-6">{children}</div>
      </main>
    </div>
  );
}

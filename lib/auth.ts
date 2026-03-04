import NextAuth, { DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { createClient } from "@supabase/supabase-js";

// ── Type augmentation ────────────────────────────────────────────────────────
declare module "next-auth" {
  interface Session {
    user: {
      role: string;
    } & DefaultSession["user"];
  }
  interface JWT {
    role?: string;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function lookupRole(email: string): Promise<string> {
  // Check SA emails from env first (no DB needed)
  const saEmails = (process.env.SUPERADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (saEmails.includes(email.toLowerCase())) {
    return "SUPERADMIN";
  }

  // Look up in app_users table
  const supabase = getSupabase();
  const { data } = await supabase
    .from("app_users")
    .select("role")
    .eq("email", email.toLowerCase())
    .single();

  return data?.role || "UNAUTHORIZED";
}

// ── Auth config ───────────────────────────────────────────────────────────────
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Store role in JWT on first sign-in
    jwt: async ({ token, user }) => {
      if (user?.email) {
        token.role = await lookupRole(user.email);
      }
      return token;
    },
    // Expose role in session
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.role = (token.role as string) || "UNAUTHORIZED";
      }
      return session;
    },
    // Basic auth check — role-based blocking handled in layouts
    authorized: async ({ auth }) => {
      return !!auth;
    },
  },
});

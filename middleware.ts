export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|luxe-branding.png|luxe-favicon.jpg|login|unauthorized).*)"],
};

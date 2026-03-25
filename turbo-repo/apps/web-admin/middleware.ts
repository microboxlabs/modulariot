import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth as authMiddleware } from "@/lib/auth";

const locales = ["en", "es", "pt"];
const defaultLocale = "en";

// Get the preferred locale
function getLocale(request: NextRequest): string {
  // Check Accept-Language header
  const acceptLanguage = request.headers.get("accept-language") || "";

  // Simple language matching
  if (acceptLanguage.includes("es")) return "es";
  if (acceptLanguage.includes("pt")) return "pt";

  return defaultLocale;
}

export default authMiddleware(function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip if it's a static file, API route, or Next.js internal path
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_vercel/") ||
    pathname.includes(".") // This catches all files with extensions (css, js, images, etc.)
  ) {
    return;
  }

  // Skip middleware for root path (coming soon page)
  if (pathname === "/") {
    return;
  }

  // Only handle language routing for alpha-2506 paths
  if (pathname.startsWith("/alpha-2506")) {
    // Check if there is any supported locale in the alpha-2506 pathname
    const pathnameHasLocale = locales.some(
      (locale) =>
        pathname.startsWith(`/alpha-2506/${locale}/`) ||
        pathname === `/alpha-2506/${locale}`,
    );

    if (pathnameHasLocale) return;

    // If accessing /alpha-2506 without language, redirect to default locale
    if (pathname === "/alpha-2506" || pathname === "/alpha-2506/") {
      const locale = getLocale(request);
      request.nextUrl.pathname = `/alpha-2506/${locale}`;
      return NextResponse.redirect(request.nextUrl);
    }
  }

  // For any other paths, let them pass through (will result in 404 if not found)
  return;
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Any file with an extension (images, css, js, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)",
  ],
};

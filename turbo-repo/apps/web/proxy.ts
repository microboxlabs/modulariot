import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const locales = ["en", "es", "pt"];
const defaultLocale = "es";

// Get the preferred locale
function getLocale(request: NextRequest): string {
  // Check Accept-Language header
  const acceptLanguage = request.headers.get("accept-language") || "";

  // Simple language matching
  if (acceptLanguage.includes("es")) return "es";
  if (acceptLanguage.includes("pt")) return "pt";

  return defaultLocale;
}

export function proxy(request: NextRequest) {
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

  // La landing vive en la raíz: `/` negocia idioma y redirige a `/{lang}`.
  if (pathname === "/") {
    request.nextUrl.pathname = `/${getLocale(request)}`;
    return NextResponse.redirect(request.nextUrl);
  }

  // `/{lang}` y `/{lang}/...` ya traen idioma → resuelven en `app/[lang]`.
  const pathnameHasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (pathnameHasLocale) return;

  // Rutas sin idioma (`/privacy`, `/terms`) tienen su propio segmento; el
  // resto cae en 404 (el guardia de `app/[lang]/layout.tsx` lo garantiza).
  return;
}

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

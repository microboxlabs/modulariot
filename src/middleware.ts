import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getLocaleFromHeaders, locales } from "./features/i18n/i18n.service";

export default auth(async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}`) || pathname === `/${locale}`,
  );

  if (pathnameHasLocale) {
    return;
  }

  const locale = getLocaleFromHeaders(request);
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl.toString());
});

export const config = {
  matcher: [
    // Skip all internal paths (_next)
    "/",
    "/((?!api|_next/static|_next/image|.*\\.png$|.*\\.svg$).*)",
    "/app/((?!api|_next/static|_next/image|.*\\.png$|.*\\.svg$).*)",
  ],
};

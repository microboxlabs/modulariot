import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getLocaleFromRequest } from "./features/i18n/i18n.service";
import { locales } from "./features/i18n/tr.service";

export default auth(async function middleware(request: NextRequest) {
  let { pathname } = request.nextUrl;

  if (/^\/[a-z]{0,2}\/{0,1}$/.test(pathname)) {
    pathname = "/shipping";
  }

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}`) || pathname === `/${locale}`,
  );

  if (pathnameHasLocale) {
    return;
  }

  const locale = getLocaleFromRequest(request);
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

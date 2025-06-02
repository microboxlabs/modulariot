import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "./auth";
import { getLocaleFromHeaders } from "./features/i18n/i18n.service";
import { locales } from "./features/i18n/tr.service";
//import { getRoutePermissions } from "@/features/auth/config/route-permissions";
//import type { JWT } from "next-auth/jwt";

/* interface NextRequestWithAuth extends NextRequest {
  nextauth: {
    token: JWT | null;
  };
}

function hasRequiredGroups(
  userGroups: string[] = [],
  requiredGroups: string[],
  operator: "OR" | "AND" = "OR",
): boolean {
  if (!requiredGroups.length) return true;

  return operator === "OR"
    ? requiredGroups.some((group) => userGroups.includes(group))
    : requiredGroups.every((group) => userGroups.includes(group));
} */

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

  const locale = getLocaleFromHeaders(request.headers);
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl.toString());

  /* const token = (req as NextRequestWithAuth)?.nextauth?.token;
    const path = req.nextUrl.pathname;
    const requiredGroups = getRoutePermissions(path);

    if (
      !token ||
      !hasRequiredGroups(token.groups as string[], requiredGroups)
    ) {
      return NextResponse.redirect(new URL(`/`, req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }: { token: JWT | null }) => !!token,
    },*/
});

export const config = {
  matcher: [
    // Skip all internal paths (_next)
    "/",
    "/((?!api|_next/static|_next/image|.*\\.png$|.*\\.svg$|autentia/.*\\.js$).*)",
    "/app/((?!api|_next/static|_next/image|.*\\.png$|.*\\.svg$|autentia/.*\\.js$).*)",
  ],
};

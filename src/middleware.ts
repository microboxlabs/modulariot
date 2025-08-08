import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "./auth";
import { getLocaleFromHeaders } from "./features/i18n/i18n.service";
import { locales } from "./features/i18n/tr.service";
// import { logger } from "./lib/logger";
// import {
//   buildAccessLogFields,
//   generateRequestId,
// } from "@/features/common/utils/access-log";
//import { getRoutePermissions } from "@/features/auth/config/route-permissions";
//import type { JWT } from "next-auth/jwt";

/* interface NextRequestWithAuth extends NextRequest {
  nextauth: {
    token: JWT | null;
  };
} */
/* 

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

// moved to common utils

export default auth(async function middleware(request: NextRequest) {
  // const shouldLog = process.env.LOG_ACCESS === "true";

  let { pathname } = request.nextUrl;

  if (/^\/[a-z]{0,2}\/{0,1}$/.test(pathname)) {
    pathname = "/shipping";
  }

  // const startTime = Date.now();
  // const startedAt = new Date();
  // NextRequest does not expose ip in types; keep best-effort without using `any`
  // const ipHeader = request.headers.get("x-forwarded-for");
  // const ip = ipHeader?.split(",")[0]?.trim() || "-";
  // const method = request.method.toUpperCase();
  // const pathAndQuery =
  //   `${request.nextUrl.pathname}${request.nextUrl.search}` || "/";
  // const userAgent = request.headers.get("user-agent") || "-";
  // const contentLength = "-"; // not available at middleware stage
  // const requestId = request.headers.get("x-request-id") || generateRequestId();

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}`) || pathname === `/${locale}`,
  );

  let response: NextResponse;
  if (pathnameHasLocale) {
    response = NextResponse.next();
  } else {
    const locale = getLocaleFromHeaders(request.headers);
    request.nextUrl.pathname = `/${locale}${pathname}`;
    response = NextResponse.redirect(request.nextUrl.toString());
  }

  // const durationMs = Date.now() - startTime;
  // const status = response.status;

  // if (shouldLog) {
  //   const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
  //   const payload = {
  //     ...buildAccessLogFields({
  //       prefix: "IN",
  //       remoteAddr: ip,
  //       method,
  //       pathAndQuery,
  //       status,
  //       contentLength,
  //       userAgent,
  //       startedAt,
  //       durationMs,
  //       requestId,
  //     }),
  //     context: "middleware",
  //   } as const;

  //   if (level === "error") {
  //     logger.error(payload);
  //   } else if (level === "warn") {
  //     logger.warn(payload);
  //   } else {
  //     logger.info(payload);
  //   }
  // }

  return response;
});

export const config = {
  matcher: [
    // Skip all internal paths (_next)
    "/",
    "/((?!api|_next/static|_next/image|.*\\.png$|.*\\.svg$|autentia/.*\\.js$).*)",
    "/app/((?!api|_next/static|_next/image|.*\\.png$|.*\\.svg$|autentia/.*\\.js$).*)",
  ],
};

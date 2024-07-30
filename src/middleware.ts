import { NextResponse } from "next/server";
import { match } from "@formatjs/intl-localematcher";
import type { NextRequest } from "next/server";
import Negotiator from "negotiator";

const locales = ["en", "es"];
const defaultLocale = "es";

function getLocaleFromHeaders(request: NextRequest) {
  const headers = {
    "accept-language": request.headers.get("accept-language") ?? defaultLocale,
  };
  const languages = new Negotiator({ headers }).languages();
  return match(languages, locales, defaultLocale);
}

// const protectedRoutes = ["/"];
// const unprotectedRoutes = ["/login"];

// import auth from "./pages/api/auth/[...nextauth]/route";

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}`) || pathname === `/${locale}`,
  );

  if (pathnameHasLocale) return;

  const locale = getLocaleFromHeaders(request);
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl.toString());

  //   const session = await auth.auth();

  //   const isProtectedRoute = protectedRoutes.some((prefix) =>
  //     request.nextUrl.pathname.startsWith(prefix)
  //   );

  //   if (!session && isProtectedRoute) {
  //     const absoluteURL = new URL("/", request.nextUrl.origin);
  //     return NextResponse.redirect(absoluteURL.toString());
  //   }
  //   if (session && unprotectedRoutes.includes(request.nextUrl.pathname)) {
  //     const absoluteURL = new URL("/dashboard", request.nextUrl.origin);
  //     return NextResponse.redirect(absoluteURL.toString());
  //   }
}

// export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    // Skip all internal paths (_next)
    "/((?!_next).*)",
  ],
};

import { signIn } from "@/auth";
import { NextResponse } from "next/server";

/**
 * Dev-only helper: starts the Auth0 sign-in flow server-side, bypassing the
 * sign-in page's client components. Useful for the CLI auth handoff E2E,
 * where a browser session with an Auth0 rawJWT is required.
 *
 * Usage: GET /app/dev/auth0?callbackUrl=/app/cli/auth/login?...
 */
export async function GET(request: Request): Promise<NextResponse | void> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const callbackUrl =
    new URL(request.url).searchParams.get("callbackUrl") ?? "/app";
  const redirectTo =
    callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/app";
  // Throws a NEXT_REDIRECT to the Auth0 authorize URL.
  await signIn("auth0", { redirectTo });
}

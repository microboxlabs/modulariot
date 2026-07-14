import { NextResponse } from "next/server";
import { requireAuth } from "../../utils/alfresco-crud-client";

/** Dev-only: returns the current session tokens so you can inspect/copy them.
 *  This route only works in development — returns 404 in production. */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { user } = authResult.session;

  // Raw tokens (accessToken, rawJWT) are only exposed when AUTH_DEV_EXPOSE_TOKENS=true
  // is explicitly set. NODE_ENV=development alone is not sufficient, so shared dev
  // deployments never return bearer tokens by default.
  const exposeTokens = process.env.AUTH_DEV_EXPOSE_TOKENS === "true";

  return NextResponse.json({
    email: user?.email,
    hasAccessToken: !!user?.accessToken,
    hasRawJWT: !!user?.rawJWT,
    hasTicket: !!user?.ticket,
    ...(exposeTokens && {
      accessToken: user?.accessToken ?? null,
      rawJWT: user?.rawJWT ?? null,
    }),
  });
}

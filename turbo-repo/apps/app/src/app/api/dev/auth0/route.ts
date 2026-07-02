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

  return NextResponse.json({
    email: user?.email,
    hasAccessToken: !!user?.accessToken,
    hasRawJWT: !!user?.rawJWT,
    hasTicket: !!user?.ticket,
    accessToken: user?.accessToken ?? null,
    rawJWT: user?.rawJWT ?? null,
  });
}

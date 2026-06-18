import { NextResponse } from "next/server";
import { resolveSiteForRequest } from "@/app/api/utils/org-resolver";
import { exchangeOAuthToken } from "@/app/api/data-sources/resolve-credentials";
import { testPostgrestConnection } from "@/app/api/data-sources/test-connection";
import { TestConnectionSchema } from "@/features/data-sources/types";
import { logger } from "@/lib/logger";

/**
 * Stateless connection test. Tests the connection using the inline form data in
 * the request body, WITHOUT persisting anything — this lets a user validate a
 * provider before saving it. Compare with POST /api/data-sources/{id}/test,
 * which tests the already-persisted (encrypted) config by id.
 */
export async function POST(request: Request) {
  const result = await resolveSiteForRequest(request);
  if (!result.resolved) return result.response;

  try {
    const body = await request.json();
    const parsed = TestConnectionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Resolve the bearer token straight from the submitted form data. TOKEN auth
    // uses the raw token; OAUTH exchanges the raw client secret with no cache
    // (there is no dataSourceId yet).
    let token: string;
    if (data.authMethod === "TOKEN") {
      token = data.token;
    } else {
      try {
        const oauth = await exchangeOAuthToken(
          data.tokenUrl,
          data.clientId,
          data.clientSecret,
          data.scope,
          data.audience,
          data.tokenRequestFormat
        );
        token = oauth.accessToken;
      } catch (err) {
        return NextResponse.json({
          success: false,
          error: err instanceof Error ? err.message : "OAuth token exchange failed",
        });
      }
    }

    const { success, errorMessage } = await testPostgrestConnection(
      data.url,
      token,
      data.authMethod
    );

    return NextResponse.json({
      success,
      ...(errorMessage ? { error: errorMessage } : {}),
    });
  } catch (err) {
    logger.error({ err }, "Stateless data source test route error");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

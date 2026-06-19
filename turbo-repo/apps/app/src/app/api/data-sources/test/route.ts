import { NextResponse } from "next/server";
import { resolveSiteForRequest } from "@/app/api/utils/org-resolver";
import { validateTargetUrl } from "@/app/api/utils/url-validator";
import { exchangeOAuthToken } from "@/app/api/data-sources/resolve-credentials";
import { testPostgrestConnection } from "@/app/api/data-sources/test-connection";
import { TestConnectionSchema } from "@/features/data-sources/types";
import type { TestConnectionInput } from "@/features/data-sources/types";
import { logger } from "@/lib/logger";

type TokenResolution =
  | { ok: true; token: string }
  | { ok: false; response: NextResponse };

/**
 * Resolve the bearer token straight from the submitted form data. TOKEN auth
 * uses the raw token; OAUTH exchanges the raw client secret with no cache
 * (there is no dataSourceId yet). Returns an error response instead of a token
 * when the SSRF guard fails or the exchange throws.
 */
async function resolveToken(data: TestConnectionInput): Promise<TokenResolution> {
  if (data.authMethod === "TOKEN") {
    return { ok: true, token: data.token };
  }

  // SSRF guard: validate the token URL before the exchange, mirroring the
  // by-id path (resolveOAuthToken). data.url is validated in the probe.
  const tokenUrlCheck = await validateTargetUrl(data.tokenUrl);
  if (!tokenUrlCheck.valid) {
    return {
      ok: false,
      response: NextResponse.json({
        success: false,
        error: tokenUrlCheck.reason ?? "Invalid token URL",
      }),
    };
  }

  try {
    const oauth = await exchangeOAuthToken(
      data.tokenUrl,
      data.clientId,
      data.clientSecret,
      data.scope,
      data.audience,
      data.tokenRequestFormat
    );
    return { ok: true, token: oauth.accessToken };
  } catch (err) {
    return {
      ok: false,
      response: NextResponse.json({
        success: false,
        error: err instanceof Error ? err.message : "OAuth token exchange failed",
      }),
    };
  }
}

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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = TestConnectionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const tokenResult = await resolveToken(data);
    if (!tokenResult.ok) return tokenResult.response;

    const { success, errorMessage } = await testPostgrestConnection(
      data.url,
      tokenResult.token,
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

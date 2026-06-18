import { validateTargetUrl } from "@/app/api/utils/url-validator";
import { buildAuthHeader } from "@/app/api/data-sources/resolve-credentials";
import type { AuthMethod } from "@/app/api/data-sources/resolve-credentials";
import { logger } from "@/lib/logger";

/**
 * Probe a PostgREST data source by fetching its OpenAPI spec with the supplied
 * bearer token. Shared by the persisted (by-id) test route and the stateless
 * (inline form data) test route so both behave identically.
 */
export async function testPostgrestConnection(
  url: string,
  token: string,
  authMethod: AuthMethod,
  dataSourceId?: string
): Promise<{ success: boolean; errorMessage?: string }> {
  // Strip any trailing slash before appending one so a url that already ends
  // in "/" doesn't produce a double slash (which breaks the upstream probe).
  const specUrl = `${url.replace(/\/+$/, "")}/`;

  const urlCheck = await validateTargetUrl(specUrl);
  if (!urlCheck.valid) {
    return { success: false, errorMessage: urlCheck.reason };
  }

  try {
    const res = await fetch(specUrl, {
      headers: {
        Accept: "application/openapi+json",
        Authorization: buildAuthHeader(token, authMethod),
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      await res.json();
      return { success: true };
    }
    return { success: false, errorMessage: `HTTP ${res.status}: ${res.statusText}` };
  } catch (err) {
    logger.error({ err, dataSourceId }, "Data source connection test failed");
    return {
      success: false,
      errorMessage: err instanceof Error ? err.message : "Connection test failed",
    };
  }
}

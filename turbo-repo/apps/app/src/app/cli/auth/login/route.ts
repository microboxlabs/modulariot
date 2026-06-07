import { auth } from "@/auth";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { createCliAuthHandoff } from "../handoff-store";
import { getLocaleFromHeaders } from "@/features/i18n/i18n.service";
import { NextResponse } from "next/server";

/**
 * CLI auth handoff endpoint.
 *
 * Implemented as a route handler (not a page): the handoff is pure
 * control flow — validate params, require a session, resolve the org,
 * mint a one-time code, redirect back to the CLI's loopback server —
 * so plain HTTP redirects are all it needs. The previous server-component
 * page delivered its redirect in-stream (HTTP 200 + client transition),
 * which crashed Next 16.2.6's client Router ("Rendered more hooks than
 * during the previous render") and stranded the browser on an error page.
 */

function parseLocalRedirectUri(value: string | null): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const isLoopback =
      url.hostname === "127.0.0.1" ||
      url.hostname === "localhost" ||
      url.hostname === "[::1]" ||
      url.hostname === "::1";
    if (url.protocol !== "http:" || !isLoopback) return null;
    return url;
  } catch {
    return null;
  }
}

function errorRedirect(
  redirectUri: URL,
  state: string,
  message: string
): NextResponse {
  redirectUri.searchParams.set("state", state);
  redirectUri.searchParams.set("error", "access_denied");
  redirectUri.searchParams.set("error_description", message);
  return NextResponse.redirect(redirectUri);
}

const INVALID_REQUEST_HTML = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>ModularIoT CLI</title></head>
  <body style="font-family: system-ui, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; background: #f8fafc; color: #0f172a;">
    <section style="max-width: 28rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; background: #fff; padding: 1.5rem; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);">
      <p style="margin: 0; font-size: 0.875rem; font-weight: 600; color: #2563eb;">ModularIoT CLI</p>
      <h1 style="margin: 0.75rem 0 0; font-size: 1.5rem;">Invalid login request</h1>
      <p style="margin: 0.5rem 0 0; font-size: 0.875rem; color: #475569;">The CLI callback URL or state parameter is missing or invalid.</p>
    </section>
  </body>
</html>`;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const redirectUri = parseLocalRedirectUri(url.searchParams.get("redirect_uri"));
  const state = url.searchParams.get("state");

  if (!redirectUri || !state) {
    return new Response(INVALID_REQUEST_HTML, {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const session = await auth();
  if (!session?.user?.id) {
    const locale = getLocaleFromHeaders(request.headers);
    const callbackUrl = `/cli/auth/login?redirect_uri=${encodeURIComponent(
      redirectUri.toString()
    )}&state=${encodeURIComponent(state)}`;
    // Route handlers redirect with absolute URLs, so the app basePath is
    // included explicitly (pages got it implicitly from the router).
    return NextResponse.redirect(
      new URL(
        `/app/${locale}/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`,
        url.origin
      )
    );
  }

  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) {
    return errorRedirect(
      redirectUri,
      state,
      "Could not resolve active organization."
    );
  }

  const token = session.user.rawJWT ?? session.user.ticket;
  if (!token) {
    return errorRedirect(redirectUri, state, "Current session has no API token.");
  }

  const { code } = createCliAuthHandoff({
    token,
    organizationId: scopeResult.scope.activeOrg.slug,
  });

  redirectUri.searchParams.set("state", state);
  redirectUri.searchParams.set("code", code);
  return NextResponse.redirect(redirectUri);
}

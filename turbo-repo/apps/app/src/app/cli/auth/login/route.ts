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
 * mint a one-time code, hand it back to the CLI — so plain HTTP
 * responses are all it needs. The previous server-component page
 * delivered its redirect in-stream (HTTP 200 + client transition),
 * which crashed Next 16.2.6's client Router ("Rendered more hooks than
 * during the previous render") and stranded the browser on an error page.
 *
 * Two delivery modes, selected by `redirect_uri`:
 *  - Loopback (default): `redirect_uri` is a http://127.0.0.1:<port> URL.
 *    We 307-redirect back to it with the code — the CLI's local server
 *    picks it up automatically.
 *  - Manual (out-of-band): `redirect_uri` is the URN
 *    `urn:ietf:wg:oauth:2.0:oob`. There is no local server to reach (the
 *    CLI runs on a remote/SSH host, or the loopback is blocked), so we
 *    render a page that shows the one-time code for the user to copy and
 *    paste into the waiting CLI prompt.
 */

const OOB_REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob";

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Shared <head> + card styling for the CLI handoff pages — mirrors the
 *  platform sign-in card (system-ui, white/dark card, #2563eb accent). */
const PAGE_STYLE = `<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; padding: 1.5rem; display: flex; align-items: center; justify-content: center; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #f8fafc; color: #0f172a; }
  .card { width: 100%; max-width: 28rem; text-align: center; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; box-shadow: 0 4px 6px rgb(0 0 0 / 0.07), 0 1px 2px rgb(0 0 0 / 0.05); padding: 2.25rem 2rem; }
  .logo { width: 64px; height: 64px; margin: 0 auto 1.25rem; display: block; }
  .brand { margin: 0 0 1.25rem; font-size: 0.8125rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #2563eb; }
  h1 { margin: 0 0 0.5rem; font-size: 1.5rem; font-weight: 700; }
  .lead { margin: 0 0 1.5rem; font-size: 0.9375rem; line-height: 1.55; color: #475569; }
  .code-row { display: flex; gap: 0.5rem; align-items: stretch; }
  code { flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap; text-align: left; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.875rem; padding: 0.7rem 0.85rem; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 0.5rem; color: #0f172a; }
  button { flex: none; cursor: pointer; font: inherit; font-weight: 600; font-size: 0.875rem; padding: 0 1rem; border-radius: 0.5rem; border: 1px solid #2563eb; background: #2563eb; color: #fff; }
  button:active { transform: translateY(1px); }
  .hint { margin: 1.1rem 0 0; font-size: 0.8125rem; color: #64748b; }
  .icon { width: 56px; height: 56px; margin: 0 auto 1.1rem; display: flex; align-items: center; justify-content: center; border-radius: 9999px; background: #fef2f2; color: #e11d48; }
  .icon svg { width: 30px; height: 30px; }
  @media (prefers-color-scheme: dark) {
    body { background: #0b1120; color: #f1f5f9; }
    .card { background: #1f2937; border-color: #374151; box-shadow: 0 6px 16px rgb(0 0 0 / 0.45); }
    .lead { color: #cbd5e1; } .hint { color: #94a3b8; }
    code { background: #0b1120; border-color: #374151; color: #f1f5f9; }
    .icon { background: rgba(225,29,72,0.16); }
  }
</style>`;

function renderManualCodePage(code: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ModularIoT CLI</title>${PAGE_STYLE}</head>
<body>
  <main class="card">
    <img class="logo" src="/app/logo2.svg" alt="" onerror="this.style.display='none'">
    <p class="brand">ModularIoT CLI</p>
    <h1>Almost there</h1>
    <p class="lead">If your terminal didn't continue automatically, copy this code and paste it into your CLI to finish signing in.</p>
    <div class="code-row">
      <code id="code">${escapeHtml(code)}</code>
      <button type="button" id="copy">Copy</button>
    </div>
    <p class="hint">This code can be used once and expires in 5 minutes.</p>
  </main>
  <script>
    document.getElementById("copy").addEventListener("click", function () {
      var text = document.getElementById("code").textContent;
      navigator.clipboard.writeText(text).then(function () {
        var b = document.getElementById("copy");
        b.textContent = "Copied";
        setTimeout(function () { b.textContent = "Copy"; }, 2000);
      });
    });
  </script>
</body>
</html>`;
}

const WARN_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';

function renderManualErrorPage(message: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ModularIoT CLI</title>${PAGE_STYLE}</head>
<body>
  <main class="card">
    <img class="logo" src="/app/logo2.svg" alt="" onerror="this.style.display='none'">
    <div class="icon">${WARN_ICON}</div>
    <h1>Login failed</h1>
    <p class="lead">${escapeHtml(message)}</p>
  </main>
</body>
</html>`;
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

function htmlResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawRedirectUri = url.searchParams.get("redirect_uri");
  const isManual = rawRedirectUri === OOB_REDIRECT_URI;
  const redirectUri = isManual ? null : parseLocalRedirectUri(rawRedirectUri);
  const state = url.searchParams.get("state");

  if ((!isManual && !redirectUri) || !state) {
    return htmlResponse(INVALID_REQUEST_HTML, 400);
  }

  const session = await auth();
  if (!session?.user?.id) {
    const locale = getLocaleFromHeaders(request.headers);
    const callbackUrl = `/cli/auth/login?redirect_uri=${encodeURIComponent(
      rawRedirectUri ?? ""
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
    const message = "Could not resolve active organization.";
    return isManual
      ? htmlResponse(renderManualErrorPage(message), 403)
      : errorRedirect(redirectUri!, state, message);
  }

  const token = session.user.rawJWT ?? session.user.ticket;
  if (!token) {
    const message = "Current session has no API token.";
    return isManual
      ? htmlResponse(renderManualErrorPage(message), 403)
      : errorRedirect(redirectUri!, state, message);
  }

  const { code } = createCliAuthHandoff({
    token,
    organizationId: scopeResult.scope.activeOrg.slug,
    state,
  });

  if (isManual) {
    return htmlResponse(renderManualCodePage(code), 200);
  }

  redirectUri!.searchParams.set("state", state);
  redirectUri!.searchParams.set("code", code);
  return NextResponse.redirect(redirectUri!);
}

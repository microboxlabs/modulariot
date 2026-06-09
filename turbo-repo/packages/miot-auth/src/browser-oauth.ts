/**
 * Shared browser OAuth flow for ModularIoT CLI packages.
 * Supports two paths: platform session handoff (redirect via /app/cli/auth/login)
 * and Auth0 PKCE (when a clientId is supplied).
 * Acquires an access token via a local callback server; never persists it —
 * callers are responsible for storage.
 * Env vars: MIOT_OAUTH_CLIENT_ID, MIOT_OAUTH_AUTHORIZE_URL, MIOT_OAUTH_TOKEN_URL,
 * MIOT_OAUTH_AUDIENCE, MIOT_OAUTH_SCOPE, MIOT_LOGIN_URL.
 */
import crypto from "node:crypto";
import http from "node:http";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { URL } from "node:url";
import { ORG_LOGO_SVG } from "./logo.js";

/** Out-of-band redirect URI (RFC 6749 §section "oob"): tells the platform
 *  handoff to display the one-time code instead of redirecting to a local
 *  server. Used by manual login when no loopback is reachable. */
const OOB_REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob";

/** Reads a one-time code pasted by the user. Prompt + echo go to stderr so
 *  the captured code never pollutes stdout. */
function promptForCode(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  return new Promise((resolve, reject) => {
    rl.question("Paste the code from your browser and press Enter: ", (answer) => {
      rl.close();
      const code = answer.trim();
      if (!code) {
        reject(new Error("No code entered."));
        return;
      }
      resolve(code);
    });
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const CHECK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const WARN_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';

/**
 * Renders a self-contained, branded result page for the CLI loopback server —
 * styled to match the platform sign-in card (system-ui, white/dark card,
 * #2563eb accent) so the post-login screen feels like part of the product.
 * No external assets: works fully offline.
 */
function renderCliPage(opts: {
  status: "success" | "error";
  title: string;
  message: string;
}): string {
  const isSuccess = opts.status === "success";
  const icon = isSuccess ? CHECK_ICON : WARN_ICON;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ModularIoT CLI</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; padding: 1.5rem;
    display: flex; align-items: center; justify-content: center;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: #f8fafc; color: #0f172a;
  }
  .card {
    width: 100%; max-width: 26rem; text-align: center;
    background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem;
    box-shadow: 0 4px 6px rgb(0 0 0 / 0.07), 0 1px 2px rgb(0 0 0 / 0.05);
    padding: 2.25rem 2rem;
  }
  .logo { margin: 0 auto 1.25rem; width: 64px; height: 64px; }
  .logo svg { display: block; width: 64px; height: 64px; }
  .brand { margin: 0 0 1.5rem; font-size: 0.8125rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #2563eb; }
  .icon { width: 56px; height: 56px; margin: 0 auto 1.1rem; display: flex; align-items: center; justify-content: center; border-radius: 9999px; }
  .icon svg { width: 30px; height: 30px; }
  .icon.success { background: #ecfdf5; color: #059669; }
  .icon.error { background: #fef2f2; color: #e11d48; }
  h1 { margin: 0 0 0.5rem; font-size: 1.5rem; font-weight: 700; }
  p { margin: 0; font-size: 0.9375rem; line-height: 1.55; color: #475569; }
  @media (prefers-color-scheme: dark) {
    body { background: #0b1120; color: #f1f5f9; }
    .card { background: #1f2937; border-color: #374151; box-shadow: 0 6px 16px rgb(0 0 0 / 0.45); }
    p { color: #cbd5e1; }
    .icon.success { background: rgba(5,150,105,0.16); }
    .icon.error { background: rgba(225,29,72,0.16); }
  }
</style>
</head>
<body>
  <main class="card">
    <div class="logo">${ORG_LOGO_SVG}</div>
    <div class="icon ${opts.status}">${icon}</div>
    <h1>${escapeHtml(opts.title)}</h1>
    <p>${escapeHtml(opts.message)}</p>
  </main>
</body>
</html>`;
}

export interface BrowserLoginOptions {
  baseUrl: string;
  loginUrl?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  clientId?: string;
  audience?: string;
  scope?: string;
  organizationId?: string;
  callbackHost?: string;
  callbackPort?: number;
  timeoutSeconds?: number;
  openBrowser?: boolean;
  /** Out-of-band login: skip the local loopback server and instead prompt
   *  for a code the user copies from the browser. For remote/SSH hosts or
   *  when the browser can't reach 127.0.0.1. Platform login only. */
  manual?: boolean;
}

export interface BrowserLoginResult {
  /** The Auth0 access token to send as `Authorization: Bearer …`. */
  accessToken: string;
  baseUrl: string;
  /** Org slug resolved by the platform handoff (activeOrg.slug). */
  organizationId?: string;
  expiresIn?: number;
  scope?: string;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  organization_id?: string;
  organizationId?: string;
  error?: string;
  error_description?: string;
}

interface CallbackPayload {
  code?: string;
  accessToken?: string;
  organizationId?: string;
  expiresIn?: number;
  scope?: string;
}

function base64Url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomBase64Url(byteLength = 32): string {
  return base64Url(crypto.randomBytes(byteLength));
}

function buildDefaultUrl(baseUrl: string, pathname: string): string {
  return new URL(
    pathname,
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
  ).toString();
}

function openUrl(url: string): Promise<boolean> {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });
    child.once("error", () => resolve(false));
    child.once("spawn", () => {
      child.unref();
      resolve(true);
    });
  });
}

function createCallbackServer(options: {
  host: string;
  port: number;
  state: string;
  timeoutSeconds: number;
}): Promise<{
  redirectUri: string;
  waitForCallback: Promise<CallbackPayload>;
  close: () => void;
}> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let listening = false;
    let ready = false;
    let timer: NodeJS.Timeout | undefined;

    const waitForCallback = new Promise<CallbackPayload>(
      (resolveCallback, rejectCallback) => {
        const server = http.createServer((req, res) => {
          try {
            const requestUrl = new URL(req.url ?? "/", `http://${options.host}`);
            if (requestUrl.pathname !== "/callback") {
              res.writeHead(404);
              res.end("Not found");
              return;
            }

            const error = requestUrl.searchParams.get("error");
            if (error) {
              throw new Error(
                requestUrl.searchParams.get("error_description") ?? error,
              );
            }

            const returnedState = requestUrl.searchParams.get("state");
            if (returnedState !== options.state) {
              throw new Error("OAuth callback state did not match.");
            }

            const code = requestUrl.searchParams.get("code") ?? undefined;
            const accessToken =
              requestUrl.searchParams.get("access_token") ??
              requestUrl.searchParams.get("token") ??
              undefined;
            if (!code && !accessToken) {
              throw new Error(
                "Login callback did not include a token or authorization code.",
              );
            }

            res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
            res.end(
              renderCliPage({
                status: "success",
                title: "Login complete",
                message:
                  "You're signed in. You can close this tab and return to your terminal.",
              }),
            );
            settled = true;
            server.close();
            resolveCallback({
              ...(code !== undefined && { code }),
              ...(accessToken !== undefined && { accessToken }),
              ...(requestUrl.searchParams.get("organization_id") !== null && {
                organizationId: requestUrl.searchParams.get("organization_id")!,
              }),
              ...(requestUrl.searchParams.get("organizationId") !== null && {
                organizationId: requestUrl.searchParams.get("organizationId")!,
              }),
              ...(requestUrl.searchParams.get("expires_in") !== null && {
                expiresIn: Number.parseInt(
                  requestUrl.searchParams.get("expires_in")!,
                  10,
                ),
              }),
              ...(requestUrl.searchParams.get("scope") !== null && {
                scope: requestUrl.searchParams.get("scope")!,
              }),
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("Login callback error:", message);
            res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
            res.end(
              renderCliPage({
                status: "error",
                title: "Login failed",
                message: `${message} — check your terminal for details.`,
              }),
            );
            settled = true;
            server.close();
            rejectCallback(err);
          }
        });

        timer = setTimeout(() => {
          settled = true;
          server.close();
          rejectCallback(
            new Error(
              "Timed out waiting for the browser login callback. If you're on " +
                "a remote/SSH host or the browser can't reach this machine, " +
                "re-run with --manual to paste a code instead.",
            ),
          );
        }, options.timeoutSeconds * 1000);

        server.on("close", () => {
          listening = false;
          if (timer) clearTimeout(timer);
        });
        server.on("error", (err) => {
          if (!settled) {
            settled = true;
            if (ready) {
              rejectCallback(err);
            } else {
              reject(err);
            }
          }
        });
        server.listen(options.port, options.host, () => {
          listening = true;
          ready = true;
          resolve({
            redirectUri: `http://${options.host}:${addressPort(server)}/callback`,
            waitForCallback,
            close: () => {
              if (listening) {
                server.close();
              }
            },
          });
        });
      },
    );

    waitForCallback.catch(() => {
      // The caller awaits this promise; this handler prevents an early
      // unhandled rejection before the browser is opened.
    });
  });
}

export function buildPlatformLoginUrl(options: {
  loginUrl: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(options.loginUrl);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("state", options.state);
  return url.toString();
}

export function buildAuthorizationUrl(options: {
  authorizationUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  audience?: string;
}): string {
  const url = new URL(options.authorizationUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("scope", options.scope);
  url.searchParams.set("state", options.state);
  url.searchParams.set("code_challenge", options.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (options.audience) {
    url.searchParams.set("audience", options.audience);
  }
  return url.toString();
}

function addressPort(server: http.Server): number {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine local callback port.");
  }
  return address.port;
}

async function exchangeCode(options: {
  tokenUrl: string;
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: options.clientId,
    code: options.code,
    redirect_uri: options.redirectUri,
    code_verifier: options.codeVerifier,
  });

  const response = await fetch(options.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as TokenResponse;

  if (!response.ok) {
    throw new Error(
      payload.error_description ??
        payload.error ??
        `OAuth token exchange failed with HTTP ${response.status}.`,
    );
  }
  return payload;
}

async function exchangePlatformCode(options: {
  tokenUrl: string;
  code: string;
  redirectUri: string;
  state: string;
}): Promise<TokenResponse> {
  const response = await fetch(options.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code: options.code,
      redirect_uri: options.redirectUri,
      state: options.state,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as TokenResponse;

  if (!response.ok) {
    throw new Error(
      payload.error_description ??
        payload.error ??
        `Platform token handoff failed with HTTP ${response.status}.`,
    );
  }
  return payload;
}

export async function browserLogin(
  options: BrowserLoginOptions,
): Promise<BrowserLoginResult> {
  const clientId = options.clientId ?? process.env["MIOT_OAUTH_CLIENT_ID"];
  const platformLoginUrl =
    options.loginUrl ??
    process.env["MIOT_LOGIN_URL"] ??
    buildDefaultUrl(options.baseUrl, "/app/cli/auth/login");

  const authorizationUrl =
    options.authorizationUrl ??
    process.env["MIOT_OAUTH_AUTHORIZE_URL"] ??
    buildDefaultUrl(options.baseUrl, "/oauth/authorize");
  const tokenUrl =
    options.tokenUrl ??
    process.env["MIOT_OAUTH_TOKEN_URL"] ??
    buildDefaultUrl(
      options.baseUrl,
      clientId ? "/oauth/token" : "/app/api/cli/auth/token",
    );
  const audience = options.audience ?? process.env["MIOT_OAUTH_AUDIENCE"];
  const scope =
    options.scope ??
    process.env["MIOT_OAUTH_SCOPE"] ??
    "openid profile email offline_access";
  const host = options.callbackHost ?? "127.0.0.1";
  const port = options.callbackPort ?? 0;
  const timeoutSeconds = options.timeoutSeconds ?? 180;
  const state = randomBase64Url();
  const codeVerifier = clientId ? randomBase64Url(64) : undefined;
  const codeChallenge = codeVerifier
    ? base64Url(crypto.createHash("sha256").update(codeVerifier).digest())
    : undefined;

  // Manual (out-of-band) login: no loopback server. The platform shows the
  // one-time code in the browser; the user pastes it back here. PKCE/OAuth
  // client login uses the provider's own flow and isn't supported here.
  if (options.manual) {
    if (clientId) {
      throw new Error(
        "Manual login is only supported for platform login (omit --client-id).",
      );
    }
    const loginUrl = buildPlatformLoginUrl({
      loginUrl: platformLoginUrl,
      redirectUri: OOB_REDIRECT_URI,
      state,
    });
    console.error("To sign in, open this URL in any browser:");
    console.error(loginUrl);
    if (options.openBrowser !== false) {
      await openUrl(loginUrl);
    }
    const code = await promptForCode();
    const token = await exchangePlatformCode({
      tokenUrl,
      code,
      redirectUri: OOB_REDIRECT_URI,
      state,
    });
    if (!token.access_token) {
      throw new Error("OAuth token response did not include an access token.");
    }
    const organizationId =
      token.organizationId ?? token.organization_id ?? options.organizationId;
    return {
      accessToken: token.access_token,
      baseUrl: options.baseUrl,
      ...(organizationId !== undefined && { organizationId }),
      ...(token.expires_in !== undefined && { expiresIn: token.expires_in }),
      ...(token.scope !== undefined && { scope: token.scope }),
    };
  }

  const callbackServer = await createCallbackServer({
    host,
    port,
    state,
    timeoutSeconds,
  });

  const loginUrl = clientId
    ? buildAuthorizationUrl({
        authorizationUrl,
        clientId,
        redirectUri: callbackServer.redirectUri,
        scope,
        state,
        codeChallenge: codeChallenge!,
        ...(audience !== undefined && { audience }),
      })
    : buildPlatformLoginUrl({
        loginUrl: platformLoginUrl,
        redirectUri: callbackServer.redirectUri,
        state,
      });

  console.error("Opening browser for ModularIoT login...");
  if (options.openBrowser !== false) {
    const opened = await openUrl(loginUrl);
    if (!opened) {
      console.error("Open this URL in your browser:");
      console.error(loginUrl);
    }
  } else {
    console.error("Open this URL in your browser:");
    console.error(loginUrl);
  }

  try {
    const callback = await callbackServer.waitForCallback;
    const token =
      callback.accessToken !== undefined
        ? {
            access_token: callback.accessToken,
            expires_in: callback.expiresIn,
            scope: callback.scope,
            organizationId: callback.organizationId,
          }
        : clientId
          ? await exchangeCode({
              tokenUrl,
              clientId,
              code: callback.code!,
              redirectUri: callbackServer.redirectUri,
              codeVerifier: codeVerifier!,
            })
          : await exchangePlatformCode({
              tokenUrl,
              code: callback.code!,
              redirectUri: callbackServer.redirectUri,
              state,
            });

    if (!token.access_token) {
      throw new Error("OAuth token response did not include an access token.");
    }

    const organizationId =
      token.organizationId ?? token.organization_id ?? options.organizationId;

    return {
      accessToken: token.access_token,
      baseUrl: options.baseUrl,
      ...(organizationId !== undefined && { organizationId }),
      ...(token.expires_in !== undefined && { expiresIn: token.expires_in }),
      ...(token.scope !== undefined && { scope: token.scope }),
    };
  } finally {
    callbackServer.close();
  }
}

import crypto from "node:crypto";
import http from "node:http";
import { spawn } from "node:child_process";
import { URL } from "node:url";

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
              "<!doctype html><title>ModularIoT CLI</title><h1>Login complete</h1><p>You can return to your terminal.</p>",
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
            res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
            res.end("Login failed. Check your terminal for details.");
            settled = true;
            server.close();
            rejectCallback(err);
          }
        });

        timer = setTimeout(() => {
          settled = true;
          server.close();
          rejectCallback(
            new Error("Timed out waiting for the browser login callback."),
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

/**
 * Sends the browser to sign-in when the session is gone.
 *
 * The app's API routes answer 401 when `auth()` finds no session. The guard
 * wraps `window.fetch` and `window.EventSource` once, so every client call to
 * `/api/...` is covered without each feature handling it. A 403 (no
 * permission) and every other status reach the caller unchanged.
 */

import { locales } from "@/features/i18n/tr.service";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const API_PREFIX = `${BASE_PATH}/api/`;
const AUTH_API_PREFIX = `${BASE_PATH}/api/auth/`;
/** If the page is still here after this long, the navigation did not happen. */
export const NAVIGATION_TIMEOUT_MS = 10_000;
const INSTALLED = Symbol.for("miot.sessionExpiryGuard");

/** The parts of `window` the guard reads and wraps. */
export type GuardedWindow = Pick<Window, "fetch" | "location"> & {
  EventSource?: typeof EventSource;
  [INSTALLED]?: boolean;
};

let active = true;
let redirecting = false;
let sessionCheck: Promise<boolean> | null = null;

/** For tests: forget a redirect done earlier. */
export function resetSessionExpiryGuard() {
  active = true;
  redirecting = false;
  sessionCheck = null;
}

/** The secured layout turns the guard on while it is mounted. */
export function setSessionExpiryGuardActive(value: boolean) {
  active = value;
}

function pathOf(url: string, origin: string): string | null {
  try {
    const parsed = new URL(url, origin);
    return parsed.origin === origin ? parsed.pathname : null;
  } catch {
    return null;
  }
}

/** A same-origin call to the app's API, other than NextAuth's own routes. */
export function isAppApiUrl(url: string, origin: string): boolean {
  const path = pathOf(url, origin);
  return (
    path !== null &&
    path.startsWith(API_PREFIX) &&
    !path.startsWith(AUTH_API_PREFIX)
  );
}

export function isSignInPath(pathname: string): boolean {
  return /\/sign-in\/?$/.test(pathname);
}

/** The sign-in page in the current page's language, back to the current page. */
export function signInUrl(
  location: Pick<Location, "pathname" | "search" | "hash">
) {
  const rest = location.pathname.startsWith(`${BASE_PATH}/`)
    ? location.pathname.slice(BASE_PATH.length)
    : location.pathname;
  const lang = rest.split("/")[1] ?? "";
  const page = locales.includes(lang)
    ? `${BASE_PATH}/${lang}/sign-in`
    : `${BASE_PATH}/sign-in`;
  const callbackUrl = `${location.pathname}${location.search}${location.hash}`;
  return `${page}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

/**
 * Goes to sign-in once; later calls do nothing. Returns false when it did not
 * redirect because the page is already the sign-in page. When the page is
 * still here after `NAVIGATION_TIMEOUT_MS` (the user stayed on a page with
 * unsaved changes, or came back with the Back button), a later 401 can
 * redirect again.
 */
export function redirectToSignIn(win: GuardedWindow = window): boolean {
  if (isSignInPath(win.location.pathname)) return false;
  if (!redirecting) {
    redirecting = true;
    setTimeout(() => {
      redirecting = false;
    }, NAVIGATION_TIMEOUT_MS);
    win.location.assign(signInUrl(win.location));
  }
  return true;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

async function readSession(fetchFn: typeof fetch): Promise<boolean> {
  try {
    const response = await fetchFn(`${AUTH_API_PREFIX}session`, {
      cache: "no-store",
    });
    if (!response.ok) return true;
    const session = await response.json();
    return Boolean(session?.user);
  } catch {
    return true;
  }
}

/** Whether NextAuth still has a user; one request for many callers at once. */
function hasSession(fetchFn: typeof fetch): Promise<boolean> {
  sessionCheck ??= readSession(fetchFn).finally(() => {
    sessionCheck = null;
  });
  return sessionCheck;
}

/**
 * Holds the response back while the page goes to sign-in, so the page does
 * not show "Unauthorized" while it leaves. Gives it to the caller if the page
 * is still here after the timeout, and rejects if the caller aborts.
 */
function holdResponse(response: Response, signal?: AbortSignal | null) {
  return new Promise<Response>((resolve, reject) => {
    const timer = setTimeout(() => resolve(response), NAVIGATION_TIMEOUT_MS);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

/**
 * Wraps `win.fetch` and `win.EventSource`. On a 401 from the app's API the
 * guard asks NextAuth whether the session is still there. When it is gone the
 * page goes to sign-in. When it is still there (the backend refused the
 * token), the 401 reaches the caller, which avoids a sign-in loop. An
 * `EventSource` cannot read the status, so the guard asks when the browser
 * closes the stream.
 */
export function installSessionExpiryGuard(win: GuardedWindow = window) {
  if (win[INSTALLED]) return;
  win[INSTALLED] = true;

  const originalFetch = win.fetch.bind(win);
  const sessionGone = async (url: string) =>
    active &&
    isAppApiUrl(url, win.location.origin) &&
    !(await hasSession(originalFetch));

  win.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init);
    if (
      response.status === 401 &&
      (await sessionGone(requestUrl(input))) &&
      redirectToSignIn(win)
    ) {
      const signal =
        init?.signal ?? (input instanceof Request ? input.signal : null);
      return holdResponse(response, signal);
    }
    return response;
  };

  const OriginalEventSource = win.EventSource;
  if (!OriginalEventSource) return;
  class GuardedEventSource extends OriginalEventSource {
    constructor(url: string | URL, init?: EventSourceInit) {
      super(url, init);
      this.addEventListener("error", () => {
        // 2 is EventSource.CLOSED: the browser gave up on the stream.
        if (this.readyState !== 2) return;
        void sessionGone(String(url)).then((gone) => {
          if (gone) redirectToSignIn(win);
        });
      });
    }
  }
  win.EventSource = GuardedEventSource;
}

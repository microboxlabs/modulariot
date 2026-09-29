let redirecting = false;

/**
 * Sends the browser to the sign-in page and back to the current page after
 * sign-in. Safe to call from many pollers at once: only the first call
 * navigates.
 */
export function redirectToSignIn(): void {
  if (redirecting) return;
  redirecting = true;
  const { pathname, search } = globalThis.location;
  const callbackUrl = encodeURIComponent(pathname + search);
  globalThis.location.href = `/app/sign-in?callbackUrl=${callbackUrl}`;
}

import { auth } from "@/auth";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { createCliAuthHandoff } from "../handoff-store";
import { getLocaleFromHeaders } from "@/features/i18n/i18n.service";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

interface CliAuthLoginPageProps {
  searchParams: Promise<{
    redirect_uri?: string;
    state?: string;
  }>;
}

function parseLocalRedirectUri(value: string | undefined): URL | null {
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

function errorRedirect(redirectUri: URL, state: string, message: string): never {
  redirectUri.searchParams.set("state", state);
  redirectUri.searchParams.set("error", "access_denied");
  redirectUri.searchParams.set("error_description", message);
  redirect(redirectUri.toString());
}

export default async function CliAuthLoginPage({
  searchParams,
}: Readonly<CliAuthLoginPageProps>) {
  const { redirect_uri: redirectUriParam, state } = await searchParams;
  const redirectUri = parseLocalRedirectUri(redirectUriParam);

  if (!redirectUri || !state) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-950">
        <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-blue-600">ModularIoT CLI</p>
          <h1 className="mt-3 text-2xl font-semibold">Invalid login request</h1>
          <p className="mt-2 text-sm text-slate-600">
            The CLI callback URL or state parameter is missing or invalid.
          </p>
        </section>
      </main>
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    const requestHeaders = await headers();
    const locale = getLocaleFromHeaders(requestHeaders);
    redirect(
      `/${locale}/sign-in?callbackUrl=${encodeURIComponent(
        `/cli/auth/login?redirect_uri=${encodeURIComponent(
          redirectUri.toString(),
        )}&state=${encodeURIComponent(state)}`,
      )}`,
    );
  }

  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) {
    errorRedirect(redirectUri, state, "Could not resolve active organization.");
  }

  const token = session.user.rawJWT ?? session.user.ticket;
  if (!token) {
    errorRedirect(redirectUri, state, "Current session has no API token.");
  }

  const { code } = createCliAuthHandoff({
    token,
    organizationId: scopeResult.scope.activeOrg.slug,
  });

  redirectUri.searchParams.set("state", state);
  redirectUri.searchParams.set("code", code);
  redirect(redirectUri.toString());
}

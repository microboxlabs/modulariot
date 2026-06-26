"use server";
import "server-only";

import { AuthError } from "next-auth";
import {
  AuthenticateActionState,
  formSchema,
} from "./auth.service.types";
import { getAuth0Connection } from "@/features/auth/config/auth0-connections";
import { auth, signIn } from "@/auth";
import { redirectWithLang } from "./navigation.service";
import { logger } from "@/lib/logger";

/**
 * Resolves a post-sign-in redirect target from an optional callbackUrl.
 * Only same-origin relative paths are honored (open-redirect guard); the
 * app's basePath is prefixed when missing so NextAuth lands on the right
 * route (e.g. the CLI auth handoff at /app/cli/auth/login?...).
 */
function resolveRedirectTarget(redirectTo?: string | null): string {
  if (!redirectTo?.startsWith("/") || redirectTo.startsWith("//")) {
    return "/app";
  }
  return redirectTo === "/app" || redirectTo.startsWith("/app/")
    ? redirectTo
    : `/app${redirectTo}`;
}

/**
 * Generic sign-in function that routes to the appropriate provider.
 *
 * When Auth0 is configured (AUTH_AUTH0_ID is set), social providers like
 * "google" and "github" are routed through Auth0 with the appropriate connection.
 * Otherwise, falls back to direct OAuth provider sign-in.
 *
 * @param redirectTo - Optional same-origin path to return to after sign-in
 *   (e.g. the sign-in page's callbackUrl). Defaults to the app home.
 */
export async function signInWithProvider(
  providerId: string,
  redirectTo?: string | null
): Promise<void> {
  const auth0Connection = getAuth0Connection(providerId);
  const target = resolveRedirectTarget(redirectTo);

  // If Auth0 is configured and we have a connection mapping, use Auth0 as broker
  if (auth0Connection) {
    // Third argument passes authorization params to Auth0 (connection skips Universal Login)
    await signIn("auth0", { redirectTo: target }, { connection: auth0Connection });
    return;
  }

  // Fallback to direct provider sign-in (for providers not brokered through Auth0)
  await signIn(providerId, { redirectTo: target });
}

/**
 * Sign in with SAML SSO via Auth0 Organizations.
 * The team slug maps to an Auth0 Organization name.
 */
export async function signInWithSaml(teamSlug: string): Promise<void> {
  const organization = teamSlug.trim().toLowerCase();
  await signIn("auth0", { redirectTo: "/app" }, { organization });
}

/**
 * Get the Auth0 logout URL for federated logout.
 * After signing out of NextAuth, redirect to this URL to also sign out of Auth0.
 *
 * @param returnTo - URL to redirect back to after Auth0 logout (must be in Allowed Logout URLs)
 * @returns The Auth0 logout URL, or null if Auth0 is not configured
 */
export async function getAuth0LogoutUrl(
  returnTo?: string
): Promise<string | null> {
  const issuer = process.env.AUTH_AUTH0_ISSUER;
  const clientId = process.env.AUTH_AUTH0_ID;

  if (!issuer || !clientId) {
    return null;
  }

  // Caller passes the sign-in page URL; fall back to the app base URL only if absent.
  const returnToUrl = returnTo || `${process.env.NEXTAUTH_URL || ""}`;

  // Auth0 logout endpoint: https://YOUR_DOMAIN/v2/logout
  const logoutUrl = new URL("/v2/logout", issuer);
  logoutUrl.searchParams.set("client_id", clientId);
  logoutUrl.searchParams.set("returnTo", returnToUrl);

  return logoutUrl.toString();
}

export async function authenticateAction(
  prevState: AuthenticateActionState,
  formData: FormData
): Promise<AuthenticateActionState> {
  try {
    const validatedFields = formSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!validatedFields.success) {
      return {
        success: false,
        dataErrors: validatedFields.error.flatten().fieldErrors,
        message: "Invalid form data",
      };
    }
    const result: unknown = await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    });
    logger.info("result--------------------------------");
    logger.info(result);

    const hasErrorField = (value: unknown): value is { error?: string } => {
      return typeof value === "object" && value !== null && "error" in value;
    };
    if (hasErrorField(result) && result.error) {
      logger.error(result.error);
    }
    const session = await auth();
    logger.info("session--------------------------------");
    logger.info(session);
    await redirectWithLang("/shipping");
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return {
            success: false,
            message: "Invalid credentials",
            status: 403,
          };
        default:
          return { success: false, message: "An error occurred", status: 500 };
      }
    }
    throw error;
  }
  return { success: false, message: "An error occurred", status: 500 };
}

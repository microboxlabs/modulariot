"use server";
import "server-only";

import { AuthError, CredentialsSignin } from "next-auth";
import type { User } from "next-auth";
import {
  AuthenticateActionState,
  formSchema,
  SignInCredentials,
} from "./auth.service.types";
import { PeopleApi, AlfrescoApi } from "@alfresco/js-api";
import { auth, signIn } from "@/auth";
import { redirectWithLang } from "./navigation.service";
import { logger } from "@/lib/logger";

export async function signInWithCredentials(
  credentials: Record<keyof SignInCredentials, string>
): Promise<User | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const alfrescoApi = new AlfrescoApi({
      hostEcm: process.env.ECM_API_URL,
      provider: process.env.AUTH_PROVIDER,
      contextRoot: process.env.CONTEXT_ROOT,
    });
    const ticket: string = (await alfrescoApi.login(
      credentials.email as string,
      credentials.password as string
    )) as string;

    const peopleApi = new PeopleApi(alfrescoApi);
    const person = await peopleApi.getPerson("-me-");

    return {
      id: person.entry.id,
      name: person.entry.displayName || person.entry.email || "Unknown User",
      email: person.entry.email,
      groups: [],
      ticket,
    };
  } catch (error) {
    throw new CredentialsSignin("Invalid credentials");
  }
}

export async function signInWithMicrosoft(): Promise<void> {
  await signIn("microsoft-entra-id", { redirectTo: "/app" });
}

export async function signInWithGoogle(): Promise<void> {
  // Third argument passes authorization params to Auth0 (connection skips Universal Login)
  await signIn("auth0", { redirectTo: "/app" }, { connection: "google-oauth2" });
}

export async function signInWithGitHub(): Promise<void> {
  await signIn("auth0", { redirectTo: "/app" }, { connection: "github" });
}

/**
 * Sign in with Auth0 database connection (username/password).
 * Redirects to Auth0 with connection hint for the database.
 *
 * @param email - Optional email to pre-fill (login_hint)
 */
export async function signInWithAuth0Credentials(
  email?: string
): Promise<void> {
  await signIn(
    "auth0",
    { redirectTo: "/app" },
    {
      connection: "Username-Password-Authentication",
      ...(email && { login_hint: email }),
    }
  );
}

/**
 * Maps UI provider IDs to Auth0 connection names.
 * When Auth0 is the OIDC broker, all identity providers are routed through Auth0 connections.
 */
const AUTH0_CONNECTION_MAP: Record<string, string> = {
  google: "google-oauth2",
  github: "github",
  // Microsoft/Azure AD: Only route through Auth0 if enabled (requires Azure AD redirect_uri update)
  // Set ROUTE_MICROSOFT_VIA_AUTH0=true once Auth0 callback is registered in Azure AD
  ...(process.env.ROUTE_MICROSOFT_VIA_AUTH0 === "true" && {
    "microsoft-entra-id": "Mintral-Entra-ID",
    microsoft: "Mintral-Entra-ID",
  }),
};

/**
 * Generic sign-in function that routes to the appropriate provider.
 *
 * When Auth0 is configured (AUTH_AUTH0_ID is set), social providers like
 * "google" and "github" are routed through Auth0 with the appropriate connection.
 * Otherwise, falls back to direct OAuth provider sign-in.
 */
export async function signInWithProvider(providerId: string): Promise<void> {
  const auth0Connection = AUTH0_CONNECTION_MAP[providerId];

  // If Auth0 is configured and we have a connection mapping, use Auth0 as broker
  if (auth0Connection) {
    // Third argument passes authorization params to Auth0 (connection skips Universal Login)
    await signIn("auth0", { redirectTo: "/app" }, { connection: auth0Connection });
    return;
  }

  // Fallback to direct provider sign-in (for providers not brokered through Auth0)
  await signIn(providerId, { redirectTo: "/app" });
}

/**
 * Sign in with SAML SSO.
 * The team slug is used to identify the organization's SAML provider.
 */
export async function signInWithSaml(teamSlug: string): Promise<void> {
  // The team slug is passed as a query parameter to identify the organization
  // The actual SAML provider needs to be configured in auth.config.ts
  await signIn("saml", {
    redirectTo: "/app",
    // Pass team slug to SAML provider for organization identification
    team: teamSlug,
  });
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

  // Default returnTo is the sign-in page
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

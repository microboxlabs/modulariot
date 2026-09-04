import { Alert, Card } from "flowbite-react";
import React from "react";
import { getDictionary } from "@/features/i18n/i18n.service";
import AuthPageShell from "@/features/auth/components/auth-page-shell/auth-page-shell";
import FormSignIn from "@/features/auth/components/form-sign-in/form-sign-in";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDomainBranding } from "@/features/branding/domain-branding.service";
import { getAuthConfig } from "@/features/auth/config/auth-providers.config";
import type {
  ProviderLabels,
  SamlLabels,
} from "@/features/auth/components/form-sign-in/form-sign-in.types";
import type { AuthConfig } from "@/features/auth/config/auth-providers.types";

/**
 * Pre-computes labels for all providers on the server side.
 * If the provider name is a translation key (contains dots), translate it.
 * Otherwise, use the name as-is.
 */
function buildProviderLabels(
  authConfig: AuthConfig,
  translate: (key: string) => string
): ProviderLabels {
  const labels: ProviderLabels = {};
  for (const provider of authConfig.providers) {
    labels[provider.id] = provider.name.includes(".")
      ? translate(provider.name)
      : provider.name;
  }
  return labels;
}

/**
 * Resolves a config value that might be a translation key.
 * If the value contains dots (like "pages.login.teamSlug.label"), treat it as a translation key.
 */
function resolveTranslationKey(
  value: string | undefined,
  fallbackKey: string,
  translate: (key: string) => string
): string {
  if (!value) {
    return translate(fallbackKey);
  }
  // If value looks like a translation key (contains dots), translate it
  return value.includes(".") ? translate(value) : value;
}

/**
 * Builds SAML-specific labels if a SAML provider is configured.
 * Uses config values if provided, otherwise falls back to i18n translations.
 */
function buildSamlLabels(
  authConfig: AuthConfig,
  translate: (key: string) => string
): SamlLabels | undefined {
  const hasSamlProvider = authConfig.providers.some((p) => p.type === "saml");
  if (!hasSamlProvider) {
    return undefined;
  }

  return {
    teamSlugLabel: resolveTranslationKey(
      authConfig.teamSlugLabel,
      "pages.login.teamSlug.label",
      translate
    ),
    teamSlugPlaceholder: resolveTranslationKey(
      authConfig.teamSlugPlaceholder,
      "pages.login.teamSlug.placeholder",
      translate
    ),
    teamSlugRequired: translate("pages.login.teamSlug.required"),
  };
}

export default async function SignInPage(
  params: ParamsWithLang & {
    searchParams?: Promise<{ callbackUrl?: string; error?: string }>;
  }
) {
  const { lang } = await params.params;
  const resolvedSearchParams = await params.searchParams;
  // Post-sign-in destination (e.g. the CLI auth handoff page). Resolved
  // server-side and passed as a prop so FormSignIn stays free of
  // useSearchParams (which would require a Suspense boundary).
  const callbackUrl = resolvedSearchParams?.callbackUrl ?? null;
  const [dict, , dictDynamic] = await getDictionary(lang);
  // NextAuth redirects here with ?error=AccessDenied when the signIn callback
  // rejects a login (e.g. email domain not in AUTH_ALLOWED_EMAIL_DOMAINS).
  const accessDeniedMessage =
    resolvedSearchParams?.error === "AccessDenied"
      ? dict("pages.login.errors.accessDenied")
      : null;
  const branding = await getDomainBranding();
  const authConfig = getAuthConfig();
  // Provider/SAML labels and dividerText come from runtime auth config: the key
  // is only known at runtime, so they use the dynamic (unchecked) translator.
  const providerLabels = buildProviderLabels(authConfig, dictDynamic);
  // Server-only toggle for the credentials link wording: AUTH_CREDENTIALS_LABEL_VARIANT
  // selects an i18n *key* (never raw text) so the label stays translated.
  // "continueExternal" -> "Continue with external user"; anything else
  // (including unset) falls back to the default "Continue with email and
  // password" copy.
  const credentialsLabelKey: "pages.login.buttons.continueWithEmail" | "pages.login.buttons.credentials" =
    process.env.AUTH_CREDENTIALS_LABEL_VARIANT === "continueExternal"
      ? "pages.login.buttons.continueWithEmail"
      : "pages.login.buttons.credentials";
  const credentialsProvider = authConfig.providers.find(
    (p) => p.type === "credentials"
  );
  if (credentialsProvider) {
    providerLabels[credentialsProvider.id] = dict(credentialsLabelKey);
  }
  const dividerText = authConfig.dividerText?.includes(".")
    ? dictDynamic(authConfig.dividerText)
    : (authConfig.dividerText ?? dict("pages.login.divider"));
  const samlLabels = buildSamlLabels(authConfig, dictDynamic);
  // Server-only flag: kept off NEXT_PUBLIC_ so the toggle never ships to
  // the client bundle; FormSignIn just receives the resolved boolean.
  const showRegisterLink = process.env.ENABLE_REGISTER_LINK === "true";

  return (
    <AuthPageShell
      orgLogoUrl={branding?.logoUrl}
      homeUrl={branding?.homeUrl}
      footerMessages={dict}
    >
      <Card
        data-testid="login-card"
        horizontal
        imgAlt=""
        className="bg-white dark:bg-gray-800 transition-colors duration-200"
        theme={{
          root: {
            base: "flex rounded-lg border border-gray-200 shadow-none dark:border-gray-700",
            children: "my-auto w-full gap-0 p-10 sm:p-10 lg:p-10",
          },
        }}
      >
        {accessDeniedMessage && (
          <Alert
            color="failure"
            data-testid="sign-in-access-denied"
            className="w-full"
          >
            {accessDeniedMessage}
          </Alert>
        )}
        <FormSignIn
          messages={{
            emailPlaceHolder: dict("pages.login.fields.email.placeholder"),
            emailLabel: dict("pages.login.fields.email.label"),
            passwordLabel: dict("pages.login.fields.password.label"),
            rememberMeLabel: dict("pages.login.fields.remember.label"),
            forgotPasswordLabel: dict("pages.login.fields.forgot.label"),
            buttonSubmitLabel: dict("pages.login.buttons.submit"),
            invalidCredentials: dict("pages.login.errors.invalidCredentials"),
            invalidFromData: dict("pages.login.errors.invalidFromData"),
            buttonContinueWithMicrosoft: dict(
              "pages.login.buttons.continueWithMicrosoft"
            ),
            buttonContinueWithEmail: dict(
              "pages.login.buttons.continueWithEmail"
            ),
            requestAccessPrompt: dict("pages.login.requestAccess.prompt"),
            requestAccessLink: dict("pages.login.requestAccess.link"),
            mainTitle: dict("pages.login.welcome"),
            mainSubtitle: dict("pages.login.subtitle"),
            loginTitle: dict("pages.login.credentialsTitle"),
            loginSubtitle: dict("pages.login.credentialsSubtitle"),
            ssoTitle: dict("pages.login.ssoTitle"),
            ssoSubtitle: dict("pages.login.ssoSubtitle"),
            ssoSubmitLabel: dict("pages.login.buttons.ssoSubmit"),
          }}
          authConfig={authConfig}
          providerLabels={providerLabels}
          dividerText={dividerText}
          samlLabels={samlLabels}
          callbackUrl={callbackUrl}
          showRegisterLink={showRegisterLink}
        />
      </Card>
    </AuthPageShell>
  );
}

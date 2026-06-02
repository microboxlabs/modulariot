import { Card } from "flowbite-react";
import React from "react";
import { getDictionary } from "@/features/i18n/i18n.service";
import NavbarSignIn from "@/features/auth/components/navbar-sign-in";
import FooterSignIn from "@/features/auth/components/footer-sign-in/footer-sign-in";
import FormSignIn from "@/features/auth/components/form-sign-in/form-sign-in";
import { buildSignInFormMessages } from "@/features/auth/utils/utils";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getPublicOrgLogo } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
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

export default async function SignInPage(params: ParamsWithLang) {
  const { lang } = await params.params;
  const [dict, , dictDynamic] = await getDictionary(lang);
  const signInMessages = buildSignInFormMessages({ messages: dict });
  const orgLogo = await getPublicOrgLogo();
  const authConfig = getAuthConfig();
  // Provider/SAML labels and dividerText come from runtime auth config: the key
  // is only known at runtime, so they use the dynamic (unchecked) translator.
  const providerLabels = buildProviderLabels(authConfig, dictDynamic);
  const dividerText = authConfig.dividerText?.includes(".")
    ? dictDynamic(authConfig.dividerText)
    : (authConfig.dividerText ?? dict("pages.login.divider"));
  const samlLabels = buildSamlLabels(authConfig, dictDynamic);

  return (
    <div className="mx-auto flex flex-col px-6 pt-8 md:h-screen">
      <NavbarSignIn orgLogoUrl={orgLogo} />
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="w-full md:max-w-lg">
          <Card
            data-testid="login-card"
            horizontal
            imgAlt=""
            className="bg-white dark:bg-gray-800 transition-colors duration-200"
            theme={{
              root: {
                base: "flex rounded-lg border border-gray-200 shadow-md dark:border-gray-700",
                children: "my-auto w-full gap-0 space-y-4 p-6 sm:p-4 lg:p-8",
              },
            }}
          >
            <h2 className="text-2xl font-bold text-gray-900 lg:text-3xl dark:text-white w-full text-center">
              {dict("pages.login.welcome")}
            </h2>
            <FormSignIn
              messages={signInMessages}
              authConfig={authConfig}
              providerLabels={providerLabels}
              dividerText={dividerText}
              samlLabels={samlLabels}
            />
          </Card>
        </div>
      </div>
      <FooterSignIn messages={dict} />
    </div>
  );
}

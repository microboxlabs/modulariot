import React from "react";
import type { PropsWithChildren } from "react";
import { SessionProvider } from "next-auth/react";
import { Inter } from "next/font/google";
import { twMerge } from "tailwind-merge";
import SecuredLayout from "@/features/layout/components/secured-layout";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { AuthProvider } from "@/features/auth/context/auth-context";
import NewFeatureNotification from "@/features/new-feature-notification/new-feature-notification";
import { HarnessChatProvider } from "@/features/harness-chat/context/harness-chat-context";
import { isHarnessUiEnabled } from "@/features/layout/utils/utils";
import { RuntimeConfigProvider } from "@/features/runtime-config/runtime-config-context";
import HarnessChatMount from "./harness-chat-mount";

const inter = Inter({ subsets: ["latin"] });

export default async function Layout({
  children,
  params,
}: PropsWithChildren<ParamsWithLang>) {
  const { lang } = await params;

  return (
    <main
      className={twMerge(
        inter.className,
        "bg-gray-50 dark:bg-gray-900 h-screen flex flex-row"
      )}
    >
      <HarnessChatProvider>
        <NewFeatureNotification lang={lang} />
        <SessionProvider basePath="/app/api/auth">
          <AuthProvider>
            <SecuredLayout params={params}>{children}</SecuredLayout>
          </AuthProvider>
        </SessionProvider>
        {isHarnessUiEnabled() && (
          // HarnessChatMount is a sibling of SecuredLayout, not nested inside
          // it — SecuredLayout owns the "real" RuntimeConfigProvider, so
          // without this, anything rendered inside chat (e.g. geographic_map,
          // which needs runtimeConfig.MAPBOX_API_KEY) sees useRuntimeConfig()
          // as permanently null, not just "still loading." The underlying
          // fetch is module-level cached/deduped, so a second provider
          // instance here is free — it doesn't refetch. Same for
          // getDictionary — SecuredLayout already resolves one for this same
          // `lang`, and dynamic-imported JSON modules are cached by Node's
          // module system, so this second call doesn't re-read the file.
          <RuntimeConfigProvider>
            <HarnessChatMountWithDict lang={lang} />
          </RuntimeConfigProvider>
        )}
      </HarnessChatProvider>
    </main>
  );
}

async function HarnessChatMountWithDict({ lang }: Readonly<{ lang: string }>) {
  const [, dict] = await getDictionary(lang);
  return <HarnessChatMount dict={dict} locale={lang} />;
}

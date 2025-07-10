import "server-only";
import { auth } from "@/auth";
// import { getUserTasks } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";

import { redirectWithLang } from "@/features/auth/services/navigation.service";
import SseListener from "@/features/sse/components/sse-listener/sse-listener";
import PageContent from "@/features/user-settings/components/page-content";
import { RouteGuard } from "@/features/auth/components/route-guard";

export default async function ShippingPage({
  params: { lang },
}: ParamsWithLang) {
  const [, dictionary] = await getDictionary(lang);
  const session = await auth();

  try {
    return (
      <RouteGuard path="/users/settings" fallbackPath={`/${lang}/shipping`}>
        <>
          <SseListener dictionary={dictionary} tenantId={session!.user.email} />
          <PageContent
            dict={(dictionary.pages as I18nRecord)?.userSettings as I18nRecord}
          />
        </>
      </RouteGuard>
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (e?.status === 401) {
      redirectWithLang(`/sign-in`);
    }
  }
  return null;
}

import "server-only";
import { Suspense } from "react";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import NewRule from "@/features/conversations/new-rule";
import RuleEditor from "@/features/conversations/rule-editor";

/** Settings › Comunicaciones › one rule, or `new` to create one. */
export default async function CommunicationRulePage({
  params,
}: Readonly<{ params: Promise<{ lang: string; id: string }> }>) {
  const { lang, id } = await params;
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard path="/users/settings/communications">
      {id === "new" ? (
        <Suspense>
          <NewRule dict={userSettings} lang={lang} />
        </Suspense>
      ) : (
        <RuleEditor id={id} dict={userSettings} lang={lang} />
      )}
    </RouteGuard>
  );
}

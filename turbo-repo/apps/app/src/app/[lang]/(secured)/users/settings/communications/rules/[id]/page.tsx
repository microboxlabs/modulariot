import "server-only";
import { redirect } from "next/navigation";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import RuleEditor from "@/features/conversations/rule-editor";

/** Settings › Comunicaciones › one rule. `new` opens the "Nueva regla" modal on the list. */
export default async function CommunicationRulePage({
  params,
}: Readonly<{ params: Promise<{ lang: string; id: string }> }>) {
  const { lang, id } = await params;
  if (id === "new") redirect(`/${lang}/users/settings/communications?new=1`);
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard path="/users/settings/communications">
      <RuleEditor id={id} dict={userSettings} lang={lang} />
    </RouteGuard>
  );
}

import "server-only";
import { redirect } from "next/navigation";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import RuleEditor from "@/features/conversations/rule-editor";

type Query = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/** Settings › Comunicaciones › one rule. `new` opens the "Nueva regla" modal on the list. */
export default async function CommunicationRulePage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<Query>;
}>) {
  const { lang, id } = await params;
  if (id === "new") {
    const query = await searchParams;
    const q = new URLSearchParams({ new: "1" });
    for (const k of ["event", "when", "name"]) {
      const v = first(query[k]);
      if (v) q.set(k, v);
    }
    redirect(`/${lang}/users/settings/communications?${q.toString()}`);
  }
  const [, dictionary] = await getDictionary(lang);
  const userSettings = (dictionary.pages as I18nRecord)
    ?.userSettings as I18nRecord;

  return (
    <RouteGuard path="/users/settings/communications">
      <RuleEditor id={id} dict={userSettings} lang={lang} />
    </RouteGuard>
  );
}

import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { getDictionary } from "@/features/i18n/i18n.service";
import type {
  I18nRecord,
  ParamsWithLang,
} from "@/features/i18n/i18n.service.types";
import { buildNavBarMessages } from "@/features/layout/utils/utils";
import { UnifiedHeaderPreview } from "./unified-header-preview";

export default async function UnifiedHeaderDevPage(props: ParamsWithLang) {
  const { lang } = await props.params;

  if (process.env.ENABLE_DEV_TOOLS !== "true") {
    notFound();
  }

  const session = await auth();
  if (!session) {
    redirect(`/${lang}/sign-in`);
  }

  const [dict, dictionary] = await getDictionary(lang);
  const messages = buildNavBarMessages({ messages: dict });

  return (
    <div className="h-full w-full overflow-auto bg-gray-50 p-6 dark:bg-gray-900">
      <UnifiedHeaderPreview
        dict={dictionary as I18nRecord}
        messages={messages}
        lang={lang}
      />
    </div>
  );
}

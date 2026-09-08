import { notFound } from "next/navigation";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import StorytellingPageContent from "@/features/storytelling/components/storytelling-page-content";

export default async function StorytellingPage({ params }: ParamsWithLang) {
  // Testing-only for now — see ENABLE_STORYTELLING in
  // runtime-config.types.ts, and features/layout/models/pages.ts for the
  // matching nav-entry filter.
  if (process.env.ENABLE_STORYTELLING !== "true") {
    notFound();
  }

  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const dict = (dictionary.storytelling as I18nRecord) ?? {};

  return (
    <RouteGuard path="/storytelling" fallbackPath={`/${lang}/shipping`}>
      {/* LayoutContent is overflow-hidden — pages own their scroll. The header
          (SectionHeader, inside StorytellingPageContent) stays fixed; only the
          body below it scrolls, same as symptoms / geographic-view. */}
      <div className="flex h-full w-full flex-col bg-white dark:bg-gray-900">
        <StorytellingPageContent dict={dict} rootDict={dictionary as unknown as I18nRecord} />
      </div>
    </RouteGuard>
  );
}

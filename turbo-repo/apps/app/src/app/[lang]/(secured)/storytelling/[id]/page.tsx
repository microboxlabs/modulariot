import "server-only";
import { notFound } from "next/navigation";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import StoryDetailPage from "@/features/storytelling/components/story-detail-page";

type StoryRouteParams = ParamsWithLang<{ id: string }>;

export default async function StoryDetailRoute({ params }: StoryRouteParams) {
  // Testing-only for now — see ENABLE_STORYTELLING in
  // runtime-config.types.ts, and features/layout/models/pages.ts for the
  // matching nav-entry filter.
  if (process.env.ENABLE_STORYTELLING !== "true") {
    notFound();
  }

  const { lang, id } = await params;
  const [, dictionary] = await getDictionary(lang);
  const dict = (dictionary.storytelling as I18nRecord) ?? {};
  const decodedId = decodeURIComponent(id);

  return (
    <RouteGuard path="/storytelling" fallbackPath={`/${lang}/shipping`}>
      {/* outline-none: Next's App Router focuses this segment's root on a
          client-side navigation (for scroll/a11y bookkeeping, not as a real
          keyboard tab-stop) — reaching this page via the chat's create_story
          router.push otherwise leaves a visible default focus ring around
          the whole page. */}
      <div className="flex h-full w-full flex-col overflow-y-auto bg-white outline-none dark:bg-gray-900">
        <StoryDetailPage
          key={decodedId}
          dict={dict}
          id={decodedId}
          rootDict={dictionary as unknown as I18nRecord}
        />
      </div>
    </RouteGuard>
  );
}

import "server-only";
import { notFound } from "next/navigation";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import StoryVersionsPage from "@/features/storytelling/components/story-versions-page";

type StoryVersionsRouteParams = ParamsWithLang<{ id: string }>;

export default async function StoryVersionsRoute({ params }: StoryVersionsRouteParams) {
  // Testing-only for now — mirrors the detail route's gate.
  if (process.env.ENABLE_STORYTELLING !== "true") {
    notFound();
  }

  const { lang, id } = await params;
  const [, dictionary] = await getDictionary(lang);
  const dict = (dictionary.storytelling as I18nRecord) ?? {};
  const decodedId = decodeURIComponent(id);

  return (
    <RouteGuard path="/storytelling" fallbackPath={`/${lang}/shipping`}>
      <div className="flex h-full w-full flex-col overflow-y-auto bg-white outline-none dark:bg-gray-900">
        <StoryVersionsPage
          key={decodedId}
          dict={dict}
          id={decodedId}
          rootDict={dictionary as unknown as I18nRecord}
        />
      </div>
    </RouteGuard>
  );
}

import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import ShareSnapshotPage from "@/features/share-links/components/share-snapshot-page";

type ShareRouteParams = ParamsWithLang<{ token: string }>;

/** A share link: a read-only story or chat thread. Any signed-in member of
 * the organization may open it; the modulith checks that. */
export default async function ShareRoute({ params }: ShareRouteParams) {
  const { lang, token } = await params;
  const [, dictionary] = await getDictionary(lang);

  return (
    <div className="flex h-full w-full flex-col bg-white dark:bg-gray-900">
      <ShareSnapshotPage
        key={token}
        token={decodeURIComponent(token)}
        lang={lang}
        dict={(dictionary.shareLink as I18nRecord) ?? {}}
        storyDict={(dictionary.storytelling as I18nRecord) ?? {}}
      />
    </div>
  );
}

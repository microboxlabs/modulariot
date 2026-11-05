import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import AssetPage from "@/features/fleet/components/asset-page";

type AssetRouteParams = ParamsWithLang<{ assetId: string }>;

/** One asset of the fleet. */
export default async function FleetAssetRoute({ params }: AssetRouteParams) {
  const { lang, assetId } = await params;
  const [, dictionary] = await getDictionary(lang);
  const dict = (dictionary.pages as I18nRecord)?.fleet as I18nRecord;

  return (
    <RouteGuard path="/fleet">
      <AssetPage
        assetId={decodeURIComponent(assetId)}
        dict={dict ?? {}}
        rootDict={dictionary as I18nRecord}
        lang={lang}
      />
    </RouteGuard>
  );
}

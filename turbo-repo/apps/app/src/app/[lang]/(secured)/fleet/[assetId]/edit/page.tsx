import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import AssetEditPage from "@/features/fleet/components/asset-edit-page";

type AssetRouteParams = ParamsWithLang<{ assetId: string }>;

/** Edit one asset's data and document dates. */
export default async function FleetAssetEditRoute({
  params,
}: AssetRouteParams) {
  const { lang, assetId } = await params;
  const [, dictionary] = await getDictionary(lang);
  const dict = (dictionary.pages as I18nRecord)?.fleet as I18nRecord;

  return (
    <RouteGuard path="/fleet" fallbackPath={`/${lang}/shipping`}>
      <AssetEditPage
        assetId={decodeURIComponent(assetId)}
        dict={dict ?? {}}
        lang={lang}
      />
    </RouteGuard>
  );
}

import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import VehicleDetailPage from "@/features/fleet-management/components/vehicle-detail-page";

type VehicleRouteParams = ParamsWithLang<{ plate: string }>;

export default async function VehicleDetailRoute({
  params,
}: VehicleRouteParams) {
  const { lang, plate } = await params;
  const [, dict] = await getDictionary(lang);
  const decodedPlate = decodeURIComponent(plate);

  return (
    <RouteGuard path="/fleet-management" fallbackPath={`/${lang}/home`}>
      <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900 overflow-y-auto">
        <VehicleDetailPage key={decodedPlate} dict={dict} plate={decodedPlate} />
      </div>
    </RouteGuard>
  );
}

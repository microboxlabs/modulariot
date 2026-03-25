import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import FleetManagementPage from "@/features/fleet-management/components/fleet-management-page";

export default async function FleetManagementRoute({
  params,
}: ParamsWithLang) {
  const { lang } = await params;
  const [, dict] = await getDictionary(lang);

  return (
    <RouteGuard path="/fleet-management" fallbackPath={`/${lang}/home`}>
      <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900 overflow-y-auto">
        <FleetManagementPage dict={dict} />
      </div>
    </RouteGuard>
  );
}

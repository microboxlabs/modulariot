import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import CollaboratorDetailPage from "@/features/collaborators-management/components/collaborator-detail/collaborator-detail-page";

type DriverRouteParams = ParamsWithLang<{ codDriver: string }>;

export default async function CollaboratorDetailRoute({
  params,
}: DriverRouteParams) {
  const { lang, codDriver } = await params;
  const [, dict] = await getDictionary(lang);
  const decodedCodDriver = decodeURIComponent(codDriver);

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900 overflow-y-auto">
      <CollaboratorDetailPage dict={dict} codDriver={decodedCodDriver} />
    </div>
  );
}

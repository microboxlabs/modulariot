import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import CollaboratorsManagementPage from "@/features/collaborators-management/components/collaborators-management-page";

export default async function CollaboratorsManagementRoute({
  params,
}: ParamsWithLang) {
  const { lang } = await params;
  const [, dict] = await getDictionary(lang);

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900 overflow-y-auto">
      <CollaboratorsManagementPage dict={dict} />
    </div>
  );
}

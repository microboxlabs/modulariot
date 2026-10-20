import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import CollaboratorsManagementPage from "@/features/collaborators-management/components/collaborators-management-page";
import { guardPage } from "@/features/auth/access/server-access";
import { ACCESS_RULES } from "@/features/auth/access/access-rules";

export default async function CollaboratorsManagementRoute({
  params,
}: ParamsWithLang) {
  await guardPage(ACCESS_RULES.collaborators, "/collaborators-management");
  const { lang } = await params;
  const [, dict] = await getDictionary(lang);

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900 overflow-y-auto">
      <CollaboratorsManagementPage dict={dict} />
    </div>
  );
}

import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import ColaboratorsManagementPage from "@/features/colaborators-management/components/colaborators-management-page";

export default async function ColaboratorsManagementRoute({
  params,
}: ParamsWithLang) {
  const { lang } = await params;
  const [, dict] = await getDictionary(lang);

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900 overflow-y-auto">
      <ColaboratorsManagementPage dict={dict} />
    </div>
  );
}
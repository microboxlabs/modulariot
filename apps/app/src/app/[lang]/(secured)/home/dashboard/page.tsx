import { DashboardProvider, DashboardView } from "@/features/dashboard";
import { getDictionary } from "@/features/i18n/i18n.service";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";

export default async function DashboardPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);

  return (
    <div className="h-full overflow-auto p-4">
      <DashboardProvider dictionary={dictionary}>
        <DashboardView />
      </DashboardProvider>
    </div>
  );
}

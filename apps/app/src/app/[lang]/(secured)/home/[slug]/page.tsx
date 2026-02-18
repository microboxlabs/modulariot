import { DashboardProvider, DashboardView } from "@/features/dashboard";
import { getDictionary } from "@/features/i18n/i18n.service";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { loadDefaultConfig } from "./load-default-config";

interface SlugPageParams extends ParamsWithLang {
  params: Promise<{ lang: string; slug: string }>;
}

export default async function SlugDashboardPage({ params }: SlugPageParams) {
  const { lang, slug } = await params;
  const [, dictionary] = await getDictionary(lang);

  // e.g. "dashboard" → "dashboard-config", "maintenanceStatus" → "maintenanceStatus-config"
  const storageKey = `${slug}-config`;

  // Try to load a default config from src/features/dashboard/defaults/{slug}-config.json
  // Returns null if the file doesn't exist — dashboard starts empty as usual
  const defaultConfig = loadDefaultConfig(slug);

  return (
    <div className="h-full overflow-auto p-4">
      <DashboardProvider
        dictionary={dictionary}
        storageKey={storageKey}
        defaultConfig={defaultConfig}
      >
        <DashboardView />
      </DashboardProvider>
    </div>
  );
}

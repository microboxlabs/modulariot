import { DashboardProvider, DashboardView } from "@/features/dashboard";
import { getDictionary } from "@/features/i18n/i18n.service";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { loadDefaultConfig } from "./load-default-config";
import { auth } from "@/auth";
import { getUserSites } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

interface SlugPageParams extends ParamsWithLang {
  params: Promise<{ lang: string; slug: string }>;
}

export default async function SlugDashboardPage({ params }: Readonly<SlugPageParams>) {
  const { lang, slug } = await params;

  // Run independent async work in parallel
  const [dictionaryResult, session] = await Promise.all([
    getDictionary(lang),
    auth(),
  ]);
  const [, dictionary] = dictionaryResult;

  // e.g. "dashboard" → "dashboard-config", "maintenanceStatus" → "maintenanceStatus-config"
  const storageKey = `${slug}-config`;

  // Try to load a default config from src/features/dashboard/defaults/{slug}-config.json
  // Returns null if the file doesn't exist — dashboard starts empty as usual
  const defaultConfig = loadDefaultConfig(slug);

  // Resolve user's primary site for Alfresco persistence
  let siteId: string | null = null;
  if (session) {
    try {
      const sites = await getUserSites(session);
      if (sites.length > 0) {
        siteId = sites[0].shortName;
      }
    } catch {
      // If site resolution fails, fall back to localStorage-only mode
    }
  }

  return (
    <div className="h-full overflow-auto p-4">
      <DashboardProvider
        dictionary={dictionary}
        storageKey={storageKey}
        defaultConfig={defaultConfig}
        siteId={siteId}
      >
        <DashboardView />
      </DashboardProvider>
    </div>
  );
}

import { redirect } from "next/navigation";
import { DashboardProvider, DashboardView } from "@/features/dashboard";
import { getDictionary } from "@/features/i18n/i18n.service";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { loadDefaultConfig } from "./load-default-config";
import { auth } from "@/auth";
import {
  getUserSites,
  getDashboardConfig,
  getGroupsForPerson,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { RouteGuard } from "@/features/auth/components/route-guard";

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

  // Try to load a default config from src/features/dashboard/defaults/{slug}-config.json
  // Returns null if the file doesn't exist — dashboard starts empty as usual
  const defaultConfig = loadDefaultConfig(slug);

  // Resolve user's primary site for Alfresco persistence
  let siteId: string | null = null;
  if (session) {
    try {
      const sites = await getUserSites(session);
      if (sites.length > 0) {
        const sorted = [...sites].sort((a, b) =>
          a.shortName.localeCompare(b.shortName)
        );
        siteId = sorted[0].shortName;
      }
    } catch {
      // If site resolution fails, fall back to default config only
    }
  }

  // Per-dashboard group access check
  if (session && siteId) {
    try {
      const dashboardConfig = await getDashboardConfig(session, siteId, slug);
      const configData = dashboardConfig.data as Record<string, unknown> | null;
      const allowed = configData?.allowedGroups;
      if (Array.isArray(allowed) && allowed.length > 0) {
        const userGroups = await getGroupsForPerson(session);
        if (!allowed.some((g: string) => userGroups.includes(g))) {
          redirect(`/${lang}/home`);
        }
      }
    } catch {
      // If config fetch fails, let the page render with default/empty config
    }
  }

  return (
    <RouteGuard path="/home" fallbackPath={`/${lang}/home`}>
      <div className="h-full overflow-auto p-4">
        <DashboardProvider
          dictionary={dictionary}
          slug={slug}
          defaultConfig={defaultConfig}
          siteId={siteId}
        >
          <DashboardView />
        </DashboardProvider>
      </div>
    </RouteGuard>
  );
}

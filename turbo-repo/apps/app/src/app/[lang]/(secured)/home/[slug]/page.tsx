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
import { logger } from "@/lib/logger";

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
    let dashboardConfig: { data: unknown };
    try {
      dashboardConfig = await getDashboardConfig(session, siteId, slug);
    } catch (error) {
      // Not-found means no saved config yet — fall through to default rendering.
      // Any other error (network, 500, auth) is unexpected — deny access.
      const status = (error as { status?: number }).status;
      if (status === 404) {
        dashboardConfig = { data: null };
      } else {
        logger.error({ err: error, slug, siteId }, "Failed to fetch dashboard config for access check");
        redirect(`/${lang}/home`);
      }
    }

    const configData = dashboardConfig.data as Record<string, unknown> | null;
    const allowed = configData?.allowedGroups;

    // If allowedGroups is present but malformed, treat as misconfigured — deny access
    if (allowed !== undefined && allowed !== null) {
      if (
        !Array.isArray(allowed) ||
        !allowed.every((g): g is string => typeof g === "string")
      ) {
        logger.error({ slug, siteId, allowedGroups: allowed }, "Malformed allowedGroups in dashboard config");
        redirect(`/${lang}/home`);
      }

      if (allowed.length > 0) {
        let userGroups: string[];
        try {
          userGroups = await getGroupsForPerson(session);
        } catch (error) {
          logger.error({ err: error, slug }, "Failed to fetch user groups for dashboard access check");
          redirect(`/${lang}/home`);
        }
        if (!allowed.some((g) => userGroups.includes(g))) {
          redirect(`/${lang}/home`);
        }
      }
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

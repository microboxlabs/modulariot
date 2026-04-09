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
import type { Session } from "next-auth";

/** Resolve the user's primary Alfresco site. Returns null when the user has no sites. Throws on errors. */
async function resolvePrimarySite(session: Session): Promise<string | null> {
  const sites = await getUserSites(session);
  if (sites.length === 0) return null;
  const sorted = [...sites].sort((a, b) =>
    a.shortName.localeCompare(b.shortName)
  );
  return sorted[0].shortName;
}

/**
 * Fetch the dashboard config and verify the user has access based on
 * allowedGroups. Redirects to the overview page if access is denied.
 */
async function enforceDashboardAccess(
  session: Session,
  siteId: string,
  slug: string,
  lang: string
): Promise<void> {
  let configData: Record<string, unknown> | null = null;

  try {
    const result = await getDashboardConfig(session, siteId, slug);
    configData = result.data as Record<string, unknown> | null;
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 404) return; // No saved config yet — allow default rendering
    logger.error({ err: error, slug, siteId }, "Failed to fetch dashboard config for access check");
    redirect(`/${lang}/home`);
  }

  const allowed = configData?.allowedGroups;
  if (allowed === undefined || allowed === null) return;

  if (!Array.isArray(allowed) || !allowed.every((g): g is string => typeof g === "string")) {
    logger.error({ slug, siteId, allowedGroups: allowed }, "Malformed allowedGroups in dashboard config");
    redirect(`/${lang}/home`);
  }

  if (allowed.length === 0) return;

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

interface SlugPageParams extends ParamsWithLang {
  params: Promise<{ lang: string; slug: string }>;
}

export default async function SlugDashboardPage({ params }: Readonly<SlugPageParams>) {
  const { lang, slug } = await params;

  const [dictionaryResult, session] = await Promise.all([
    getDictionary(lang),
    auth(),
  ]);
  const [, dictionary] = dictionaryResult;

  const defaultConfig = loadDefaultConfig(slug);

  let siteId: string | null = null;
  if (session) {
    try {
      siteId = await resolvePrimarySite(session);
    } catch (error) {
      logger.error({ err: error }, "Failed to resolve primary site for dashboard access");
      redirect(`/${lang}/home`);
    }
  }

  if (session && siteId) {
    await enforceDashboardAccess(session, siteId, slug, lang);
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

"use client";

import { useMemo, useState } from "react";
import { HiPlus } from "react-icons/hi";
import { useUnsavedNavigation } from "@/features/common/hooks/use-unsaved-navigation";
import { useRouter } from "next/navigation";
import useSWR, { SWRConfig } from "swr";
import { useDashboardAutosave } from "@microboxlabs/miot-dashboard-ui/react";
import { useSession } from "next-auth/react";
import { Button } from "flowbite-react";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { createDashboardServerClient } from "../services/dashboard-server-client";
import { DEFAULT_STORAGE } from "../types/dashboard.types";
import { useDashboardDocument } from "../hooks/use-dashboard-document";
import { DashboardProvider } from "../context/dashboard-context";
import {
  DashboardQuerySession,
  SavedQueryResults,
} from "../context/saved-query-context";
import { ServerDashboardQueries } from "./server-dashboard-queries";
import { DashboardView } from "./dashboard-view";
import type { DashboardSettingsHost } from "./dashboard-settings-dropdown/dashboard-settings-dropdown";
import { ServerDashboardPermissions } from "./server-dashboard-permissions";
import { ServerCreateDashboardModal } from "./server-create-dashboard-modal";
import { DashboardLandingHero } from "./dashboard-landing/dashboard-landing-hero";
import { DashboardCard } from "./dashboard-landing/dashboard-card";

type Props = { lang: string; slug?: string; dictionary: I18nRecord };
const EMPTY_QUERIES: NonNullable<typeof DEFAULT_STORAGE.queries> = [];

/** Parallel entry point: organization membership replaces legacy site discovery. */
export function ServerDashboardsPage(props: Readonly<Props>) {
  const { data: session, status } = useSession();
  if (status !== "authenticated" || !session?.user?.id || session.error)
    return (
      <output className="block p-6">
        {tr("dashboard.server.loading", props.dictionary)}
      </output>
    );
  return <AuthenticatedWorkspace key={session.user.id} {...props} />;
}

function AuthenticatedWorkspace(props: Readonly<Props>) {
  const [sessionKey] = useState(() => crypto.randomUUID());
  const [cache] = useState(() => new Map());
  const swr = useMemo(() => ({ provider: () => cache }), [cache]);
  return (
    <SWRConfig value={swr}>
      <OrganizationDashboards {...props} sessionKey={sessionKey} />
    </SWRConfig>
  );
}

function OrganizationDashboards(
  props: Readonly<Props & { sessionKey: string }>
) {
  const { activeOrg, error, isLoading } = useOrgScopes();
  const t = (key: string) => tr(`dashboard.server.${key}`, props.dictionary);
  if (error)
    return (
      <p role="alert" className="p-6">
        {t("loadError")}
      </p>
    );
  if (isLoading || !activeOrg)
    return <output className="block p-6">{t("loading")}</output>;
  return props.slug ? (
    <ServerDashboardEditor
      key={`${activeOrg.slug}/${props.slug}`}
      {...props}
      slug={props.slug}
      org={activeOrg.slug}
    />
  ) : (
    <ServerDashboardList key={activeOrg.slug} {...props} org={activeOrg.slug} />
  );
}

function ServerDashboardList({
  org,
  lang,
  dictionary,
}: Readonly<Props & { org: string }>) {
  const client = useMemo(() => createDashboardServerClient(org), [org]);
  const { data, error, isLoading } = useSWR(client.key(), () => client.list(), {
    shouldRetryOnError: false,
  });
  const {
    data: scope,
    error: scopeError,
    isValidating: checkingScope,
  } = useSWR(client.scopeKey, () => client.scopeCapabilities(), {
    shouldRetryOnError: false,
    revalidateOnMount: true,
  });
  const canCreate = !scopeError && !checkingScope && scope?.canCreate === true;
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const t = (key: string) => tr(`dashboard.server.${key}`, dictionary);
  return (
    <div className="flex h-full w-full flex-col items-center overflow-y-auto px-4 py-16">
      <DashboardLandingHero dict={dictionary} />
      {canCreate && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800"
        >
          <HiPlus className="mr-2 h-4 w-4" />
          {tr("dashboard.landing.cta", dictionary)}
        </button>
      )}
      <ServerCreateDashboardModal
        isOpen={creating && canCreate}
        onClose={() => setCreating(false)}
        onCreated={(slug) =>
          router.push(`/${lang}/dashboards/${encodeURIComponent(slug)}`)
        }
        client={client}
        existingSlugs={data?.map((d) => d.slug) ?? []}
        dict={dictionary}
      />
      <div className="mt-12 w-full max-w-3xl">
        {(error || scopeError) && (
          <p role="alert" className="py-4 text-center text-sm text-red-600">
            {t("loadError")}
          </p>
        )}
        {isLoading && (
          <output className="flex justify-center py-8">
            <span className="sr-only">{t("loading")}</span>
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </output>
        )}
        {data?.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {t("empty")}
          </p>
        )}
        {!!data?.length && (
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((dashboard) => (
              <DashboardCard
                key={dashboard.slug}
                slug={dashboard.slug}
                name={dashboard.name}
                href={`/${lang}/dashboards/${encodeURIComponent(dashboard.slug)}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ServerDashboardEditor({
  org,
  slug,
  lang,
  dictionary,
  sessionKey,
}: Readonly<Props & { org: string; slug: string; sessionKey: string }>) {
  const t = (key: string) => tr(`dashboard.server.${key}`, dictionary);
  const empty = useMemo(
    () => ({
      ...DEFAULT_STORAGE,
      name: tr("dashboard.server.newName", dictionary),
    }),
    [dictionary]
  );
  const document = useDashboardDocument(org, slug, empty, sessionKey);
  const router = useRouter();
  const [removing, setRemoving] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [removeError, setRemoveError] = useState(false);
  useUnsavedNavigation(document.dirty, t("leave"));
  useDashboardAutosave({
    ...document,
    enabled:
      document.capabilities?.canEdit === true &&
      !document.readOnly &&
      !removing,
  });
  async function reload() {
    if (!document.dirty || globalThis.confirm(t("discard")))
      await document.discardAndReload();
  }
  async function remove() {
    if (removing || document.busy) return;
    setRemoving(true);
    setRemoveError(false);
    try {
      await document.client.remove(slug);
      router.push(`/${lang}/dashboards`);
    } catch {
      setRemoveError(true);
    } finally {
      setRemoving(false);
    }
  }
  if (!document.isLoaded)
    return (
      <p className="p-6" role={document.error ? "alert" : "status"}>
        {t(document.error ? "loadError" : "loading")}
      </p>
    );
  if (!document.exists)
    return (
      <p role="alert" className="p-6">
        {t("loadError")}
      </p>
    );
  const editable = !document.readOnly && !removing;
  const settingsHost: DashboardSettingsHost = {
    queries: (
      <ServerDashboardQueries
        client={document.client}
        slug={slug}
        sessionKey={sessionKey}
        editable={editable}
        dictionary={dictionary}
      />
    ),
    canManagePermissions: document.capabilities?.canManagePermissions === true,
    onManagePermissions: () => setPermissionsOpen(true),
    onDelete: document.capabilities?.canDelete ? remove : undefined,
  };
  // Changes save on their own; a failed save keeps the draft and offers a reload.
  const headerActions = document.dirty && (
    <div className="flex items-center gap-2">
      <output className="text-sm text-gray-500 dark:text-gray-400">
        {t(document.error ? "unsaved" : "saving")}
      </output>
      {document.error !== null && (
        <Button
          size="sm"
          color="light"
          disabled={document.busy || removing}
          onClick={() => void reload()}
        >
          {t("reload")}
        </Button>
      )}
    </div>
  );
  return (
    <div className="flex h-full min-h-0 flex-col">
      {(document.error || removeError) && (
        <p role="alert" className="p-3 text-red-600">
          {t(document.error === 409 ? "conflict" : "saveError")}
        </p>
      )}
      {permissionsOpen &&
        document.capabilities?.canManagePermissions &&
        !removing && (
          <ServerDashboardPermissions
            key={`${sessionKey}/${org}/${slug}`}
            client={document.client}
            slug={slug}
            sessionKey={sessionKey}
            dictionary={dictionary}
            dashboardName={document.config.name ?? slug}
            onClose={() => setPermissionsOpen(false)}
          />
        )}
      <DashboardQuerySession
        sessionKey={sessionKey}
        client={document.client}
        slug={slug}
        queries={document.config.queries ?? EMPTY_QUERIES}
        errorMessage={t("queryError")}
      >
        <DashboardProvider
          key={document.editorKey}
          slug={slug}
          dictionary={dictionary}
          dataProvider={SavedQueryResults}
          storage={{
            config: document.config,
            isLoaded: document.isLoaded,
            readOnly: document.readOnly || removing,
            onChange: document.onChange,
          }}
        >
          <DashboardView
            headerActions={headerActions}
            settingsHost={settingsHost}
          />
        </DashboardProvider>
      </DashboardQuerySession>
    </div>
  );
}

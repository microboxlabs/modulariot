"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useUnsavedNavigation } from "@/features/common/hooks/use-unsaved-navigation";
import { useRouter } from "next/navigation";
import { SWRConfig, useSWRConfig } from "swr";
import { useDashboardAutosave } from "@microboxlabs/miot-dashboard-ui/react";
import { useSession } from "next-auth/react";
import { Button } from "flowbite-react";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
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
import ExplorerPanel, {
  type ExplorerPageFolder,
} from "./dashboard-explorer/explorer-panel";
import SettingsPageShell from "@/features/common/components/settings-page-shell";
import {
  HiOutlineDocumentMagnifyingGlass,
  HiOutlineFolder,
  HiOutlineSquares2X2,
} from "react-icons/hi2";
import {
  ExplorerNewMenuSkeleton,
  ExplorerPageSkeleton,
} from "./dashboard-explorer/explorer-skeleton";
import { LIST_FRAME_CLASS } from "./dashboard-explorer/explorer-columns";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { createDashboardFolderClient } from "../services/dashboard-folder-client";
import { recentsKey } from "./dashboard-explorer/use-explorer-server";
import { useDashboardFolderPath } from "../hooks/use-dashboard-folder-path";
import { LoadErrorState } from "./load-error-state";

type Props = { lang: string; slug?: string; dictionary: I18nRecord };
const EMPTY_QUERIES: NonNullable<typeof DEFAULT_STORAGE.queries> = [];
/**
 * The list page's frame, as on the settings pages (Conexiones): the
 * breadcrumb bar, then the icon, title and description with the "New" menu
 * beside them, then the list. Inside a folder the header is the folder's,
 * with a back arrow, and the breadcrumb leads back up through its parents.
 */
function ListPage({
  lang,
  dictionary,
  action,
  folder,
  children,
}: Readonly<{
  lang: string;
  dictionary: I18nRecord;
  action: ReactNode;
  folder?: ExplorerPageFolder | null;
  children: ReactNode;
}>) {
  const layout = dictionary.layout as I18nRecord | undefined;
  const secured = layout?.secured as I18nRecord | undefined;
  return (
    <SettingsPageShell
      breadcrumbDict={(secured?.sidebar as I18nRecord | undefined) ?? {}}
      lang={lang}
      path={["dashboardServer"]}
      icon={folder ? HiOutlineFolder : HiOutlineSquares2X2}
      rootIcon={<HiOutlineSquares2X2 className="mr-2 h-4 w-4" />}
      title={folder?.name ?? tr("dashboard.explorer.title", dictionary)}
      description={
        folder?.summary ?? tr("dashboard.explorer.description", dictionary)
      }
      breadcrumb={folder?.breadcrumb}
      actions={action}
    >
      {children}
    </SettingsPageShell>
  );
}

/** The shape of the page about to load, rather than a "Loading…" line. */
function PageSkeleton({
  slug,
  lang,
  dictionary,
}: Readonly<{ slug?: string; lang: string; dictionary: I18nRecord }>) {
  const label = tr("dashboard.server.loading", dictionary);
  if (slug) return <DashboardSkeleton label={label} />;
  const t = (key: string) => tr(`dashboard.explorer.${key}`, dictionary);
  return (
    <ListPage
      lang={lang}
      dictionary={dictionary}
      action={<ExplorerNewMenuSkeleton t={t} />}
    >
      <ExplorerPageSkeleton t={t} label={label} />
    </ListPage>
  );
}

/**
 * The organization could not be read, so neither the list nor a dashboard
 * can be: the list page keeps its frame, with the error where the list goes.
 */
function ScopesError({
  slug,
  lang,
  dictionary,
  onRetry,
}: Readonly<{
  slug?: string;
  lang: string;
  dictionary: I18nRecord;
  onRetry: () => Promise<unknown>;
}>) {
  const t = (key: string) => tr(`dashboard.server.${key}`, dictionary);
  const state = (
    <LoadErrorState
      title={t("loadError")}
      description={t("loadErrorBody")}
      retry={{ label: t("retry"), onRetry }}
      className={slug ? "h-full" : undefined}
    />
  );
  if (slug) return state;
  return (
    <ListPage lang={lang} dictionary={dictionary} action={null}>
      <div className={LIST_FRAME_CLASS}>{state}</div>
    </ListPage>
  );
}

/** Parallel entry point: organization membership replaces legacy site discovery. */
export function ServerDashboardsPage(props: Readonly<Props>) {
  const { data: session, status } = useSession();
  if (status !== "authenticated" || !session?.user?.id || session.error)
    return (
      <PageSkeleton
        slug={props.slug}
        lang={props.lang}
        dictionary={props.dictionary}
      />
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
  const { activeOrg, error, isLoading, refresh } = useOrgScopes();
  if (error)
    return (
      <ScopesError
        slug={props.slug}
        lang={props.lang}
        dictionary={props.dictionary}
        onRetry={refresh}
      />
    );
  if (isLoading || !activeOrg)
    return (
      <PageSkeleton
        slug={props.slug}
        lang={props.lang}
        dictionary={props.dictionary}
      />
    );
  return props.slug ? (
    <ServerDashboardEditor
      key={`${activeOrg.slug}/${props.slug}`}
      {...props}
      slug={props.slug}
      org={activeOrg.slug}
    />
  ) : (
    <ServerDashboardList key={activeOrg.slug} {...props} />
  );
}

/** The organization's dashboards and folders, and the menu that creates them. */
function ServerDashboardList({ lang, dictionary }: Readonly<Props>) {
  return (
    <ExplorerPanel
      dict={dictionary.dashboard as I18nRecord}
      renderPage={({ newMenu, list, folder }) => (
        <ListPage
          lang={lang}
          dictionary={dictionary}
          action={newMenu}
          folder={folder}
        >
          {list}
        </ListPage>
      )}
    />
  );
}

/**
 * Notes that the caller opened the dashboard, once it has loaded, for their
 * "Recently opened" cards. Best effort: a failure changes nothing on the page.
 */
function useRecordOpen(org: string, slug: string, opened: boolean) {
  const { mutate } = useSWRConfig();
  useEffect(() => {
    if (!opened) return;
    createDashboardFolderClient(org)
      .recordOpen(slug)
      .then(() => mutate(recentsKey(org)))
      .catch(() => undefined);
  }, [org, slug, opened, mutate]);
}

function ServerDashboardEditor({
  org,
  slug,
  lang,
  dictionary,
  sessionKey,
}: Readonly<Props & { org: string; slug: string; sessionKey: string }>) {
  const t = (key: string) => tr(`dashboard.server.${key}`, dictionary);
  const folderPath = useDashboardFolderPath(org, slug);
  const folderCrumbs = useMemo(
    () =>
      folderPath.map((folder) => ({
        name: folder.name,
        href: `/${lang}/dashboards?folder=${encodeURIComponent(folder.id)}`,
      })),
    [folderPath, lang]
  );
  const empty = useMemo(
    () => ({
      ...DEFAULT_STORAGE,
      name: tr("dashboard.server.newName", dictionary),
    }),
    [dictionary]
  );
  const document = useDashboardDocument(org, slug, empty, sessionKey);
  const documentRef = useRef(document);
  documentRef.current = document;
  const router = useRouter();
  const [removing, setRemoving] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [removeError, setRemoveError] = useState(false);
  useUnsavedNavigation(document.dirty, t("leave"));
  useRecordOpen(org, slug, document.isLoaded && document.exists);
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
  if (!document.isLoaded && !document.error)
    return <DashboardSkeleton label={t("loading")} />;
  const backToList = { label: t("backToList"), href: `/${lang}/dashboards` };
  if (!document.isLoaded)
    return (
      <LoadErrorState
        className="h-full"
        title={t("openError")}
        description={t("openErrorBody")}
        retry={{ label: t("retry"), onRetry: document.discardAndReload }}
        back={backToList}
      />
    );
  if (!document.exists)
    return (
      <LoadErrorState
        className="h-full"
        tone="neutral"
        icon={HiOutlineDocumentMagnifyingGlass}
        title={t("missing")}
        description={t("missingBody")}
        back={backToList}
      />
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
    permissions: { client: document.client, slug, sessionKey },
    saveDetails: async (details) => {
      const current = documentRef.current;
      if (
        removing ||
        current.readOnly ||
        current.busy ||
        current.editorKey !== document.editorKey
      )
        return false;
      const attempted = { ...current.config, ...details };
      if (!current.onChange(attempted)) return false;
      documentRef.current = { ...current, config: attempted };
      const saved = await current.save();
      const latest = documentRef.current;
      if (!saved && latest.editorKey === current.editorKey) {
        // Restore only the attempted details, keeping unrelated edits made
        // while the request was pending. Setup decisions use confirmed values.
        const restored = { ...latest.config };
        for (const field of ["tags", "started", "visibility"] as const) {
          if (!(field in details) || latest.config[field] !== details[field])
            continue;
          Object.assign(restored, { [field]: current.config[field] });
          if (current.config[field] === undefined) delete restored[field];
        }
        if (latest.onChange(restored)) {
          documentRef.current = { ...latest, config: restored };
        }
      }
      return saved;
    },
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
            breadcrumbRoot="dashboardServer"
            breadcrumbRootHref={`/${lang}/dashboards`}
            breadcrumbFolders={folderCrumbs}
          />
        </DashboardProvider>
      </DashboardQuerySession>
    </div>
  );
}

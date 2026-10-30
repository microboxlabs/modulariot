"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Spinner } from "flowbite-react";
import {
  HiOutlineDatabase,
  HiOutlineLink,
  HiOutlineTemplate,
  HiPlus,
} from "react-icons/hi";
import { toast } from "sonner";
import LayoutToggle, {
  type CatalogLayout,
} from "@/features/common/components/layout-toggle";
import SettingsPageShell from "@/features/common/components/settings-page-shell";
import SectionMenu, {
  type SectionMenuEntry,
} from "@/features/common/components/section-menu";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import { connectManagedBigQuery } from "@/features/settings-admin/platform/org-service-account";
import { useIsPlatformOwner } from "@/features/settings-admin/platform/use-platform-membership";
import {
  connectManagedGeocoding,
  removeManagedGeocoding,
} from "@/features/settings-admin/platform/org-geocoding-connection";
import { PLATFORM_SCOPE_SLUG } from "@/features/common/platform-scope";
import { ManagedGeocodingProviderModal } from "./managed-geocoding-provider-modal";
import {
  connectionTypeName,
  isPlatformManaged,
  DEFAULT_CONNECTION_FILTERS,
  DEFAULT_CONNECTION_SORT,
  filterConnections,
  hasActiveConnectionFilters,
  sortConnections,
  type ConnectionFilters,
  type ConnectionSort,
} from "../connection-catalog";
import { useIntegrationConfig } from "../use-integration-config";
import type {
  IntegrationConnection,
  IntegrationTemplate,
  NativeProvider,
} from "../integration-config.types";
import { ConnectionsList } from "./connections-list";
import { ConnectionsToolbar } from "./connections-toolbar";
import { TemplatesList } from "./templates-list";
import { TemplateFormModal } from "./template-form-modal";
import { TemplatePickerModal } from "./template-picker-modal";
import { ConnectionFormModal } from "./connection-form-modal";
import { IntegrationDeleteDialog } from "./integration-delete-dialog";
import { PostgrestFunctionsModal } from "./postgrest-functions-modal";
import { QueryEditorSection } from "./query-editor-section";

type ConnectionsSection = "connections" | "templates" | "bigquery";
const SECTIONS: readonly ConnectionsSection[] = [
  "connections",
  "templates",
  "bigquery",
];

function sectionOf(params: URLSearchParams): ConnectionsSection {
  const value = params.get("section");
  return SECTIONS.find((section) => section === value) ?? "connections";
}

interface IntegrationConfigPageContentProps {
  /** `pages.integrationConnections` subtree. */
  readonly dict: I18nRecord;
  /** `pages.userSettings.breadcrumb` — the trail is shared with the other settings pages. */
  readonly breadcrumbDict: I18nRecord;
  /** Root dictionary — the shared filter badges translate from it. */
  readonly rootDict: I18nRecord;
  readonly lang: string;
}

/**
 * Settings › Connections.
 *
 * Two lists, one contract. A **template** is a reusable type: it owns the payload the
 * review process maps against. A **connection** is an instance of one, with its own
 * endpoint and credential — so the same partner can exist twice, QA and production,
 * speaking the same payload.
 *
 * Adding a connection runs the same two steps as adding a credential: pick the type,
 * then fill its form.
 *
 * Backed by miot-integrations through the org admin proxy, which requires organization-
 * owner access and answers 403 to everyone else — hence the forbidden state below.
 */
export function IntegrationConfigPageContent({
  dict,
  breadcrumbDict,
  rootDict,
  lang,
}: Readonly<IntegrationConfigPageContentProps>) {
  const { activeOrg } = useOrgScopes();
  const orgSlug = activeOrg?.slug ?? null;
  const inPlatformScope = orgSlug === PLATFORM_SCOPE_SLUG;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const section = sectionOf(params);
  const sectionsDict = dict?.sections as I18nRecord;
  // The dashboard server lets organization owners save queries; admins read and run them.
  const canSaveQueries =
    activeOrg?.role === "OWNER" || activeOrg?.role === "PLATFORM_OWNER";

  /** Writes the section and its own parameters to the URL, dropping the others. */
  function navigate(
    next: ConnectionsSection,
    extra: Record<string, string | null> = {}
  ) {
    const query = new URLSearchParams();
    if (next !== "connections") query.set("section", next);
    for (const [key, value] of Object.entries(extra)) {
      if (value) query.set(key, value);
    }
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  const sections: SectionMenuEntry<ConnectionsSection>[] = [
    {
      id: "connections",
      label: tr("connections", sectionsDict),
      description: tr("connectionsHelp", sectionsDict),
      icon: HiOutlineLink,
    },
    {
      id: "templates",
      label: tr("templates", sectionsDict),
      description: tr("templatesHelp", sectionsDict),
      icon: HiOutlineTemplate,
    },
    {
      id: "bigquery",
      label: tr("bigquery", sectionsDict),
      description: tr("bigqueryHelp", sectionsDict),
      icon: HiOutlineDatabase,
      group: tr("editors", sectionsDict),
    },
  ];
  const {
    templates,
    connections,
    credentials,
    isLoading,
    error,
    saving,
    saveTemplate,
    removeTemplate,
    saveConnection,
    removeConnection,
    testInstance,
    testDraft,
    refresh,
  } = useIntegrationConfig(orgSlug);
  const { isPlatformOwner } = useIsPlatformOwner();

  const [templateModal, setTemplateModal] = useState<{
    open: boolean;
    template?: IntegrationTemplate;
  }>({ open: false });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [providerSetupOpen, setProviderSetupOpen] = useState(false);
  const [connectionModal, setConnectionModal] = useState<{
    open: boolean;
    connection?: IntegrationConnection;
    template?: IntegrationTemplate;
    providerType?: NativeProvider;
  }>({ open: false });
  const [functionsFor, setFunctionsFor] =
    useState<IntegrationConnection | null>(null);
  const [deletingTemplate, setDeletingTemplate] =
    useState<IntegrationTemplate | null>(null);
  const [deletingConnection, setDeletingConnection] =
    useState<IntegrationConnection | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [filters, setFilters] = useState<ConnectionFilters>(
    DEFAULT_CONNECTION_FILTERS
  );
  const [sort, setSort] = useState<ConnectionSort>(DEFAULT_CONNECTION_SORT);
  const [layout, setLayout] = useState<CatalogLayout>("cards");

  const types = useMemo(
    () =>
      [
        ...new Set(
          connections.map((connection) =>
            connectionTypeName(connection, templates)
          )
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [connections, templates]
  );
  const visible = useMemo(
    () =>
      sortConnections(filterConnections(connections, templates, filters), sort),
    [connections, templates, filters, sort]
  );

  const instanceCount = (templateId: string) =>
    connections.filter((connection) => connection.templateId === templateId)
      .length;

  /** Step 1 of adding a connection: choose the type it will instance. */
  function handleAddConnection() {
    setConnectionModal({ open: false });
    setPickerOpen(true);
  }

  function handleTemplatePicked(template: IntegrationTemplate) {
    setPickerOpen(false);
    setConnectionModal({ open: true, template });
  }

  function handleNativePicked(providerType: NativeProvider) {
    setPickerOpen(false);
    setConnectionModal({ open: true, providerType });
  }

  /**
   * Creates the organization's connection to the platform's geocoding provider, once.
   * Without a platform provider (409) it asks for one first.
   */
  async function handleManagedGeocoding() {
    if (!orgSlug) return;
    setPickerOpen(false);
    // The Plataforma scope holds the provider itself, not a managed connection to it.
    if (inPlatformScope) {
      setProviderSetupOpen(true);
      return;
    }
    const pending = toast.loading(tr("toast.managedGeocodingCreating", dict));
    try {
      await connectManagedGeocoding(orgSlug);
      refresh();
      toast.success(tr("toast.managedGeocodingCreated", dict), { id: pending });
    } catch (cause) {
      if ((cause as { status?: number }).status === 409) {
        toast.dismiss(pending);
        setProviderSetupOpen(true);
        return;
      }
      toast.error(messageOf(cause, tr("toast.actionFailed", dict)), {
        id: pending,
      });
    }
  }

  async function handleProviderSaved() {
    setProviderSetupOpen(false);
    if (inPlatformScope) {
      refresh();
      toast.success(tr("toast.platformGeocodingSaved", dict));
      return;
    }
    await handleManagedGeocoding();
  }

  /** Creates the organization's account if missing and the BigQuery connection that queries as it. */
  async function handleManagedBigQuery() {
    if (!orgSlug) return;
    setPickerOpen(false);
    const pending = toast.loading(tr("toast.managedBigqueryCreating", dict));
    try {
      const created = await connectManagedBigQuery(orgSlug);
      refresh();
      if (created.tested) {
        toast.success(tr("toast.managedBigqueryCreated", dict), {
          id: pending,
          description: created.testMessage ?? undefined,
        });
      } else {
        toast.error(created.testMessage ?? tr("toast.testFailed", dict), {
          id: pending,
        });
      }
    } catch (cause) {
      toast.error(messageOf(cause, tr("toast.actionFailed", dict)), {
        id: pending,
      });
    }
  }

  function handleEditConnection(connection: IntegrationConnection) {
    setConnectionModal({
      open: true,
      connection,
      template: templates.find(
        (template) => template.id === connection.templateId
      ),
    });
  }

  /** Deleting from the record: close it first, then confirm. */
  function handleDeleteConnectionFromModal(connection: IntegrationConnection) {
    setConnectionModal({ open: false });
    setDeletingConnection(connection);
  }

  function handleDeleteTemplateFromModal(template: IntegrationTemplate) {
    setTemplateModal({ open: false });
    setDeletingTemplate(template);
  }

  async function handleDeleteTemplate() {
    if (!deletingTemplate) return;
    try {
      await removeTemplate(deletingTemplate.id);
      toast.success(tr("toast.templateDeleted", dict));
      setDeletingTemplate(null);
    } catch (cause) {
      toast.error(messageOf(cause, tr("toast.actionFailed", dict)));
    }
  }

  async function handleDeleteConnection() {
    if (!deletingConnection) return;
    try {
      if (
        !inPlatformScope &&
        isPlatformManaged(deletingConnection) &&
        orgSlug
      ) {
        await removeManagedGeocoding(orgSlug);
        refresh();
      } else {
        await removeConnection(deletingConnection.id);
      }
      toast.success(tr("toast.connectionDeleted", dict));
      setDeletingConnection(null);
    } catch (cause) {
      toast.error(messageOf(cause, tr("toast.actionFailed", dict)));
    }
  }

  /**
   * Test from the row. Unlike credentials — where only some types can be verified at
   * all — every connection is testable, so the action is worth having without opening
   * the record; the same button lives inside the form for the record being edited.
   */
  async function handleTest(connection: IntegrationConnection) {
    setTesting(connection.id);
    try {
      const result = await testInstance(connection.id);
      if (result.success) {
        toast.success(tr("toast.testOk", dict), {
          description: result.message ?? undefined,
        });
      } else {
        toast.error(result.message ?? tr("toast.testFailed", dict));
      }
    } catch (cause) {
      toast.error(messageOf(cause, tr("toast.testFailed", dict)));
    } finally {
      setTesting(null);
    }
  }

  const openManagedProvider = inPlatformScope
    ? () => setProviderSetupOpen(true)
    : undefined;
  const selectManagedGeocoding = isPlatformOwner
    ? () => void handleManagedGeocoding()
    : undefined;
  const selectManagedBigQuery = isPlatformOwner
    ? () => void handleManagedBigQuery()
    : undefined;
  const deleteConnectionFromModal = connectionModal.connection
    ? () => handleDeleteConnectionFromModal(connectionModal.connection!)
    : undefined;

  return (
    <SettingsPageShell
      breadcrumbDict={breadcrumbDict}
      lang={lang}
      path={["user", "settings", "connections"]}
      icon={HiOutlineLink}
      title={tr("page.title", dict)}
      description={tr("page.subtitle", dict)}
      filters={
        section === "connections" && (
          <ConnectionsToolbar
            filters={filters}
            onFiltersChange={setFilters}
            sort={sort}
            onSortChange={setSort}
            types={types}
            dict={dict}
            rootDict={rootDict}
          />
        )
      }
      actions={
        section !== "bigquery" && (
          <div className="flex shrink-0 items-center gap-2">
            <LayoutToggle
              layout={layout}
              labels={{
                cards: tr("viewCards", dict),
                list: tr("viewList", dict),
              }}
              onLayout={setLayout}
            />
            {section === "connections" ? (
              <Button
                size="sm"
                color="blue"
                className="shrink-0 whitespace-nowrap"
                onClick={handleAddConnection}
                disabled={!orgSlug}
              >
                <HiPlus className="mr-1 h-4 w-4" />
                {tr("connections.new", dict)}
              </Button>
            ) : (
              <Button
                size="sm"
                color="blue"
                className="shrink-0 whitespace-nowrap"
                onClick={() => setTemplateModal({ open: true })}
                disabled={!orgSlug}
              >
                <HiPlus className="mr-1 h-4 w-4" />
                {tr("templates.new", dict)}
              </Button>
            )}
          </div>
        )
      }
    >
      {/* Below md the menu and the detail stack and scroll together; from md only the detail scrolls. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 max-md:overflow-y-auto md:grid-cols-[320px_1fr]">
        <SectionMenu
          title={tr("title", sectionsDict)}
          sections={sections}
          selected={section}
          onSelect={(next) => navigate(next)}
        />
        <div className="-m-1 flex min-h-0 flex-col gap-4 p-1 md:overflow-y-auto">
          {error && section !== "bigquery" && (
            <Alert color="failure">
              <span className="text-sm">
                {isForbidden(error)
                  ? tr("errors.forbidden", dict)
                  : tr("errors.loadFailed", dict)}
              </span>
            </Alert>
          )}

          {section === "bigquery" && orgSlug && (
            <QueryEditorSection
              orgSlug={orgSlug}
              sourceId={params.get("source") ?? undefined}
              planId={params.get("query")}
              canWrite={canSaveQueries}
              lang={lang}
              dict={dict?.queryEditor as I18nRecord}
              onSourceChange={(source) => navigate("bigquery", { source })}
              onPlanChange={(query, source) =>
                navigate("bigquery", {
                  source: source ?? params.get("source"),
                  query,
                })
              }
            />
          )}

          {section !== "bigquery" && isLoading && (
            <div className="flex justify-center py-10">
              <Spinner aria-label={tr("list.loading", dict)} />
            </div>
          )}
          {section === "connections" && !isLoading && (
            <ConnectionsList
              connections={visible}
              templates={templates}
              credentials={credentials}
              onOpen={handleEditConnection}
              onOpenManaged={openManagedProvider}
              onTest={handleTest}
              onDelete={setDeletingConnection}
              canRemoveManaged={isPlatformOwner}
              onFunctions={setFunctionsFor}
              onQueries={(connection) =>
                navigate("bigquery", { source: connection.id })
              }
              testing={testing}
              emptyMessage={
                hasActiveConnectionFilters(filters)
                  ? tr("filters.noMatches", dict)
                  : tr("connections.empty", dict)
              }
              layout={layout}
              dict={dict}
            />
          )}
          {section === "templates" && !isLoading && (
            <>
              <p className="max-w-3xl text-sm text-gray-500 dark:text-gray-400">
                {tr("templates.help", dict)}
              </p>
              <TemplatesList
                templates={templates}
                instanceCount={instanceCount}
                onOpen={(template) =>
                  setTemplateModal({ open: true, template })
                }
                onDelete={setDeletingTemplate}
                emptyMessage={tr("templates.empty", dict)}
                layout={layout}
                dict={dict}
              />
            </>
          )}
        </div>
      </div>

      <TemplateFormModal
        show={templateModal.open}
        template={templateModal.template}
        onClose={() => setTemplateModal({ open: false })}
        onSave={saveTemplate}
        onDelete={
          templateModal.template
            ? () => handleDeleteTemplateFromModal(templateModal.template!)
            : undefined
        }
        saving={saving}
        dict={dict}
      />

      <TemplatePickerModal
        show={pickerOpen}
        templates={templates}
        onClose={() => setPickerOpen(false)}
        onSelect={handleTemplatePicked}
        onSelectNative={handleNativePicked}
        onSelectManagedGeocoding={selectManagedGeocoding}
        managedGeocodingInPlatform={inPlatformScope}
        onSelectManagedBigQuery={selectManagedBigQuery}
        dict={dict}
      />

      {isPlatformOwner && (
        <ManagedGeocodingProviderModal
          isOpen={providerSetupOpen}
          mode={inPlatformScope ? "platform" : "organization"}
          dict={dict}
          providerDict={platformGeocodingDict(rootDict)}
          onClose={() => setProviderSetupOpen(false)}
          onSaved={handleProviderSaved}
        />
      )}

      <ConnectionFormModal
        show={connectionModal.open}
        connection={connectionModal.connection}
        template={connectionModal.template}
        providerType={connectionModal.providerType}
        credentials={credentials}
        onClose={() => setConnectionModal({ open: false })}
        onSave={saveConnection}
        onDelete={deleteConnectionFromModal}
        onTest={testInstance}
        onTestDraft={testDraft}
        saving={saving}
        dict={dict}
      />

      {functionsFor && orgSlug && (
        <PostgrestFunctionsModal
          orgSlug={orgSlug}
          connection={functionsFor}
          onClose={() => setFunctionsFor(null)}
          dict={dict}
        />
      )}

      <IntegrationDeleteDialog
        show={deletingConnection !== null}
        title={tr("delete.connectionTitle", dict)}
        name={deletingConnection?.name}
        onClose={() => setDeletingConnection(null)}
        onConfirm={handleDeleteConnection}
        loading={saving}
        dict={dict}
      />
      <IntegrationDeleteDialog
        show={deletingTemplate !== null}
        title={tr("delete.templateTitle", dict)}
        name={deletingTemplate?.name}
        warning={templateInUseWarning(deletingTemplate, instanceCount, dict)}
        onClose={() => setDeletingTemplate(null)}
        onConfirm={handleDeleteTemplate}
        loading={saving}
        dict={dict}
      />
    </SettingsPageShell>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The API refuses to delete a template that connections still instance. Saying so in the
 * dialog turns a 409 the operator can't act on into a step they can: clear the instances.
 */
function templateInUseWarning(
  template: IntegrationTemplate | null,
  instanceCount: (templateId: string) => number,
  dict: I18nRecord
): string | null {
  if (!template) return null;
  const count = instanceCount(template.id);
  return count === 0
    ? null
    : tr("delete.templateInUse", dict, { count: String(count) });
}

/** The API's own reason when it gave one, so a 409 names what blocked it. */
function platformGeocodingDict(rootDict: I18nRecord): I18nRecord {
  const pages = rootDict.pages as I18nRecord | undefined;
  const settings = pages?.userSettings as I18nRecord | undefined;
  const platform = settings?.platform as I18nRecord | undefined;
  return (platform?.geocoding as I18nRecord) ?? {};
}

function messageOf(cause: unknown, fallback: string): string {
  const message = cause instanceof Error ? cause.message : "";
  return message || fallback;
}

function isForbidden(error: Error): boolean {
  return (error as { status?: number }).status === 403;
}

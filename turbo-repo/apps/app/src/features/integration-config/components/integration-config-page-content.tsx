"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Spinner } from "flowbite-react";
import { HiOutlineLink, HiPlus } from "react-icons/hi";
import { toast } from "sonner";
import LayoutToggle, {
  type CatalogLayout,
} from "@/features/common/components/layout-toggle";
import SettingsPageShell from "@/features/common/components/settings-page-shell";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import {
  connectionTypeName,
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
  } = useIntegrationConfig(orgSlug);

  const [templateModal, setTemplateModal] = useState<{
    open: boolean;
    template?: IntegrationTemplate;
  }>({ open: false });
  const [pickerOpen, setPickerOpen] = useState(false);
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
      await removeConnection(deletingConnection.id);
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

  return (
    <SettingsPageShell
      breadcrumbDict={breadcrumbDict}
      lang={lang}
      path={["user", "settings", "connections"]}
      icon={HiOutlineLink}
      title={tr("page.title", dict)}
      description={tr("page.subtitle", dict)}
      filters={
        <ConnectionsToolbar
          filters={filters}
          onFiltersChange={setFilters}
          sort={sort}
          onSortChange={setSort}
          types={types}
          dict={dict}
          rootDict={rootDict}
        />
      }
      actions={
        <div className="flex shrink-0 items-center gap-2">
          <LayoutToggle
            layout={layout}
            labels={{
              cards: tr("viewCards", dict),
              list: tr("viewList", dict),
            }}
            onLayout={setLayout}
          />
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
        </div>
      }
    >
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 pb-1">
        {error && (
          <Alert color="failure">
            <span className="text-sm">
              {isForbidden(error)
                ? tr("errors.forbidden", dict)
                : tr("errors.loadFailed", dict)}
            </span>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner aria-label={tr("list.loading", dict)} />
          </div>
        ) : (
          <>
            <ConnectionsList
              connections={visible}
              templates={templates}
              credentials={credentials}
              onOpen={handleEditConnection}
              onTest={handleTest}
              onDelete={setDeletingConnection}
              onFunctions={setFunctionsFor}
              testing={testing}
              emptyMessage={
                hasActiveConnectionFilters(filters)
                  ? tr("filters.noMatches", dict)
                  : tr("connections.empty", dict)
              }
              layout={layout}
              dict={dict}
            />

            {/* The types behind the connections. Second, because most visits are here to
                point an existing type somewhere new, not to define a new one. */}
            <SectionHeader
              title={tr("templates.title", dict)}
              help={tr("templates.help", dict)}
              action={
                <Button
                  size="sm"
                  color="light"
                  className="shrink-0 whitespace-nowrap"
                  onClick={() => setTemplateModal({ open: true })}
                  disabled={!orgSlug}
                >
                  <HiPlus className="mr-2 h-4 w-4" />
                  {tr("templates.new", dict)}
                </Button>
              }
            />
            <TemplatesList
              templates={templates}
              instanceCount={instanceCount}
              onOpen={(template) => setTemplateModal({ open: true, template })}
              onDelete={setDeletingTemplate}
              emptyMessage={tr("templates.empty", dict)}
              layout={layout}
              dict={dict}
            />
          </>
        )}
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
        dict={dict}
      />

      <ConnectionFormModal
        show={connectionModal.open}
        connection={connectionModal.connection}
        template={connectionModal.template}
        providerType={connectionModal.providerType}
        credentials={credentials}
        onClose={() => setConnectionModal({ open: false })}
        onSave={saveConnection}
        onDelete={
          connectionModal.connection
            ? () => handleDeleteConnectionFromModal(connectionModal.connection!)
            : undefined
        }
        onTest={
          connectionModal.connection
            ? () => testInstance(connectionModal.connection!.id)
            : undefined
        }
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

function SectionHeader({
  title,
  help,
  action,
}: Readonly<{ title: string; help: string; action: React.ReactNode }>) {
  return (
    <div className="flex items-end justify-between gap-4 border-t border-gray-200 pt-5 dark:border-gray-700">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        <p className="max-w-3xl text-sm text-gray-500 dark:text-gray-400">
          {help}
        </p>
      </div>
      {action}
    </div>
  );
}

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
function messageOf(cause: unknown, fallback: string): string {
  const message = cause instanceof Error ? cause.message : "";
  return message || fallback;
}

function isForbidden(error: Error): boolean {
  return (error as { status?: number }).status === 403;
}

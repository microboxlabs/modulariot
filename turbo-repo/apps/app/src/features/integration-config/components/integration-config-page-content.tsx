"use client";

import { useState } from "react";
import { Alert, Button, Spinner } from "flowbite-react";
import { HiOutlineLink, HiPlus } from "react-icons/hi";
import { toast } from "sonner";
import { ClientBreadcrumb } from "@/features/common/components/Breadcrumb/ClientBreadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import { useIntegrationConfig } from "../use-integration-config";
import type {
  IntegrationConnection,
  IntegrationTemplate,
} from "../integration-config.types";
import { ConnectionsList } from "./connections-list";
import { TemplatesList } from "./templates-list";
import { TemplateFormModal } from "./template-form-modal";
import { ConnectionFormModal } from "./connection-form-modal";
import { IntegrationDeleteDialog } from "./integration-delete-dialog";

interface IntegrationConfigPageContentProps {
  /** `pages.integrationConnections` subtree. */
  readonly dict: I18nRecord;
  /** `pages.userSettings.breadcrumb` — the trail is shared with the other settings pages. */
  readonly breadcrumbDict: I18nRecord;
}

/**
 * Settings › Connections.
 *
 * Two lists, one contract. A **template** is a reusable type: it owns the payload the
 * review process maps against. A **connection** is an instance of one, with its own
 * endpoint and credential — so the same partner can exist twice, QA and production,
 * speaking the same payload.
 *
 * Backed by miot-integrations through the org admin proxy, which requires organization-
 * owner access and answers 403 to everyone else — hence the forbidden state below.
 */
export function IntegrationConfigPageContent({
  dict,
  breadcrumbDict,
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
  const [connectionModal, setConnectionModal] = useState<{
    open: boolean;
    connection?: IntegrationConnection;
  }>({ open: false });
  const [deletingTemplate, setDeletingTemplate] =
    useState<IntegrationTemplate | null>(null);
  const [deletingConnection, setDeletingConnection] =
    useState<IntegrationConnection | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const instanceCount = (templateId: string) =>
    connections.filter((connection) => connection.templateId === templateId)
      .length;

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

  async function handleTest(connection: IntegrationConnection) {
    setTesting(connection.id);
    try {
      const result = await testInstance(connection.id);
      if (result.success) {
        toast.success(tr("toast.testOk", dict));
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
    // Same shell as Settings › Credentials: a full-width sticky breadcrumb bar over a
    // capped, centred content column, so a wide monitor doesn't strand the row actions
    // far from the names they belong to.
    <div className="flex h-full w-full flex-col overflow-auto">
      <div className="sticky top-0 z-10 flex w-full items-center justify-between bg-white p-5 dark:bg-gray-900 dark:text-white">
        <ClientBreadcrumb
          dict={breadcrumbDict}
          path={[{ label: "user" }, { label: "settings" }, { label: "connections" }]}
        />
      </div>

      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 px-4 pt-2 pb-6 dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <HiOutlineLink className="h-6 w-6 text-gray-500 dark:text-gray-400" />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {tr("page.title", dict)}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr("page.subtitle", dict)}
              </p>
            </div>
          </div>
          <Button
            color="blue"
            onClick={() => setConnectionModal({ open: true })}
            disabled={!orgSlug || templates.length === 0}
          >
            <HiPlus className="mr-2 h-4 w-4" />
            {tr("connections.new", dict)}
          </Button>
        </div>

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
              connections={connections}
              templates={templates}
              credentials={credentials}
              onOpen={(connection) =>
                setConnectionModal({ open: true, connection })
              }
              onTest={handleTest}
              onDelete={setDeletingConnection}
              testing={testing}
              emptyMessage={
                templates.length === 0
                  ? tr("connections.emptyNoTemplates", dict)
                  : tr("connections.empty", dict)
              }
              dict={dict}
            />

            {/* The types behind the list above. Second, because most visits are here to
                point an existing type somewhere new, not to define a new one. */}
            <SectionHeader
              title={tr("templates.title", dict)}
              help={tr("templates.help", dict)}
              action={
                <Button
                  size="sm"
                  color="light"
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
        saving={saving}
        dict={dict}
      />
      <ConnectionFormModal
        show={connectionModal.open}
        connection={connectionModal.connection}
        templates={templates}
        credentials={credentials}
        onClose={() => setConnectionModal({ open: false })}
        onSave={saveConnection}
        saving={saving}
        dict={dict}
      />

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
    </div>
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
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{help}</p>
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

"use client";

import { useState } from "react";
import { Alert, Badge, Button, Spinner } from "flowbite-react";
import {
  HiOutlineTemplate,
  HiOutlineLink,
  HiPlus,
  HiPencil,
  HiTrash,
  HiPlay,
  HiInformationCircle,
} from "react-icons/hi";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import { useIntegrationConfig } from "../use-integration-config";
import type {
  IntegrationConnection,
  IntegrationTemplate,
} from "../integration-config.types";
import { TemplateFormModal } from "./template-form-modal";
import { ConnectionFormModal } from "./connection-form-modal";

export function IntegrationConfigPageContent({ dict }: Readonly<{ dict: I18nRecord }>) {
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
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const instanceCount = (templateId: string) =>
    connections.filter((c) => c.templateId === templateId).length;

  async function handleDeleteTemplate(id: string) {
    try {
      await removeTemplate(id);
      toast.success(tr("toast.templateDeleted", dict));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : tr("toast.actionFailed", dict));
    } finally {
      setConfirmingDelete(null);
    }
  }

  async function handleTest(id: string) {
    setTesting(id);
    try {
      const result = await testInstance(id);
      if (result.success) {
        toast.success(tr("toast.testOk", dict));
      } else {
        toast.error(result.message ?? tr("toast.testFailed", dict));
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : tr("toast.testFailed", dict));
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {tr("page.title", dict)}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {tr("page.subtitle", dict)}
        </p>
      </header>

      {error && (
        <Alert color="failure" icon={HiInformationCircle}>
          <span className="text-xs">{error.message}</span>
        </Alert>
      )}

      {/* Templates — the types */}
      <section className="flex flex-col gap-3">
        <SectionHeader
          icon={<HiOutlineTemplate className="h-5 w-5 text-primary-500" />}
          title={tr("templates.title", dict)}
          help={tr("templates.help", dict)}
          action={
            <Button size="xs" color="blue" onClick={() => setTemplateModal({ open: true })}>
              <HiPlus className="mr-1 h-3.5 w-3.5" />
              {tr("templates.new", dict)}
            </Button>
          }
        />
        {isLoading ? (
          <Loading />
        ) : templates.length === 0 ? (
          <EmptyNotice text={tr("templates.empty", dict)} />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {template.name}
                      </span>
                      <Badge color="gray">{template.providerType}</Badge>
                    </div>
                    <code className="mt-1 block truncate font-mono text-[11px] text-gray-500 dark:text-gray-400">
                      {template.method} {template.path}
                    </code>
                    <span className="text-[11px] text-gray-400">
                      {tr("templates.instanceCount", dict, {
                        count: String(instanceCount(template.id)),
                      })}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconButton
                      label={tr("common.edit", dict)}
                      onClick={() => setTemplateModal({ open: true, template })}
                    >
                      <HiPencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label={tr("common.delete", dict)}
                      danger
                      onClick={() => setConfirmingDelete(template.id)}
                    >
                      <HiTrash className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
                {confirmingDelete === template.id && (
                  <div className="flex items-center justify-between gap-2 rounded bg-red-50 px-2 py-1 dark:bg-red-900/20">
                    <span className="text-[11px] text-red-700 dark:text-red-300">
                      {tr("templates.confirmDelete", dict)}
                    </span>
                    <div className="flex gap-1">
                      <Button size="xs" color="gray" onClick={() => setConfirmingDelete(null)}>
                        {tr("common.cancel", dict)}
                      </Button>
                      <Button
                        size="xs"
                        color="failure"
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        {tr("common.delete", dict)}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Connections — the instances */}
      <section className="flex flex-col gap-3">
        <SectionHeader
          icon={<HiOutlineLink className="h-5 w-5 text-primary-500" />}
          title={tr("connections.title", dict)}
          help={tr("connections.help", dict)}
          action={
            <Button
              size="xs"
              color="blue"
              disabled={templates.length === 0}
              onClick={() => setConnectionModal({ open: true })}
            >
              <HiPlus className="mr-1 h-3.5 w-3.5" />
              {tr("connections.new", dict)}
            </Button>
          }
        />
        {isLoading ? (
          <Loading />
        ) : connections.length === 0 ? (
          <EmptyNotice text={tr("connections.empty", dict)} />
        ) : (
          <div className="flex flex-col gap-2">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {connection.name}
                    </span>
                    <StatusBadge connection={connection} dict={dict} />
                    {connection.templateId && (
                      <span className="text-[11px] text-gray-400">
                        {templates.find((t) => t.id === connection.templateId)?.name ??
                          connection.providerType}
                      </span>
                    )}
                  </div>
                  <code className="mt-0.5 block truncate font-mono text-[11px] text-gray-500 dark:text-gray-400">
                    {connection.baseUrl}
                  </code>
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconButton
                    label={tr("connections.test", dict)}
                    onClick={() => handleTest(connection.id)}
                    disabled={testing === connection.id}
                  >
                    {testing === connection.id ? (
                      <Spinner size="sm" />
                    ) : (
                      <HiPlay className="h-4 w-4" />
                    )}
                  </IconButton>
                  <IconButton
                    label={tr("common.edit", dict)}
                    onClick={() => setConnectionModal({ open: true, connection })}
                  >
                    <HiPencil className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SectionHeader({
  icon,
  title,
  help,
  action,
}: Readonly<{
  icon: React.ReactNode;
  title: string;
  help: string;
  action: React.ReactNode;
}>) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        {icon}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{help}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function StatusBadge({
  connection,
  dict,
}: Readonly<{ connection: IntegrationConnection; dict: I18nRecord }>) {
  if (connection.status === "ACTIVE" || connection.lastTestResult === true) {
    return <Badge color="success">{tr("status.active", dict)}</Badge>;
  }
  if (connection.status === "TEST_FAILED" || connection.lastTestResult === false) {
    return <Badge color="failure">{tr("status.failed", dict)}</Badge>;
  }
  return <Badge color="gray">{tr("status.draft", dict)}</Badge>;
}

function IconButton({
  label,
  onClick,
  danger,
  disabled,
  children,
}: Readonly<{
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded p-1.5 text-gray-400 disabled:opacity-50 ${
        danger
          ? "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
          : "hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

function Loading() {
  return (
    <div className="flex justify-center py-6">
      <Spinner />
    </div>
  );
}

function EmptyNotice({ text }: Readonly<{ text: string }>) {
  return (
    <Alert color="gray" icon={HiInformationCircle}>
      <span className="text-xs">{text}</span>
    </Alert>
  );
}

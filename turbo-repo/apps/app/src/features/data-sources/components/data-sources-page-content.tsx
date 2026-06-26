"use client";

import { useState } from "react";
import { Alert, Button } from "flowbite-react";
import { HiPlus, HiClipboardList } from "react-icons/hi";
import { ClientBreadcrumb } from "@/features/common/components/Breadcrumb/ClientBreadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useDataSources } from "../hooks/use-data-sources";
import { DataSourceTable } from "./data-source-table";
import { DataSourceModal } from "./data-source-modal";
import { DataSourceDeleteDialog } from "./data-source-delete-dialog";
import type { DataSourceListItem, DataSourceFormData } from "../types";
import { shouldTestStoredCredential } from "../test-decision";
import { toast } from "sonner";

interface DataSourcesPageContentProps {
  readonly dict: I18nRecord;
  readonly siteId: string;
}

export default function DataSourcesPageContent({
  dict,
  siteId,
}: DataSourcesPageContentProps) {
  const {
    dataSources,
    isLoading,
    error,
    actionLoading,
    create,
    update,
    remove,
    testConnection,
    testInline,
    toggleActive,
    refetch,
  } = useDataSources(siteId);

  const [showModal, setShowModal] = useState(false);
  const [editingSource, setEditingSource] =
    useState<DataSourceListItem | null>(null);
  const [deletingSource, setDeletingSource] =
    useState<DataSourceListItem | null>(null);

  const dsDict = dict?.dataSources as I18nRecord;

  const handleAdd = () => {
    setEditingSource(null);
    setShowModal(true);
  };

  const handleEdit = (ds: DataSourceListItem) => {
    setEditingSource(ds);
    setShowModal(true);
  };

  const handleSubmit = async (data: DataSourceFormData) => {
    try {
      if (editingSource) {
        await update(editingSource.id, {
          name: data.name,
          type: data.type,
          description: data.description,
          url: data.url,
          authMethod: data.authMethod,
          ...(data.authMethod === "TOKEN"
            ? { ...(data.token ? { token: data.token } : {}) }
            : {
                clientId: data.clientId,
                ...(data.clientSecret ? { clientSecret: data.clientSecret } : {}),
                tokenUrl: data.tokenUrl,
                scope: data.scope,
                audience: data.audience,
              }),
        });
        toast.success(tr("toast.updated", dsDict));
      } else {
        await create(data);
        toast.success(tr("toast.created", dsDict));
      }
      setShowModal(false);
      setEditingSource(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : tr("toast.error", dsDict)
      );
    }
  };

  const handleDelete = async () => {
    if (!deletingSource) return;
    try {
      await remove(deletingSource.id);
      toast.success(tr("toast.deleted", dsDict));
      setDeletingSource(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : tr("toast.error", dsDict)
      );
    }
  };

  const handleToggleActive = async (ds: DataSourceListItem) => {
    try {
      await toggleActive(ds.id, !ds.isActive);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : tr("toast.error", dsDict)
      );
    }
  };

  const showTestResult = (result: { success: boolean; error?: string }) => {
    if (result.success) {
      toast.success(tr("toast.testSuccess", dsDict));
    } else {
      toast.error(result.error || tr("toast.testFailed", dsDict));
    }
  };

  // Table rows test the persisted provider by id.
  const handleTest = async (id: string) => {
    try {
      showTestResult(await testConnection(id));
    } catch {
      toast.error(tr("toast.testFailed", dsDict));
    }
  };

  // Modal tests the data currently in the form (validate-before-save). When
  // editing with the credential left blank, fall back to testing the stored
  // config by id.
  const handleTestForm = async (data: DataSourceFormData) => {
    try {
      const result =
        shouldTestStoredCredential(!!editingSource, data) && editingSource
          ? await testConnection(editingSource.id)
          : await testInline(data);
      showTestResult(result);
    } catch {
      toast.error(tr("toast.testFailed", dsDict));
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-auto">
      <div className="p-5 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 dark:text-white w-full z-10">
        <ClientBreadcrumb
          path={[
            "breadcrumb.user",
            "breadcrumb.settings",
            "breadcrumb.dataSources",
          ]}
          rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
          dict={dict}
        />
      </div>

      <div className="px-4 pt-2 pb-6 dark:bg-gray-900 max-w-screen-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold dark:text-white">
              {tr("title", dsDict)}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("description", dsDict)}
            </p>
          </div>
          <Button onClick={handleAdd}>
            <HiPlus className="mr-2 h-4 w-4" />
            {tr("addButton", dsDict)}
          </Button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        )}
        {!isLoading && error && (
          <Alert color="failure">
            <div className="flex items-center justify-between">
              <span>{tr("toast.error", dsDict)}</span>
              <Button size="xs" color="failure" onClick={() => refetch()}>
                {tr("toast.retry", dsDict)}
              </Button>
            </div>
          </Alert>
        )}
        {!isLoading && !error && (
          <DataSourceTable
            dataSources={dataSources}
            onEdit={handleEdit}
            onDelete={(ds) => setDeletingSource(ds)}
            onTest={(ds) => handleTest(ds.id)}
            onToggleActive={handleToggleActive}
            loading={actionLoading}
            dict={dsDict}
          />
        )}
      </div>

      <DataSourceModal
        show={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingSource(null);
        }}
        onSubmit={handleSubmit}
        onTest={handleTestForm}
        editingSource={editingSource}
        loading={actionLoading}
        dict={dsDict}
      />

      <DataSourceDeleteDialog
        dataSource={deletingSource}
        show={!!deletingSource}
        onClose={() => setDeletingSource(null)}
        onConfirm={handleDelete}
        loading={actionLoading}
        dict={dsDict}
      />
    </div>
  );
}

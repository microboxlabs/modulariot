"use client";

import { useState } from "react";
import { Button } from "flowbite-react";
import { HiPlus, HiClipboardList } from "react-icons/hi";
import { ClientBreadcrumb } from "@/features/common/components/Breadcrumb/ClientBreadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useDataSources } from "../hooks/use-data-sources";
import { DataSourceTable } from "./data-source-table";
import { DataSourceModal } from "./data-source-modal";
import { DataSourceDeleteDialog } from "./data-source-delete-dialog";
import type { DataSourceListItem, DataSourceFormData } from "../types";
import { toast } from "sonner";

interface DataSourcesPageContentProps {
  dict: I18nRecord;
  orgId: string;
}

export default function DataSourcesPageContent({
  dict,
  orgId,
}: DataSourcesPageContentProps) {
  const {
    dataSources,
    isLoading,
    actionLoading,
    create,
    update,
    remove,
    testConnection,
  } = useDataSources(orgId);

  const [showModal, setShowModal] = useState(false);
  const [editingSource, setEditingSource] =
    useState<DataSourceListItem | null>(null);
  const [deletingSource, setDeletingSource] =
    useState<DataSourceListItem | null>(null);

  const dsDict = (dict as I18nRecord)?.dataSources as I18nRecord;

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
          ...(data.token ? { token: data.token } : {}),
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

  const handleTest = async (id: string) => {
    try {
      const result = await testConnection(id);
      if (result.success) {
        toast.success(tr("toast.testSuccess", dsDict));
      } else {
        toast.error(result.error || tr("toast.testFailed", dsDict));
      }
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

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <DataSourceTable
            dataSources={dataSources}
            onEdit={handleEdit}
            onDelete={(ds) => setDeletingSource(ds)}
            onTest={(ds) => handleTest(ds.id)}
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
        onTest={handleTest}
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

"use client";

import { useState } from "react";
import { useDashboardConfigs } from "../../hooks/use-dashboard-dynamic-items";
import { DashboardCard } from "./dashboard-card";
import { ConfirmModal } from "../confirm-modal";
import { deleteDashboardConfigClient } from "@/features/common/providers/client-api.provider";
import { ShowNotification } from "@/features/notifications/notification";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface DashboardListProps {
  dict: I18nRecord;
}

export function DashboardList({ dict }: Readonly<DashboardListProps>) {
  const { dashboards, isLoading, mutate, siteName } = useDashboardConfigs();
  const [deleteTarget, setDeleteTarget] = useState<{
    slug: string;
    name: string;
  } | null>(null);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !siteName) return;

    try {
      await deleteDashboardConfigClient(siteName, deleteTarget.slug);

      ShowNotification({
        type: "success",
        message: tr("dashboard.landing.deleteSuccess", dict),
      });
      mutate(
        (current) => current
          ? { data: current.data.filter((d) => d.slug !== deleteTarget.slug) }
          : current,
        false
      );
    } catch {
      ShowNotification({
        type: "error",
        message: tr("dashboard.landing.deleteError", dict),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (dashboards.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        {tr("dashboard.landing.no_dashboards", dict)}
      </p>
    );
  }

  return (
    <>
      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dashboards.map((dashboard) => (
          <DashboardCard
            key={dashboard.slug}
            slug={dashboard.slug}
            name={dashboard.name}
            onDelete={() => setDeleteTarget(dashboard)}
            deleteTitle={tr("dashboard.landing.delete_confirm_title", dict)}
          />
        ))}
      </div>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={tr("dashboard.landing.delete_confirm_title", dict)}
        description={tr("dashboard.landing.delete_confirm_message", dict, {
          name: deleteTarget?.name ?? "",
        })}
        confirmText={tr("dashboard.landing.delete_confirm_title", dict)}
      />
    </>
  );
}

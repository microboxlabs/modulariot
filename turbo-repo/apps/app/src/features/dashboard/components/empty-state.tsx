"use client";

import { HiOutlineSquaresPlus } from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { DashboardPermissionsOptions } from "@microboxlabs/miot-dashboard-ui/react";
import { DashboardSetup } from "./dashboard-setup/dashboard-setup";
import type { Visibility } from "./dashboard-setup/setup.types";

const NO_TAGS: readonly string[] = [];

interface EmptyStateProps {
  dictionary: I18nRecord;
  /** Opens the dashlet picker; absent when the caller cannot edit. */
  onAdd?: () => void;
  /** Whether the caller may decide who uses the dashboard. */
  canManagePermissions?: boolean;
  /** Where the permissions are read and saved; absent on the legacy host. */
  permissions?: DashboardPermissionsOptions;
  /**
   * False while the dashboard is still in its setup. Once started, an empty
   * dashboard offers only its first dashlet: tags and permissions are then
   * changed from its settings.
   */
  started?: boolean;
  /** The dashboard's tags, where the setup's tags step starts from. */
  tags?: readonly string[];
  /** Saves the tags and ends the setup, on leaving its tags step. */
  onFinishSetup?: (tags: string[], visibility: Visibility) => void;
  /** Who sees the dashboard: the whole organization unless it says so. */
  visibility?: Visibility;
  /** Saves who sees it, on leaving the setup's permissions step. */
  onVisibilityChange?: (visibility: Visibility) => void;
}

/**
 * A dashboard with no dashlets yet. Whoever can edit it gets the setup
 * steps, or only the last one once the setup has started; anyone else just
 * sees that it is still empty.
 */
export function EmptyState({
  dictionary,
  onAdd,
  canManagePermissions = false,
  permissions,
  started = true,
  tags = NO_TAGS,
  onFinishSetup,
  visibility = "organization",
  onVisibilityChange,
}: Readonly<EmptyStateProps>) {
  if (onAdd) {
    return (
      <DashboardSetup
        dictionary={dictionary}
        onAdd={onAdd}
        canManagePermissions={canManagePermissions}
        permissions={permissions}
        started={started}
        initialTags={tags}
        onFinish={onFinishSetup}
        visibility={visibility}
        onVisibilityChange={onVisibilityChange}
      />
    );
  }
  return (
    <section className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <HiOutlineSquaresPlus className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">
        {tr("dashboard.setup.readOnly.title", dictionary)}
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {tr("dashboard.setup.readOnly.body", dictionary)}
      </p>
    </section>
  );
}

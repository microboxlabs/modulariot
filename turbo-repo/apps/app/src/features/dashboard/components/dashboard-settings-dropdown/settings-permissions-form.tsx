"use client";

import { useState } from "react";
import { Button } from "flowbite-react";
import type { DashboardPermissionsOptions } from "@microboxlabs/miot-dashboard-ui/react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { ShowNotification } from "@/features/notifications/notification";
import { PermissionsStep } from "../dashboard-setup/permissions-step";
import { usePrincipalDirectory } from "../dashboard-setup/use-principal-directory";
import { useSetupPermissions } from "../dashboard-setup/use-setup-permissions";
import type { Visibility } from "../dashboard-setup/setup.types";

interface SettingsPermissionsFormProps {
  permissions: DashboardPermissionsOptions;
  /** Who sees the dashboard now. */
  visibility: Visibility;
  /** Saves who sees it, with the dashboard. */
  onVisibilityChange: (visibility: Visibility) => Promise<boolean>;
  dictionary: I18nRecord;
}

/**
 * Who may use the dashboard, in its settings: the new dashboard's
 * permissions step, with a button that saves it.
 */
export function SettingsPermissionsForm({
  permissions,
  visibility,
  onVisibilityChange,
  dictionary,
}: Readonly<SettingsPermissionsFormProps>) {
  const state = useSetupPermissions(permissions);
  const directory = usePrincipalDirectory(state.canManage);
  const [draft, setDraft] = useState<Visibility | null>(null);
  const visibilityDraft = draft ?? visibility;
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const visibilityDirty = saveFailed || visibilityDraft !== visibility;
  const saveAssignments = async () => {
    setSaving(true);
    const saved = await state.save();
    setSaving(false);
    ShowNotification({
      type: saved ? "success" : "error",
      message: saved
        ? tr("dashboard.permissions.saveSuccess", dictionary)
        : tr("dashboard.permissions.saveError", dictionary),
    });
  };
  const saveVisibility = async () => {
    setSaving(true);
    const saved = await onVisibilityChange(visibilityDraft);
    setSaving(false);
    setSaveFailed(!saved);
    if (saved) setDraft(null);
    ShowNotification({
      type: saved ? "success" : "error",
      message: saved
        ? tr("dashboard.permissions.visibilitySaveSuccess", dictionary)
        : tr("dashboard.permissions.visibilitySaveError", dictionary),
    });
  };
  return (
    <fieldset
      disabled={saving || state.busy}
      className="flex min-w-0 flex-col gap-4 p-4"
    >
      <PermissionsStep
        assignments={state.assignments}
        onChange={state.onChange}
        principals={directory.principals}
        loading={directory.isLoading || state.busy}
        canManage={state.canManage}
        checkingAccess={state.loading}
        error={state.error}
        onRetry={() => void state.retry()}
        visibility={visibilityDraft}
        onVisibilityChange={state.canManage ? setDraft : undefined}
        t={(key, params) =>
          trDynamic(`dashboard.setup.permissions.${key}`, dictionary, params)
        }
      />
      {state.canManage && (
        <Button
          type="button"
          size="sm"
          disabled={!state.dirty || saving || state.busy}
          onClick={() => void saveAssignments()}
          className="self-end"
        >
          {tr("dashboard.permissions.saveAssignments", dictionary)}
        </Button>
      )}
      {state.canManage && (
        <Button
          type="button"
          size="sm"
          disabled={!visibilityDirty || saving || state.busy}
          onClick={() => void saveVisibility()}
          className="self-end"
        >
          {tr("dashboard.permissions.saveVisibility", dictionary)}
        </Button>
      )}
    </fieldset>
  );
}

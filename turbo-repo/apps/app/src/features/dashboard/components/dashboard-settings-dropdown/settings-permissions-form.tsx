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
  onVisibilityChange: (visibility: Visibility) => void;
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
  const [visibilityDraft, setVisibilityDraft] = useState(visibility);
  const dirty = state.dirty || visibilityDraft !== visibility;
  const save = async () => {
    if (await state.save()) {
      if (visibilityDraft !== visibility) onVisibilityChange(visibilityDraft);
      ShowNotification({
        type: "success",
        message: tr("dashboard.permissions.saveSuccess", dictionary),
      });
      return;
    }
    ShowNotification({
      type: "error",
      message: tr("dashboard.permissions.saveError", dictionary),
    });
  };
  return (
    <div className="flex flex-col gap-4 p-4">
      <PermissionsStep
        assignments={state.assignments}
        onChange={state.onChange}
        principals={directory.principals}
        loading={directory.isLoading || state.busy}
        canManage={state.canManage}
        checkingAccess={state.loading}
        visibility={visibilityDraft}
        onVisibilityChange={state.canManage ? setVisibilityDraft : undefined}
        t={(key, params) =>
          trDynamic(`dashboard.setup.permissions.${key}`, dictionary, params)
        }
      />
      {state.canManage && (
        <Button
          type="button"
          size="sm"
          disabled={!dirty || state.busy}
          onClick={() => void save()}
          className="self-end"
        >
          {tr("dashboard.permissions.save", dictionary)}
        </Button>
      )}
    </div>
  );
}

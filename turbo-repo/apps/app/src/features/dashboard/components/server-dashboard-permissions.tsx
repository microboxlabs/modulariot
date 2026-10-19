"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Button, TextInput } from "flowbite-react";
import {
  PermissionAssignmentEditor,
  useDashboardPermissions,
  type DashboardPermissionsOptions,
  type PermissionAssignment,
} from "@microboxlabs/miot-dashboard-ui/react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useUnsavedNavigation } from "@/features/common/hooks/use-unsaved-navigation";
import FormModal from "@/features/common/components/form-modal/form-modal";

type Props = DashboardPermissionsOptions & {
  dictionary: I18nRecord;
  dashboardName: string;
  onClose: () => void;
};

/** Next host: explicit IDs avoid coupling portable permissions to a directory. */
export function ServerDashboardPermissions({
  dictionary,
  dashboardName,
  onClose,
  ...options
}: Readonly<Props>) {
  const state = useDashboardPermissions(options);
  const [draft, setDraft] = useState<PermissionAssignment[]>([]);
  const [identity, setIdentity] = useState("");
  const [saved, setSaved] = useState(false);
  const inputId = useId();
  const t = (key: string) =>
    tr(`dashboard.server.permissions.${key}`, dictionary);
  const p = (key: string) => tr(`dashboard.permissions.${key}`, dictionary);
  useEffect(() => {
    setDraft(state.assignments);
    setIdentity("");
  }, [state.assignments, state.editorKey]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.assignments);
  useUnsavedNavigation(dirty, t("discard"));
  const authorityId = identity.trim();
  const authorities = useMemo(
    () => (authorityId ? [{ id: authorityId, label: authorityId }] : []),
    [authorityId]
  );
  function change(next: PermissionAssignment[]) {
    setDraft(next);
    setSaved(false);
  }
  function close() {
    if (!dirty || globalThis.confirm(t("discard"))) onClose();
  }
  async function reload() {
    if (!dirty || globalThis.confirm(t("discard"))) {
      setSaved(false);
      await state.reload();
    }
  }
  async function save() {
    if (!state.editable || !dirty || !globalThis.confirm(t("confirmSave")))
      return;
    setSaved(false);
    setSaved(await state.save(draft));
  }
  // The same dialog shell as the legacy permissions modal.
  return (
    <FormModal
      isOpen
      onClose={close}
      title={tr("dashboard.permissions.modalTitle", dictionary, {
        name: dashboardName,
      })}
      size="2xl"
      submitLabel={p("save")}
      cancelLabel={p("cancel")}
      showCancelButton
      isProcessing={!state.editable || !dirty || state.busy}
      onSubmit={() => void save()}
    >
      <div className="space-y-4">
        {state.busy && <output>{p("loading")}</output>}
        {state.error !== null && <p role="alert">{t("error")}</p>}
        {state.loaded && !state.editable && !state.busy && (
          <p>{p("notAuthorized")}</p>
        )}
        {state.editable && (
          <div>
            <label htmlFor={inputId}>{t("authorityId")}</label>
            <TextInput
              id={inputId}
              value={identity}
              maxLength={500}
              onChange={(event) => setIdentity(event.target.value)}
              aria-describedby={`${inputId}-help`}
            />
            <p id={`${inputId}-help`} className="text-sm text-gray-500">
              {t("authorityHelp")}
            </p>
          </div>
        )}
        {state.loaded && (
          <PermissionAssignmentEditor
            key={state.editorKey}
            assignments={draft}
            authorities={authorities}
            editable={state.editable}
            disabled={state.busy}
            onChange={change}
            labels={{
              authority: t("authorityId"),
              role: t("role"),
              choose: t("choose"),
              add: p("addButton"),
              remove: t("remove"),
              empty: t("empty"),
              roles: {
                Consumer: p("roleConsumer"),
                Contributor: p("roleContributor"),
                Editor: p("roleEditor"),
                Coordinator: p("roleCoordinator"),
              },
            }}
          />
        )}
        <Button
          size="sm"
          color="light"
          disabled={state.busy}
          onClick={() => void reload()}
        >
          {t("reload")}
        </Button>
        {saved && <output>{p("saveSuccess")}</output>}
      </div>
    </FormModal>
  );
}

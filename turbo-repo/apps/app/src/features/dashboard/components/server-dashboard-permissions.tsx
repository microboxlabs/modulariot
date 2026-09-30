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

type Props = DashboardPermissionsOptions & {
  dictionary: I18nRecord;
  onClose: () => void;
};

/** Next host: explicit IDs avoid coupling portable permissions to a directory. */
export function ServerDashboardPermissions({
  dictionary,
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
  return (
    <section aria-label={p("manageButton")} className="space-y-3 border-b p-4">
      <h2 className="font-semibold">{p("manageButton")}</h2>
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
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!state.editable || !dirty}
          onClick={() => void save()}
        >
          {p("save")}
        </Button>
        <Button
          size="sm"
          color="light"
          disabled={state.busy}
          onClick={() => void reload()}
        >
          {t("reload")}
        </Button>
        <Button size="sm" color="light" disabled={state.busy} onClick={close}>
          {p("cancel")}
        </Button>
      </div>
      {saved && <output>{p("saveSuccess")}</output>}
    </section>
  );
}

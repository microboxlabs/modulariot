"use client";

/**
 * A folder's own permissions, apart from its dashboards': the same people and
 * teams search and role switch as the dashboard setup's permissions step,
 * in a dialog. Reader and Contributor see the folder, Editor creates inside
 * it, renames and moves it, Administrator deletes it and decides who has
 * access.
 */
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "flowbite-react";
import { useCallback, useEffect, useState } from "react";
import { trDynamic } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { ShowNotification } from "@/features/notifications/notification";
import type {
  FolderAssignment,
  FolderPermissions,
} from "@/features/dashboard/services/dashboard-folder-client";
import type { Visibility } from "../dashboard-setup/setup.types";
import { PermissionsStep } from "../dashboard-setup/permissions-step";
import { usePrincipalDirectory } from "../dashboard-setup/use-principal-directory";

type T = (key: string, params?: Record<string, string>) => string;

/** What reads differently for a folder than in the dashboard setup. */
const FOLDER_TEXTS = new Set([
  "roleHints.Consumer",
  "roleHints.Contributor",
  "roleHints.Editor",
  "roleHints.Coordinator",
  "noAccess",
  "visibility.organizationHelp",
  "visibility.restrictedHelp",
  "visibility.note",
]);

interface ExplorerPermissionsDialogProps {
  folder: { id: string; name: string };
  load: (id: string) => Promise<FolderPermissions>;
  save: (id: string, permissions: FolderPermissions) => Promise<void>;
  onClose: () => void;
  dict: I18nRecord;
}

export default function ExplorerPermissionsDialog({
  folder,
  load,
  save,
  onClose,
  dict,
}: Readonly<ExplorerPermissionsDialogProps>) {
  const t: T = useCallback(
    (key, params) =>
      FOLDER_TEXTS.has(key)
        ? trDynamic(`explorer.folderPermissions.${key}`, dict, params)
        : trDynamic(`setup.permissions.${key}`, dict, params),
    [dict]
  );
  const own = (key: string, params?: Record<string, string>) =>
    trDynamic(`explorer.folderPermissions.${key}`, dict, params);
  const directory = usePrincipalDirectory(true);
  const [assignments, setAssignments] = useState<FolderAssignment[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("organization");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let current = true;
    load(folder.id)
      .then((found) => {
        if (!current) return;
        setAssignments(found.assignments);
        setVisibility(found.visibility);
      })
      .catch(() => {
        if (!current) return;
        ShowNotification({ type: "error", message: own("loadError") });
        onClose();
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
    // Loaded once per folder; the dialog is keyed by it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder.id]);

  const onSave = async () => {
    setSaving(true);
    try {
      await save(folder.id, { assignments, visibility });
      ShowNotification({
        type: "success",
        message: own("saved", { name: folder.name }),
      });
      onClose();
    } catch {
      ShowNotification({ type: "error", message: t("saveError") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show size="xl" onClose={onClose} dismissible>
      <ModalHeader>{own("title", { name: folder.name })}</ModalHeader>
      <ModalBody className="overflow-visible">
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          {own("body")}
        </p>
        <fieldset disabled={saving}>
          <PermissionsStep
            assignments={assignments}
            onChange={setAssignments}
            principals={directory.principals}
            loading={directory.isLoading || saving}
            canManage
            checkingAccess={loading}
            visibility={visibility}
            onVisibilityChange={setVisibility}
            t={t}
          />
        </fieldset>
      </ModalBody>
      <ModalFooter className="justify-end">
        <Button color="light" size="sm" onClick={onClose}>
          {own("cancel")}
        </Button>
        <Button
          color="blue"
          size="sm"
          onClick={() => void onSave()}
          disabled={loading || saving}
        >
          {own("save")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

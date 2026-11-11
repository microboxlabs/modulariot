"use client";

import { useEffect, useState } from "react";
import { Label, Textarea, TextInput } from "flowbite-react";
import { HiOutlineAdjustments } from "react-icons/hi";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { PermissionPicker } from "./permission-picker";
import { createCustomRole, updateCustomRole } from "./team-api";
import { customRoleRequest, type CustomRoleForm } from "./team-model";
import type { AccessCatalog, CustomRole } from "./team.types";

const EMPTY: CustomRoleForm = {
  nameEs: "",
  nameEn: "",
  descriptionEs: "",
  descriptionEn: "",
  permissions: new Set<string>(),
};

function formOf(role: CustomRole | null): CustomRoleForm {
  if (!role) return EMPTY;
  return {
    nameEs: role.label.es ?? "",
    nameEn: role.label.en ?? "",
    descriptionEs: role.description.es ?? "",
    descriptionEn: role.description.en ?? "",
    permissions: new Set(role.permissions),
  };
}

interface CustomRoleFormModalProps {
  readonly show: boolean;
  /** The role to edit; null creates a new one. */
  readonly role: CustomRole | null;
  readonly catalog: AccessCatalog;
  readonly can: (permission: string) => boolean;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onClose: () => void;
  readonly onSaved: (role: CustomRole) => void;
}

/** Creates or edits a custom role: its name and description per language, and its permissions. */
export function CustomRoleFormModal({
  show,
  role,
  catalog,
  can,
  lang,
  d,
  onClose,
  onSaved,
}: CustomRoleFormModalProps) {
  const [form, setForm] = useState<CustomRoleForm>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (show) {
      setForm(formOf(role));
      setError(null);
    }
  }, [show, role]);

  const set = (patch: Partial<CustomRoleForm>) =>
    setForm({ ...form, ...patch });

  const submit = async () => {
    if (!form.nameEs.trim()) {
      setError(new Error(tr("nameRequired", d)));
      return;
    }
    if (form.permissions.size === 0) {
      setError(new Error(tr("customRolePermissionsRequired", d)));
      return;
    }
    setBusy(true);
    setError(null);
    const request = customRoleRequest(form);
    try {
      const saved = await (role
        ? updateCustomRole(role.id, request)
        : createCustomRole(request));
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(tr("saveFailed", d)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal
      isOpen={show}
      onClose={onClose}
      size="4xl"
      icon={
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
          <HiOutlineAdjustments className="h-5 w-5" />
        </span>
      }
      title={
        role ? tr("customRoleEditTitle", d) : tr("customRoleCreateTitle", d)
      }
      subtitle={
        role ? tr("customRoleEditHelp", d) : tr("customRoleCreateHelp", d)
      }
      submitLabel={role ? tr("save", d) : tr("create", d)}
      cancelLabel={tr("cancel", d)}
      showCancelButton
      isProcessing={busy}
      error={error}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="custom-role-name-es">
              {tr("customRoleNameEs", d)}
            </Label>
            <TextInput
              id="custom-role-name-es"
              value={form.nameEs}
              maxLength={80}
              autoFocus
              required
              onChange={(e) => set({ nameEs: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="custom-role-name-en">
              {tr("customRoleNameEn", d)}
            </Label>
            <TextInput
              id="custom-role-name-en"
              value={form.nameEn}
              maxLength={80}
              placeholder={form.nameEs}
              onChange={(e) => set({ nameEn: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="custom-role-description-es">
              {tr("customRoleDescriptionEs", d)}
            </Label>
            <Textarea
              id="custom-role-description-es"
              rows={2}
              maxLength={500}
              value={form.descriptionEs}
              onChange={(e) => set({ descriptionEs: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="custom-role-description-en">
              {tr("customRoleDescriptionEn", d)}
            </Label>
            <Textarea
              id="custom-role-description-en"
              rows={2}
              maxLength={500}
              value={form.descriptionEn}
              onChange={(e) => set({ descriptionEn: e.target.value })}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {tr("customRolePermissions", d)}
          </span>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tr("customRolePermissionsHelp", d)}
          </p>
          <PermissionPicker
            catalog={catalog}
            selected={form.permissions}
            initial={new Set(role?.permissions ?? [])}
            can={can}
            disabled={busy}
            lang={lang}
            d={d}
            onChange={(permissions) => set({ permissions })}
          />
        </div>
      </div>
    </FormModal>
  );
}

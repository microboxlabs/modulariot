"use client";

import { useEffect, useState } from "react";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ModuleRoleSelects } from "./module-role-selects";
import { rolesByModule, selectedRoles } from "./team-model";
import type { CatalogRole } from "./team.types";

interface RolesModalProps {
  /** The roles held now; null keeps the modal closed. */
  readonly current: string[] | null;
  readonly title: string;
  readonly onSave: (roles: string[]) => Promise<unknown>;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly roles: CatalogRole[];
  readonly lang: string;
  readonly d: I18nRecord;
}

/** Edits the module roles of a team or service account: one per module. */
export function RolesModal({
  current,
  title,
  onSave,
  onClose,
  onSaved,
  roles,
  lang,
  d,
}: RolesModalProps) {
  const [byModule, setByModule] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (current) {
      setByModule(rolesByModule(current, roles));
      setError(null);
    }
  }, [current, roles]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave(selectedRoles(byModule));
      onSaved();
      onClose();
    } catch (e) {
      onSaved();
      setError(e instanceof Error ? e : new Error(tr("saveFailed", d)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal
      isOpen={current !== null}
      onClose={onClose}
      title={title}
      subtitle={tr("rolesSubtitle", d)}
      submitLabel={tr("save", d)}
      isProcessing={busy}
      error={error}
      onSubmit={submit}
      size="2xl"
    >
      <ModuleRoleSelects
        roles={roles}
        value={byModule}
        onChange={setByModule}
        lang={lang}
        d={d}
      />
    </FormModal>
  );
}

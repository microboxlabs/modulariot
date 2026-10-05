"use client";

import { useEffect, useState } from "react";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ModuleRoleSelects } from "./module-role-selects";
import { setRoles } from "./team-api";
import { rolesByModule, selectedRoles } from "./team-model";
import type { CatalogRole, TeamMember } from "./team.types";

interface TeamAccessModalProps {
  readonly member: TeamMember | null;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly roles: CatalogRole[];
  readonly lang: string;
  readonly d: I18nRecord;
}

/** Edits a member's module roles: one per module. */
export function TeamAccessModal({
  member,
  onClose,
  onSaved,
  roles,
  lang,
  d,
}: TeamAccessModalProps) {
  const [byModule, setByModule] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (member) {
      setByModule(rolesByModule(member.roles, roles));
      setError(null);
    }
  }, [member, roles]);

  const submit = async () => {
    if (!member) return;
    setBusy(true);
    setError(null);
    try {
      await setRoles(member.userId, selectedRoles(byModule));
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(tr("saveFailed", d)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal
      isOpen={member !== null}
      onClose={onClose}
      title={tr("accessTitle", d, { email: member?.email ?? "" })}
      subtitle={tr("accessSubtitle", d)}
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

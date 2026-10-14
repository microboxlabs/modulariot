"use client";

import { useEffect, useState } from "react";
import { Label, Textarea, TextInput } from "flowbite-react";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { createTeam, updateTeam } from "./team-api";
import type { Team } from "./team.types";

interface TeamFormModalProps {
  readonly show: boolean;
  /** The team to rename; null creates a new one. */
  readonly team: Team | null;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly d: I18nRecord;
}

export function TeamFormModal({
  show,
  team,
  onClose,
  onSaved,
  d,
}: TeamFormModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (show) {
      setName(team?.name ?? "");
      setDescription(team?.description ?? "");
      setError(null);
    }
  }, [show, team]);

  const submit = async () => {
    if (!name.trim()) {
      setError(new Error(tr("nameRequired", d)));
      return;
    }
    setBusy(true);
    setError(null);
    const request = { name: name.trim(), description: description.trim() };
    try {
      await (team ? updateTeam(team.id, request) : createTeam(request));
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
      isOpen={show}
      onClose={onClose}
      title={team ? tr("teamEditTitle", d) : tr("teamCreateTitle", d)}
      submitLabel={team ? tr("save", d) : tr("create", d)}
      isProcessing={busy}
      error={error}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="team-name">{tr("colName", d)}</Label>
          <TextInput
            id="team-name"
            sizing="sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="team-description">{tr("colDescription", d)}</Label>
          <Textarea
            id="team-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>
    </FormModal>
  );
}

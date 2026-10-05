"use client";

import { useEffect, useState } from "react";
import { Checkbox, Label } from "flowbite-react";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { setTeamMembers } from "./team-api";
import type { Team, TeamMember } from "./team.types";

interface TeamMembersModalProps {
  readonly team: Team | null;
  readonly members: TeamMember[];
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly d: I18nRecord;
}

/** Picks which of the organization's members belong to the team. */
export function TeamMembersModal({
  team,
  members,
  onClose,
  onSaved,
  d,
}: TeamMembersModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (team) {
      setSelected(team.members);
      setError(null);
    }
  }, [team]);

  const toggle = (userId: string, checked: boolean) =>
    setSelected((current) =>
      checked ? [...current, userId] : current.filter((id) => id !== userId)
    );

  const submit = async () => {
    if (!team) return;
    setBusy(true);
    setError(null);
    try {
      await setTeamMembers(team.id, selected);
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
      isOpen={team !== null}
      onClose={onClose}
      title={tr("teamMembersTitle", d, { name: team?.name ?? "" })}
      submitLabel={tr("save", d)}
      isProcessing={busy}
      error={error}
      onSubmit={submit}
    >
      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {members.map((member) => {
          const id = `team-member-${member.userId}`;
          return (
            <div key={member.userId} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={selected.includes(member.userId)}
                onChange={(e) => toggle(member.userId, e.target.checked)}
              />
              <Label htmlFor={id} className="font-normal">
                {member.email ?? member.name ?? member.userId}
              </Label>
            </div>
          );
        })}
      </div>
    </FormModal>
  );
}

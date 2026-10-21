"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Checkbox, TextInput } from "flowbite-react";
import { HiOutlineSearch, HiOutlineUserGroup } from "react-icons/hi";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { setTeamMembers } from "./team-api";
import { initials, pickableMembers } from "./team-model";
import type { Team, TeamMember } from "./team.types";

interface MemberOptionProps {
  readonly member: TeamMember;
  readonly checked: boolean;
  readonly d: I18nRecord;
  readonly onToggle: (userId: string, checked: boolean) => void;
}

function MemberOption({ member, checked, d, onToggle }: MemberOptionProps) {
  const id = `team-member-${member.userId}`;
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
        checked
          ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20"
          : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50"
      }`}
    >
      <Checkbox
        id={id}
        checked={checked}
        onChange={(e) => onToggle(member.userId, e.target.checked)}
      />
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-200">
        {initials(member.name, member.email)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
          {member.name ?? member.email ?? member.userId}
        </span>
        {member.name && member.email && (
          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
            {member.email}
          </span>
        )}
      </span>
      <Badge color="gray" className="shrink-0">
        {tr(`base${member.baseRole}`, d)}
      </Badge>
    </label>
  );
}

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
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (team) {
      setSelected(team.members);
      setQuery("");
      setError(null);
    }
  }, [team]);

  const visible = useMemo(
    () => pickableMembers(members, query),
    [members, query]
  );

  const toggle = (userId: string, checked: boolean) =>
    setSelected((current) =>
      checked ? [...current, userId] : current.filter((id) => id !== userId)
    );

  const selectVisible = () =>
    setSelected((current) => [
      ...current,
      ...visible.map((m) => m.userId).filter((id) => !current.includes(id)),
    ]);

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
      size="2xl"
      icon={
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
          <HiOutlineUserGroup className="h-5 w-5" />
        </span>
      }
      title={tr("teamMembersTitle", d, { name: team?.name ?? "" })}
      subtitle={tr("teamMembersPickerHelp", d)}
      submitLabel={tr("save", d)}
      cancelLabel={tr("cancel", d)}
      showCancelButton
      isProcessing={busy}
      error={error}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-3">
        <TextInput
          sizing="sm"
          icon={HiOutlineSearch}
          placeholder={tr("searchMembers", d)}
          aria-label={tr("searchMembers", d)}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            {tr("selectedCount", d, {
              count: String(selected.length),
              total: String(members.length),
            })}
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              className="font-medium text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
              disabled={visible.length === 0}
              onClick={selectVisible}
            >
              {tr("selectVisible", d)}
            </button>
            <button
              type="button"
              className="font-medium text-gray-600 hover:underline disabled:opacity-50 dark:text-gray-300"
              disabled={selected.length === 0}
              onClick={() => setSelected([])}
            >
              {tr("clearSelection", d)}
            </button>
          </div>
        </div>
        <div className="flex min-h-64 max-h-[45vh] flex-col gap-1 overflow-y-auto rounded-lg border border-gray-200 p-1 dark:border-gray-700">
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {tr("noMemberMatches", d)}
            </p>
          ) : (
            visible.map((member) => (
              <MemberOption
                key={member.userId}
                member={member}
                checked={selected.includes(member.userId)}
                d={d}
                onToggle={toggle}
              />
            ))
          )}
        </div>
      </div>
    </FormModal>
  );
}

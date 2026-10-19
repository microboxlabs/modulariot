"use client";

import { Button, TextInput } from "flowbite-react";
import { HiOutlinePlus, HiOutlineTrash } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { addGroup, removeGroup, updateGroup, type Draft } from "./editor-draft";
import { LocalizedInput } from "./localized-input";

interface GroupsTabProps {
  readonly draft: Draft;
  readonly onChange: (next: Draft) => void;
  readonly d: I18nRecord;
}

/** Headings options can sit under; an option picks its group in its row's details. */
export function GroupsTab({ draft, onChange, d }: GroupsTabProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {tr("groupsHint", d)}
      </p>
      {draft.groups.map((group) => (
        <div
          key={group.rowId}
          className="grid grid-cols-1 items-start gap-2 rounded-lg border border-gray-200 p-2 sm:grid-cols-[10rem_1fr_2.5rem] dark:border-gray-700"
        >
          <TextInput
            sizing="sm"
            aria-label={tr("groupKeyLabel", d)}
            value={group.key}
            onChange={(e) =>
              onChange(updateGroup(draft, group.rowId, { key: e.target.value }))
            }
            className="font-mono"
          />
          <LocalizedInput
            idPrefix={`group-label-${group.rowId}`}
            sizing="sm"
            value={group.label}
            placeholder={tr("groupLabelPlaceholder", d)}
            onChange={(label) =>
              onChange(updateGroup(draft, group.rowId, { label }))
            }
          />
          <button
            type="button"
            onClick={() => onChange(removeGroup(draft, group.rowId))}
            title={tr("removeGroup", d)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
          >
            <HiOutlineTrash className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        size="xs"
        color="alternative"
        className="w-fit"
        onClick={() => onChange(addGroup(draft))}
      >
        <HiOutlinePlus className="mr-1 h-3.5 w-3.5" />
        {tr("addGroup", d)}
      </Button>
    </div>
  );
}

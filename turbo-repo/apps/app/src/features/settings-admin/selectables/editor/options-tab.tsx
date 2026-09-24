"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { Button, Select, TextInput, ToggleSwitch } from "flowbite-react";
import {
  HiChevronDown,
  HiChevronUp,
  HiOutlinePlus,
  HiOutlineTrash,
  HiX,
} from "react-icons/hi";
import {
  ColorPickerDropdown,
  type ColorOption,
} from "@/features/common/components/color-picker-dropdown/color-picker-dropdown";
import { IconPickerDropdown } from "@/features/common/components/icon-picker-dropdown/icon-picker-dropdown";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { pickText } from "../localized";
import {
  SELECTABLE_COLORS,
  SELECTABLE_LANGUAGES,
  type Selectable,
} from "../types";
import { OptionIcon } from "../field/field-parts";
import {
  addOption,
  removeOption,
  updateOption,
  type Draft,
  type DraftOption,
} from "./editor-draft";
import { LocalizedInput } from "./localized-input";

interface OptionsTabProps {
  readonly draft: Draft;
  readonly onChange: (next: Draft) => void;
  readonly d: I18nRecord;
  readonly lang: string;
  /** The list this one depends on, whose values the options' parent picks from. */
  readonly parentList?: Selectable;
}

/** Badge colors as the shared color picker takes them; the empty value is "no color". */
function colorOptions(d: I18nRecord): ColorOption[] {
  return [
    {
      value: "",
      label: tr("noColor", d),
      dotClass: "border border-gray-300 bg-white dark:bg-gray-800",
    },
    ...SELECTABLE_COLORS.map((c) => ({
      value: c,
      label: trDynamic(`colors.${c}`, d),
      dotClass: DOT_CLASS[c],
    })),
  ];
}

const DOT_CLASS: Record<(typeof SELECTABLE_COLORS)[number], string> = {
  gray: "bg-gray-400",
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-yellow-400",
  indigo: "bg-indigo-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  cyan: "bg-cyan-500",
  teal: "bg-teal-500",
  lime: "bg-lime-500",
};

function firstInputId(rowId: string): string {
  return `option-label-${rowId}-${SELECTABLE_LANGUAGES[0]}`;
}

export function OptionsTab({
  draft,
  onChange,
  d,
  lang,
  parentList,
}: OptionsTabProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [focusRow, setFocusRow] = useState<string | null>(null);

  useEffect(() => {
    if (!focusRow) return;
    document.getElementById(firstInputId(focusRow))?.focus();
    setFocusRow(null);
  }, [focusRow]);

  if (draft.source.kind !== "STATIC") {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {tr("dynamicOptions", d)}
      </p>
    );
  }

  const append = () => {
    const next = addOption(draft);
    onChange(next);
    setFocusRow(next.options[next.options.length - 1]?.rowId ?? null);
  };

  /** Tab out of the last row's last field adds a row instead of leaving the table. */
  const tabAddsRow = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Tab" || e.shiftKey) return;
    e.preventDefault();
    append();
  };

  const lastRow = draft.options[draft.options.length - 1]?.rowId;

  return (
    <div className="flex flex-col gap-2">
      <div className="hidden grid-cols-[1.5rem_10rem_1fr_4.5rem] gap-2 px-1 text-xs font-medium uppercase text-gray-500 sm:grid dark:text-gray-400">
        <span />
        <span>{tr("valueLabel", d)}</span>
        <span>{tr("labelLabel", d)}</span>
        <span />
      </div>
      {draft.options.map((option, index) => (
        <OptionEditorRow
          key={option.rowId}
          index={index}
          option={option}
          d={d}
          lang={lang}
          groups={draft}
          parentList={parentList}
          expanded={open === option.rowId}
          onToggle={() => setOpen(open === option.rowId ? null : option.rowId)}
          onPatch={(patch) =>
            onChange(updateOption(draft, option.rowId, patch))
          }
          onRemove={() => onChange(removeOption(draft, option.rowId))}
          onLastKeyDown={option.rowId === lastRow ? tabAddsRow : undefined}
        />
      ))}
      <div className="flex items-center gap-3">
        <Button type="button" size="xs" color="alternative" onClick={append}>
          <HiOutlinePlus className="mr-1 h-3.5 w-3.5" />
          {tr("addOption", d)}
        </Button>
        <span className="text-xs text-gray-400">{tr("tabHint", d)}</span>
      </div>
    </div>
  );
}

interface OptionEditorRowProps {
  readonly index: number;
  readonly option: DraftOption;
  readonly d: I18nRecord;
  readonly lang: string;
  readonly groups: Pick<Draft, "groups" | "settings">;
  readonly parentList?: Selectable;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly onPatch: (patch: Partial<DraftOption>) => void;
  readonly onRemove: () => void;
  readonly onLastKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

function OptionEditorRow({
  index,
  option,
  d,
  lang,
  groups,
  parentList,
  expanded,
  onToggle,
  onPatch,
  onRemove,
  onLastKeyDown,
}: OptionEditorRowProps) {
  const Chevron = expanded ? HiChevronUp : HiChevronDown;
  return (
    <div className="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
      <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[1.5rem_10rem_1fr_4.5rem]">
        <span className="mt-2 flex items-center justify-center text-xs text-gray-400">
          <OptionIcon option={option} />
          {!option.icon && index + 1}
        </span>
        <TextInput
          sizing="sm"
          aria-label={tr("valueLabel", d)}
          value={option.value}
          title={tr("valueHint", d)}
          onChange={(e) => onPatch({ value: e.target.value })}
          className="font-mono"
        />
        <LocalizedInput
          idPrefix={`option-label-${option.rowId}`}
          sizing="sm"
          value={option.label}
          placeholder={tr("labelPlaceholder", d)}
          onChange={(label) => onPatch({ label })}
          onLastKeyDown={onLastKeyDown}
        />
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            title={tr("moreLabel", d)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <Chevron className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            title={tr("removeOption", d)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
          >
            <HiOutlineTrash className="h-4 w-4" />
          </button>
        </div>
      </div>
      {expanded && (
        <OptionDetails
          option={option}
          d={d}
          lang={lang}
          groups={groups}
          parentList={parentList}
          onPatch={onPatch}
        />
      )}
    </div>
  );
}

interface OptionDetailsProps {
  readonly option: DraftOption;
  readonly d: I18nRecord;
  readonly lang: string;
  readonly groups: Pick<Draft, "groups" | "settings">;
  readonly parentList?: Selectable;
  readonly onPatch: (patch: Partial<DraftOption>) => void;
}

function OptionDetails({
  option,
  d,
  lang,
  groups,
  parentList,
  onPatch,
}: OptionDetailsProps) {
  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-gray-100 pt-3 dark:border-gray-700">
      <LocalizedInput
        idPrefix={`option-description-${option.rowId}`}
        sizing="sm"
        value={option.description}
        placeholder={tr("optionDescriptionPlaceholder", d)}
        onChange={(description) => onPatch({ description })}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select
          sizing="sm"
          aria-label={tr("groupLabel", d)}
          value={option.group ?? ""}
          onChange={(e) => onPatch({ group: e.target.value || null })}
        >
          <option value="">{tr("noGroup", d)}</option>
          {groups.groups.map((g) => (
            <option key={g.rowId} value={g.key}>
              {pickText(g.label, lang) || g.key}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            {tr("colorLabel", d)}
            <ColorPickerDropdown
              value={option.color ?? ""}
              options={colorOptions(d)}
              title={tr("colorLabel", d)}
              onChange={(color) => onPatch({ color: color || null })}
            />
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            {tr("iconLabel", d)}
            <IconPickerDropdown
              value={option.icon ?? ""}
              title={tr("iconLabel", d)}
              searchPlaceholder={tr("iconSearch", d)}
              emptyMessage={tr("iconNone", d)}
              onChange={(icon) => onPatch({ icon })}
            />
            {option.icon && (
              <button
                type="button"
                onClick={() => onPatch({ icon: null })}
                title={tr("noIcon", d)}
                className="rounded p-0.5 text-gray-400 hover:text-gray-600"
              >
                <HiX className="h-3 w-3" />
              </button>
            )}
          </span>
        </div>
        {groups.settings.dependsOn && (
          <Select
            sizing="sm"
            aria-label={tr("parentLabel", d)}
            value={option.parent ?? ""}
            onChange={(e) => onPatch({ parent: e.target.value || null })}
          >
            <option value="">{tr("noParent", d)}</option>
            {parentList?.options.map((p) => (
              <option key={p.value} value={p.value}>
                {pickText(p.label, lang)}
              </option>
            ))}
          </Select>
        )}
      </div>
      <ToggleSwitch
        sizing="sm"
        checked={Boolean(option.disabled)}
        label={tr("disabledLabel", d)}
        onChange={(disabled) => onPatch({ disabled })}
      />
    </div>
  );
}

import { Badge, Button } from "flowbite-react";
import {
  HiOutlineDuplicate,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineViewList,
} from "react-icons/hi";
import { IconTile } from "@/features/common/components/icon-tile/icon-tile";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { OptionBadge } from "../selectables/field/field-parts";
import { pickText } from "../selectables/localized";
import type { Selectable } from "../selectables/types";

/** How many option badges a card shows before "+N". */
const PREVIEW_OPTIONS = 12;

interface SelectableCardProps {
  readonly list: Selectable;
  readonly lists: Selectable[];
  readonly d: I18nRecord;
  readonly lang: string;
  /** Owners get edit, duplicate and delete; members only see the list. */
  readonly editable: boolean;
  readonly onEdit: () => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
}

function sourceLabel(list: Selectable, d: I18nRecord): string {
  if (list.source.kind === "SYSTEM") return tr("sourceSystem", d);
  if (list.source.kind === "CONNECTION") return tr("sourceConnection", d);
  return tr("sourceStatic", d);
}

/** One list on the Selectables page: its name, what kind of list it is, and its first options. */
export function SelectableCard({
  list,
  lists,
  d,
  lang,
  editable,
  onEdit,
  onDuplicate,
  onDelete,
}: SelectableCardProps) {
  const parent = lists.find((l) => l.key === list.settings?.dependsOn);
  const hidden = list.options.length - PREVIEW_OPTIONS;
  return (
    <section className="flex flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <IconTile icon={HiOutlineViewList} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {pickText(list.name, lang)}
              </h2>
              <code className="text-xs text-gray-400">{list.key}</code>
              <Badge color="gray">
                {list.mode === "MULTIPLE"
                  ? tr("modeMultiple", d)
                  : tr("modeSingle", d)}
              </Badge>
              <Badge color={list.source.kind === "STATIC" ? "gray" : "indigo"}>
                {sourceLabel(list, d)}
              </Badge>
              {list.source.kind === "STATIC" && (
                <Badge color="gray">
                  {tr("optionsCount", d, {
                    count: String(list.options.length),
                  })}
                </Badge>
              )}
              {list.groups.length > 0 && (
                <Badge color="gray">
                  {tr("groupsCount", d, { count: String(list.groups.length) })}
                </Badge>
              )}
              {list.settings?.creatable && (
                <Badge color="purple">{tr("badgeCreatable", d)}</Badge>
              )}
              {list.settings?.maxSelections && (
                <Badge color="gray">
                  {tr("badgeMax", d, {
                    count: String(list.settings.maxSelections),
                  })}
                </Badge>
              )}
              {parent && (
                <Badge color="cyan">
                  {tr("badgeDependsOn", d, {
                    list: pickText(parent.name, lang),
                  })}
                </Badge>
              )}
            </div>
            {pickText(list.description, lang) && (
              <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                {pickText(list.description, lang)}
              </p>
            )}
          </div>
        </div>
        {editable && (
          <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
            <Button color="alternative" size="xs" onClick={onEdit}>
              <HiOutlinePencil className="mr-1 h-3.5 w-3.5" />
              {tr("edit", d)}
            </Button>
            <button
              type="button"
              onClick={onDuplicate}
              title={tr("duplicate", d)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <HiOutlineDuplicate className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              title={tr("removeSelectable", d)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            >
              <HiOutlineTrash className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {list.options.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-gray-100 px-4 py-3 dark:border-gray-700/60">
          {list.options.slice(0, PREVIEW_OPTIONS).map((option) => (
            <OptionBadge key={option.value} option={option} lang={lang} />
          ))}
          {hidden > 0 && <Badge color="gray">+{hidden}</Badge>}
        </div>
      )}
    </section>
  );
}

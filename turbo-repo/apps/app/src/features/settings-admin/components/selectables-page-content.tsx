"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { IconType } from "react-icons";
import { Badge, Button } from "flowbite-react";
import {
  HiOutlineDuplicate,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineViewList,
  HiPlus,
  HiRefresh,
  HiViewGridAdd,
} from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { OptionBadge } from "../selectables/field/field-parts";
import {
  draftFrom,
  duplicateDraft,
  type Draft,
} from "../selectables/editor/editor-draft";
import SelectableEditorModal from "../selectables/editor/selectable-editor-modal";
import { pickText } from "../selectables/localized";
import { useSelectableSources } from "../selectables/selectables-api";
import { useSelectables } from "../selectables/store";
import type { Selectable } from "../selectables/types";

interface SelectablesPageContentProps {
  readonly dict: I18nRecord;
  readonly lang: string;
}

/** How many option badges a card shows before "+N". */
const PREVIEW_OPTIONS = 12;

/** Same rounded tile the harness settings page uses for section headers. */
function IconTile({ icon: Icon }: { readonly icon: IconType }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
      <Icon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
    </div>
  );
}

type Confirm = { kind: "reset" } | { kind: "delete"; list: Selectable } | null;

/** Title, body, button and look of the confirmation for a reset or a delete. */
function confirmTexts(confirm: Confirm, d: I18nRecord, lang: string) {
  if (confirm?.kind === "delete") {
    return {
      variant: "danger" as const,
      title: tr("deleteConfirmTitle", d),
      description: tr("deleteConfirmBody", d, {
        name: pickText(confirm.list.name, lang),
      }),
      confirmLabel: tr("deleteConfirm", d),
    };
  }
  return {
    variant: "warning" as const,
    title: tr("resetConfirmTitle", d),
    description: tr("resetConfirmBody", d),
    confirmLabel: tr("resetConfirm", d),
  };
}

/**
 * Settings › Selectables: the organization's option lists, each summarized as
 * a card. Creating, editing and trying a list happen in the editor modal.
 */
export default function SelectablesPageContent({
  dict,
  lang,
}: SelectablesPageContentProps) {
  const d = dict?.selectables as I18nRecord;
  const breadcrumbDict = dict?.breadcrumb as I18nRecord;
  const { selectables, hydrated, save, remove, resetToDefaults } =
    useSelectables(tr("saveFailed", d));
  const { data: sources } = useSelectableSources();

  const router = useRouter();
  const searchParams = useSearchParams();
  const openedFromLink = useRef(false);

  const [editing, setEditing] = useState<Draft | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);

  const open = (draft: Draft | null) => {
    setEditing(draft);
    setModalOpen(true);
  };

  // A "create selectable" link lands here with ?new=1: open the editor, then
  // drop the param so a refresh does not reopen it.
  useEffect(() => {
    if (!hydrated || openedFromLink.current) return;
    if (searchParams.get("new") !== "1") return;
    openedFromLink.current = true;
    open(null);
    router.replace(`/${lang}/users/settings/selectables`);
  }, [hydrated, searchParams, router, lang]);

  const runConfirmed = async () => {
    if (!confirm) return;
    setBusy(true);
    if (confirm.kind === "reset") await resetToDefaults();
    else await remove(confirm.list.key);
    setBusy(false);
    setConfirm(null);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={breadcrumbDict}
          lang={lang}
          path={["user", "settings", "selectables"]}
          disableLinks
        />
      </div>

      <div className="mx-auto flex w-full max-w-screen-2xl flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-10 dark:bg-gray-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <IconTile icon={HiOutlineViewList} />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {tr("title", d)}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr("description", d)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              color="alternative"
              size="sm"
              onClick={() => setConfirm({ kind: "reset" })}
            >
              <HiRefresh className="mr-1.5 h-4 w-4" />
              {tr("resetSeed", d)}
            </Button>
            <Button color="blue" size="sm" onClick={() => open(null)}>
              <HiPlus className="mr-1.5 h-4 w-4" />
              {tr("newSelectable", d)}
            </Button>
          </div>
        </div>

        {hydrated && selectables.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-16 text-center dark:border-gray-700">
            <IconTile icon={HiViewGridAdd} />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("empty", d)}
            </p>
          </div>
        )}

        {selectables.map((list) => (
          <SelectableCard
            key={list.key}
            list={list}
            lists={selectables}
            d={d}
            lang={lang}
            onEdit={() => open(draftFrom(list))}
            onDuplicate={() =>
              open(
                duplicateDraft(
                  list,
                  selectables.map((s) => s.key)
                )
              )
            }
            onDelete={() => setConfirm({ kind: "delete", list })}
          />
        ))}
      </div>

      <SelectableEditorModal
        show={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editing}
        onSave={save}
        onDelete={(key) => {
          const list = selectables.find((s) => s.key === key);
          if (list) setConfirm({ kind: "delete", list });
        }}
        dict={d}
        lang={lang}
        lists={selectables}
        sources={sources ?? []}
      />

      <ConfirmationModal
        isOpen={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirmed}
        isProcessing={busy}
        {...confirmTexts(confirm, d, lang)}
      />
    </div>
  );
}

interface SelectableCardProps {
  readonly list: Selectable;
  readonly lists: Selectable[];
  readonly d: I18nRecord;
  readonly lang: string;
  readonly onEdit: () => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
}

function sourceLabel(list: Selectable, d: I18nRecord): string {
  if (list.source.kind === "SYSTEM") return tr("sourceSystem", d);
  if (list.source.kind === "CONNECTION") return tr("sourceConnection", d);
  return tr("sourceStatic", d);
}

function SelectableCard({
  list,
  lists,
  d,
  lang,
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

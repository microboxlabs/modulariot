"use client";

import { useState } from "react";
import { Button } from "flowbite-react";
import {
  HiOutlineViewList,
  HiPlus,
  HiRefresh,
  HiViewGridAdd,
} from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import { IconTile } from "@/features/common/components/icon-tile/icon-tile";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
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
import { SelectableCard } from "./selectable-card";

interface SelectablesPageContentProps {
  readonly dict: I18nRecord;
  readonly lang: string;
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

  const [editing, setEditing] = useState<Draft | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);

  const open = (draft: Draft | null) => {
    setEditing(draft);
    setModalOpen(true);
  };

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

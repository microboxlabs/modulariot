"use client";

import { useState } from "react";
import { Button } from "flowbite-react";
import {
  HiOutlineViewList,
  HiPlus,
  HiRefresh,
  HiViewGridAdd,
} from "react-icons/hi";
import SettingsPageShell from "@/features/common/components/settings-page-shell";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import { IconTile } from "@/features/common/components/icon-tile/icon-tile";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
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
  // Any member reads the lists; the API takes writes only from an owner.
  const { activeOrg } = useOrgScopes();
  const isOwner = activeOrg?.role === "OWNER";

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
    <SettingsPageShell
      breadcrumbDict={breadcrumbDict}
      lang={lang}
      path={["user", "settings", "selectables"]}
      icon={HiOutlineViewList}
      title={tr("title", d)}
      description={tr("description", d)}
      actions={
        isOwner && (
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
        )
      }
    >
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 pb-4">
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
            editable={isOwner}
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
    </SettingsPageShell>
  );
}

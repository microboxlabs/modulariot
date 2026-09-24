"use client";

import { useEffect, useState } from "react";
import { Button, TabItem, Tabs } from "flowbite-react";
import { HiOutlineTrash } from "react-icons/hi";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { Selectable, SelectableSourceDescriptor } from "../types";
import { BehaviorTab } from "./behavior-tab";
import {
  draftProblem,
  emptyDraft,
  toSelectable,
  type Draft,
} from "./editor-draft";
import { GeneralTab } from "./general-tab";
import { GroupsTab } from "./groups-tab";
import { OptionsTab } from "./options-tab";
import { SelectablePreview } from "./selectable-preview";

interface SelectableEditorModalProps {
  readonly show: boolean;
  readonly onClose: () => void;
  /** What the modal opens with: a list's draft, a copy, or null for a new one. */
  readonly initial: Draft | null;
  readonly onSave: (selectable: Selectable) => Promise<boolean>;
  readonly onDelete?: (key: string) => void;
  /** The `selectables` dictionary section. */
  readonly dict: I18nRecord;
  readonly lang: string;
  readonly lists: Selectable[];
  readonly sources: SelectableSourceDescriptor[];
}

/**
 * Create or edit one list. Nothing is written until Save, so cancelling a
 * half-filled list leaves the page as it was.
 */
export default function SelectableEditorModal({
  show,
  onClose,
  initial,
  onSave,
  onDelete,
  dict,
  lang,
  lists,
  sources,
}: SelectableEditorModalProps) {
  const d = dict?.editor as I18nRecord;
  const [draft, setDraft] = useState<Draft>(() => initial ?? emptyDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // A fresh draft each time the modal opens, not on every re-render.
  useEffect(() => {
    if (!show) return;
    setDraft(initial ?? emptyDraft());
    setError(null);
  }, [show, initial]);

  const parentList = lists.find((l) => l.key === draft.settings.dependsOn);

  const submit = async () => {
    const problem = draftProblem(draft);
    if (problem) {
      setError(new Error(trDynamic(`errors.${problem}`, d)));
      return;
    }
    setSaving(true);
    const saved = await onSave(toSelectable(draft));
    setSaving(false);
    if (saved) onClose();
  };

  const remove =
    !draft.isNew && onDelete ? (
      <Button
        type="button"
        size="xs"
        color="red"
        outline
        onClick={() => {
          onDelete(draft.key);
          onClose();
        }}
      >
        <HiOutlineTrash className="mr-1 h-3.5 w-3.5" />
        {tr("removeSelectable", dict)}
      </Button>
    ) : null;

  return (
    <FormModal
      isOpen={show}
      onClose={onClose}
      title={draft.isNew ? tr("newSelectable", dict) : tr("editTitle", dict)}
      subtitle={tr("editorSubtitle", dict)}
      headerActions={remove}
      submitLabel={tr("save", dict)}
      cancelLabel={tr("cancel", dict)}
      showCancelButton
      isProcessing={saving}
      error={error}
      onSubmit={submit}
      size="5xl"
    >
      <Tabs variant="underline" aria-label={tr("newSelectable", dict)}>
        <TabItem active title={tr("tabGeneral", d)}>
          <GeneralTab
            draft={draft}
            onChange={setDraft}
            d={d}
            lang={lang}
            sources={sources}
          />
        </TabItem>
        <TabItem title={`${tr("tabOptions", d)} (${draft.options.length})`}>
          <OptionsTab
            draft={draft}
            onChange={setDraft}
            d={d}
            lang={lang}
            parentList={parentList}
          />
        </TabItem>
        <TabItem title={`${tr("tabGroups", d)} (${draft.groups.length})`}>
          <GroupsTab draft={draft} onChange={setDraft} d={d} />
        </TabItem>
        <TabItem title={tr("tabBehavior", d)}>
          <BehaviorTab
            draft={draft}
            onChange={setDraft}
            d={d}
            lang={lang}
            lists={lists}
          />
        </TabItem>
      </Tabs>
      <SelectablePreview
        draft={draft}
        dict={dict}
        lang={lang}
        parentList={parentList}
      />
    </FormModal>
  );
}

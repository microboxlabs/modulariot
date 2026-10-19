"use client";

import { useEffect, useState } from "react";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ContactFormFields, {
  channelsFromContact,
  channelsToContact,
  emptyChannels,
  hasUnfinishedChannel,
  type ContactFormLabels,
  type ContactFormValue,
} from "./contact-form-fields";
import { makeContactId, type BookContact } from "./store";

const INPUT_CLASS =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white";

function emptyDraft(): ContactFormValue {
  return { name: "", role: "", channels: emptyChannels() };
}

export interface ContactEditorLabels {
  newTitle: string;
  editTitle: string;
  cancel: string;
  save: string;
  form: ContactFormLabels;
}

/** Labels from the Settings dictionary (`pages.userSettings`). */
export function settingsContactEditorLabels(dict: I18nRecord): ContactEditorLabels {
  const d = dict?.contactBook as I18nRecord;
  return {
    newTitle: tr("newContact", d),
    editTitle: tr("editTitle", d),
    cancel: tr("cancel", d),
    save: tr("save", d),
    form: {
      name: tr("nameLabel", d),
      role: tr("rolePlaceholder", d),
      channelsTitle: tr("channelsTitle", d),
      unfinishedHint: tr("unfinishedHint", d),
      states: {
        off: tr("stateOff", d),
        active: tr("stateActive", d),
        configured: tr("stateConfigured", d),
      },
      actions: {
        useSamePhone: tr("actionUseSamePhone", d),
      },
      methodLabels: {
        phone: tr("methodPhone", d),
        whatsapp: tr("methodWhatsapp", d),
        meet: tr("methodMeet", d),
        teams: tr("methodTeams", d),
      },
      fieldLabels: {
        phone: tr("fieldPhone", d),
        whatsapp: tr("fieldWhatsapp", d),
        meet: tr("fieldMeet", d),
        teams: tr("fieldTeams", d),
      },
    },
  };
}

/** Create/edit surface for one contact. Holds a local draft; nothing reaches
 *  the store until "Guardar". */
export default function ContactEditorModal({
  show,
  onClose,
  editing,
  onSave,
  knownRoles,
  labels,
}: {
  readonly show: boolean;
  readonly onClose: () => void;
  readonly editing: BookContact | null;
  readonly onSave: (contact: BookContact) => void;
  readonly knownRoles: readonly string[];
  readonly labels: ContactEditorLabels;
}) {
  const [draft, setDraft] = useState<ContactFormValue>(emptyDraft);

  useEffect(() => {
    if (show) {
      setDraft(
        editing
          ? {
              name: editing.name,
              role: editing.role,
              channels: channelsFromContact(editing),
            }
          : emptyDraft()
      );
    }
  }, [show, editing]);

  const canSave = draft.name.trim().length > 0 && !hasUnfinishedChannel(draft.channels);

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: editing?.id ?? makeContactId(),
      name: draft.name.trim(),
      role: draft.role.trim(),
      ...channelsToContact(draft.channels),
    });
    onClose();
  };

  return (
    <AbsoluteModal
      selected={show}
      setSelected={onClose}
      maxWidth="30rem"
      maxHeight="90vh"
      className="w-full rounded-2xl border border-gray-200 bg-white text-left shadow-2xl dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex w-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editing ? labels.editTitle : labels.newTitle}
          </h2>
        </div>
        <div className="min-h-0 overflow-y-auto px-6 py-5">
          <ContactFormFields
            value={draft}
            onChange={setDraft}
            roleSuggestionsSource={knownRoles}
            labels={labels.form}
            inputClassName={INPUT_CLASS}
            inlineSuggestions
          />
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-6 py-3 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {labels.cancel}
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {labels.save}
          </button>
        </div>
      </div>
    </AbsoluteModal>
  );
}

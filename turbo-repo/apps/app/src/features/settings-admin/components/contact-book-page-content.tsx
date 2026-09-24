"use client";

import { useState } from "react";
import {
  HiOutlineBookOpen,
  HiOutlinePencil,
  HiOutlineTrash,
  HiPlus,
} from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  CALL_METHOD_ICONS,
  type CallMethod,
} from "@/features/symptoms/components/map-view/prototype/call-center/call-method";
import { formatChileanPhone } from "@/features/symptoms/components/map-view/prototype/call-center/format-chilean-phone";
import ContactEditorModal, {
  settingsContactEditorLabels,
} from "../contact-book/contact-editor-modal";
import { useContactBook, type BookContact } from "../contact-book/store";

interface ContactBookPageContentProps {
  readonly dict: I18nRecord;
  readonly lang: string;
}

const METHOD_LABEL_KEYS: Record<CallMethod, string> = {
  phone: "methodPhone",
  whatsapp: "methodWhatsapp",
  meet: "methodMeet",
  teams: "methodTeams",
};

/**
 * PROTOTYPE — Settings › Libreta de contactos.
 *
 * The system-wide directory of people. Contacts created here (or from the
 * call-center picker's "create new" step) can be picked in "who to call".
 */
export default function ContactBookPageContent({
  dict,
  lang,
}: ContactBookPageContentProps) {
  const d = dict?.contactBook as I18nRecord;
  const breadcrumbDict = dict?.breadcrumb as I18nRecord;
  const { contacts, hydrated, save, remove } = useContactBook();
  const [editing, setEditing] = useState<BookContact | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const knownRoles = contacts.map((c) => c.role).filter(Boolean);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (contact: BookContact) => {
    setEditing(contact);
    setModalOpen(true);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={breadcrumbDict}
          lang={lang}
          path={["user", "settings", "contactBook"]}
          disableLinks
        />
      </div>

      <div className="mx-auto flex w-full max-w-screen-2xl min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-10 dark:bg-gray-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
              <HiOutlineBookOpen className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {tr("title", d)}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr("description", d)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <HiPlus className="h-4 w-4" />
            {tr("newContact", d)}
          </button>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-900/20">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {tr("savedHint", d)}
          </p>
        </div>

        {hydrated && contacts.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-16 text-center dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">{tr("empty", d)}</p>
          </div>
        )}

        {contacts.map((contact) => (
          <section
            key={contact.id}
            className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {contact.name}
                </h2>
                {contact.role && (
                  <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                    {contact.role}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                {contact.phone && <span>{formatChileanPhone(contact.phone)}</span>}
                <span className="flex items-center gap-1.5">
                  {contact.methods.map((m) => {
                    const Icon = CALL_METHOD_ICONS[m];
                    return (
                      <Icon
                        key={m}
                        className="h-3.5 w-3.5"
                        title={trDynamic(METHOD_LABEL_KEYS[m], d)}
                      />
                    );
                  })}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
              <button
                type="button"
                onClick={() => openEdit(contact)}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <HiOutlinePencil className="h-3.5 w-3.5" />
                {tr("edit", d)}
              </button>
              <button
                type="button"
                onClick={() => remove(contact.id)}
                title={tr("removeContact", d)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
              >
                <HiOutlineTrash className="h-4 w-4" />
              </button>
            </div>
          </section>
        ))}
      </div>

      <ContactEditorModal
        show={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSave={save}
        knownRoles={knownRoles}
        labels={settingsContactEditorLabels(dict)}
      />
    </div>
  );
}

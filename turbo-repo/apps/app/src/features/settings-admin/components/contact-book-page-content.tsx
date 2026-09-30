"use client";

import { useState } from "react";
import { HiOutlineBookOpen, HiOutlineUpload, HiPlus } from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ShowNotification } from "@/features/notifications/notification";
import { ControlTowerError } from "@/features/symptoms/control-tower/control-tower-api";
import ContactFormModal from "../contact-book/contact-form-modal";
import ContactTable, {
  type ContactTableLabels,
} from "../contact-book/contact-table";
import ImportContactsModal from "../contact-book/import-contacts-modal";
import { useContactBook, type BookContact } from "../contact-book/store";
import { useContactBadges } from "../contact-book/taxonomy-store";
import { useIncrementalCount } from "../contact-book/use-incremental-count";

const PAGE_SIZE = 10;

interface ContactBookPageContentProps {
  readonly dict: I18nRecord;
  readonly lang: string;
}

function contactTableLabels(d: I18nRecord): ContactTableLabels {
  return {
    columns: {
      name: tr("colName", d),
      badges: tr("colBadges", d),
      methods: tr("colMethods", d),
      actions: tr("colActions", d),
    },
    methodLabels: {
      phone: tr("methodPhone", d),
      whatsapp: tr("methodWhatsapp", d),
      meet: tr("methodMeet", d),
      teams: tr("methodTeams", d),
    },
    copied: tr("copied", d),
    notConnected: tr("methodNotConnected", d),
    clickToCopy: tr("clickToCopy", d),
    edit: tr("edit", d),
    remove: tr("removeContact", d),
  };
}

/**
 * Settings › Libreta de contactos.
 *
 * The organization's directory of people, stored by the Control Tower API
 * and shared by every operator. Contacts created here (or from the call
 * panel's "Llamar y guardar en la libreta") can be picked in "who to call".
 * The table loads 10 rows at a time as it's scrolled.
 */
export default function ContactBookPageContent({
  dict,
  lang,
}: ContactBookPageContentProps) {
  const d = dict?.contactBook as I18nRecord;
  const breadcrumbDict = dict?.breadcrumb as I18nRecord;
  const {
    contacts,
    hydrated,
    error,
    save,
    addMany,
    remove,
    renameTag,
    deleteTag,
  } = useContactBook();
  const { badges } = useContactBadges();
  const [editing, setEditing] = useState<BookContact | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const { visible, hasMore, sentinelRef } = useIncrementalCount(
    contacts.length,
    PAGE_SIZE
  );

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (contact: BookContact) => {
    setEditing(contact);
    setModalOpen(true);
  };

  const saveContact = async (contact: BookContact) => {
    try {
      await save(contact);
    } catch (e) {
      const duplicate = e instanceof ControlTowerError && e.status === 409;
      ShowNotification({
        type: "error",
        message: duplicate ? tr("duplicateRut", d) : tr("saveError", d),
      });
      throw e;
    }
  };

  const removeContact = (id: string) => {
    remove(id).catch((e: unknown) => {
      const forbidden = e instanceof ControlTowerError && e.status === 403;
      ShowNotification({
        type: "error",
        message: forbidden ? tr("removeError", d) : tr("removeFailed", d),
      });
    });
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

      <div className="flex w-full min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pt-2 pb-4 dark:bg-gray-900">
        <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <HiOutlineUpload className="h-4 w-4" />
              {tr("importContacts", d)}
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <HiPlus className="h-4 w-4" />
              {tr("newContact", d)}
            </button>
          </div>
        </div>

        {hydrated && contacts.length === 0 && (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 overflow-y-auto rounded-lg border border-dashed border-gray-300 px-4 py-16 text-center dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {error ? tr("loadError", d) : tr("empty", d)}
            </p>
          </div>
        )}

        {hydrated && contacts.length > 0 && (
          <ContactTable
            contacts={contacts.slice(0, visible)}
            badges={badges}
            labels={contactTableLabels(d)}
            onEdit={openEdit}
            onRemove={removeContact}
            className="min-h-0 flex-1"
            footer={
              hasMore && <div ref={sentinelRef} className="h-8" aria-hidden />
            }
          />
        )}
      </div>

      <ContactFormModal
        show={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSave={saveContact}
        onRenameTag={renameTag}
        onDeleteTag={deleteTag}
        dict={dict}
      />
      <ImportContactsModal
        show={importOpen}
        onClose={() => setImportOpen(false)}
        contacts={contacts}
        onImport={addMany}
        dict={dict}
      />
    </div>
  );
}

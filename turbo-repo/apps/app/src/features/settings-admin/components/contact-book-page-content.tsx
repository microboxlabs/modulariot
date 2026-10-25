"use client";

import { useMemo, useState } from "react";
import { Button } from "flowbite-react";
import { HiOutlineBookOpen, HiOutlineUpload, HiPlus } from "react-icons/hi";
import LayoutToggle, {
  type CatalogLayout,
} from "@/features/common/components/layout-toggle";
import SettingsPageShell from "@/features/common/components/settings-page-shell";
import { FilterChip } from "@/features/symptoms/maintainer/ui/filter-chip";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ShowNotification } from "@/features/notifications/notification";
import { ControlTowerError } from "@/features/symptoms/control-tower/control-tower-api";
import ContactFormModal from "../contact-book/contact-form-modal";
import ContactTable, {
  ContactCard,
  type ContactTableLabels,
} from "../contact-book/contact-table";
import ImportContactsModal from "../contact-book/import-contacts-modal";
import {
  organizationNames,
  useContactBook,
  type BookContact,
} from "../contact-book/store";
import {
  useContactBadges,
  type ContactBadge,
} from "../contact-book/taxonomy-store";
import { useIncrementalCount } from "../contact-book/use-incremental-count";

const PAGE_SIZE = 30;

type ContactFilters = Record<"role" | "company" | "tag", string>;
const NO_FILTERS: ContactFilters = { role: "", company: "", tag: "" };

/** Each value once, ignoring case, sorted. */
function distinct(values: readonly (string | undefined)[]): string[] {
  const byKey = new Map<string, string>();
  for (const v of values) {
    const text = v?.trim();
    if (text && !byKey.has(text.toLowerCase()))
      byKey.set(text.toLowerCase(), text);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "es"));
}

const same = (a: string | undefined, b: string) =>
  (a ?? "").trim().toLowerCase() === b.toLowerCase();

/** Whether the contact has the picked role, company and tag; an empty filter lets everyone through. */
export function contactPasses(
  c: BookContact,
  f: ContactFilters,
  badges: readonly ContactBadge[]
): boolean {
  if (f.role && !same(c.role, f.role)) return false;
  if (f.company && !same(c.company, f.company)) return false;
  if (f.tag) {
    const names = (c.badgeIds ?? []).map(
      (id) => badges.find((b) => b.id === id)?.name
    );
    if (!names.some((n) => same(n, f.tag))) return false;
  }
  return true;
}

interface ContactBookPageContentProps {
  readonly dict: I18nRecord;
  readonly lang: string;
}

function contactTableLabels(d: I18nRecord): ContactTableLabels {
  return {
    columns: {
      name: tr("colName", d),
      role: tr("colRole", d),
      company: tr("colCompany", d),
      badges: tr("colBadges", d),
      methods: tr("colMethods", d),
      actions: tr("colActions", d),
    },
    methodLabels: {
      phone: tr("methodPhone", d),
      whatsapp: tr("methodWhatsapp", d),
      meet: tr("methodMeet", d),
      teams: tr("methodTeams", d),
      email: tr("methodEmail", d),
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
  const organizations = useMemo(() => organizationNames(contacts), [contacts]);
  const [editing, setEditing] = useState<BookContact | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filters, setFilters] = useState<ContactFilters>(NO_FILTERS);
  const [layout, setLayout] = useState<CatalogLayout>("cards");
  const filteredCount = contacts.filter((c) =>
    contactPasses(c, filters, badges)
  ).length;
  const { visible, hasMore, sentinelRef } = useIncrementalCount(
    filteredCount,
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

  const roles = distinct(contacts.map((c) => c.role));
  const companies = distinct(contacts.map((c) => c.company));
  const tags = distinct(badges.map((b) => b.name));
  const filterDefs = [
    { key: "role" as const, label: tr("filterRole", d), options: roles },
    {
      key: "company" as const,
      label: tr("filterCompany", d),
      options: companies,
    },
    { key: "tag" as const, label: tr("filterTag", d), options: tags },
  ];
  const shown = contacts.filter((c) => contactPasses(c, filters, badges));
  const labels = contactTableLabels(d);
  const badgesById = new Map(badges.map((b) => [b.id, b]));
  const page = shown.slice(0, visible);

  return (
    <SettingsPageShell
      breadcrumbDict={breadcrumbDict}
      lang={lang}
      path={["user", "settings", "contactBook"]}
      icon={HiOutlineBookOpen}
      title={tr("title", d)}
      description={tr("description", d)}
      filters={filterDefs.map((f) => (
        <FilterChip
          key={f.key}
          label={f.label}
          value={filters[f.key]}
          options={f.options}
          allLabel={tr("filterAll", d)}
          onChange={(v) => setFilters({ ...filters, [f.key]: v })}
        />
      ))}
      actions={
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <LayoutToggle
            layout={layout}
            labels={{ cards: tr("viewCards", d), list: tr("viewList", d) }}
            onLayout={setLayout}
          />
          <Button size="sm" color="light" onClick={() => setImportOpen(true)}>
            <HiOutlineUpload className="mr-1 h-4 w-4" />
            {tr("importContacts", d)}
          </Button>
          <Button size="sm" color="blue" onClick={openCreate}>
            <HiPlus className="mr-1 h-4 w-4" />
            {tr("newContact", d)}
          </Button>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {hydrated && contacts.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {error ? tr("loadError", d) : tr("empty", d)}
          </p>
        )}
        {hydrated && contacts.length > 0 && shown.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            {tr("emptyFiltered", d)}
          </p>
        )}
        {page.length > 0 && layout === "cards" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {page.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                labels={labels}
                onEdit={openEdit}
                onRemove={removeContact}
                badgesById={badgesById}
              />
            ))}
          </div>
        )}
        {page.length > 0 && layout === "list" && (
          <ContactTable
            contacts={page}
            badges={badges}
            labels={labels}
            onEdit={openEdit}
            onRemove={removeContact}
          />
        )}
        {hasMore && <div ref={sentinelRef} className="h-8" aria-hidden />}
      </div>

      <ContactFormModal
        show={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSave={saveContact}
        onRenameTag={renameTag}
        onDeleteTag={deleteTag}
        organizations={organizations}
        dict={dict}
      />
      <ImportContactsModal
        show={importOpen}
        onClose={() => setImportOpen(false)}
        contacts={contacts}
        onImport={addMany}
        dict={dict}
      />
    </SettingsPageShell>
  );
}

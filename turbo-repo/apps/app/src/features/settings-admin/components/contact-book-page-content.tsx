"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Spinner } from "flowbite-react";
import { HiOutlineBookOpen, HiOutlineUpload, HiPlus } from "react-icons/hi";
import FilterSearch from "@/features/common/components/filter-search";
import LayoutToggle, {
  type CatalogLayout,
} from "@/features/common/components/layout-toggle";
import SettingsPageShell from "@/features/common/components/settings-page-shell";
import { FilterChip } from "@/features/symptoms/maintainer/ui/filter-chip";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ShowNotification } from "@/features/notifications/notification";
import {
  ControlTowerError,
  useContacts,
  type TowerContactQuery,
} from "@/features/symptoms/control-tower/control-tower-api";
import { useContactReach } from "@/features/conversations/conversations-api";
import { ruleHref } from "@/features/conversations/rules-tab";
import ContactFormModal from "../contact-book/contact-form-modal";
import ContactTable, {
  ContactCard,
  type ContactTableLabels,
} from "../contact-book/contact-table";
import ImportContactsModal from "../contact-book/import-contacts-modal";
import {
  bookCompanies,
  toBookContact,
  useContactBookPages,
  type BookContact,
} from "../contact-book/store";
import { useContactBadges } from "../contact-book/taxonomy-store";
import { useLoadMore } from "../contact-book/use-load-more";

type ContactFilters = Record<"kind" | "role" | "company" | "tag", string>;
const NO_FILTERS: ContactFilters = { kind: "", role: "", company: "", tag: "" };
const NO_VALUES: string[] = [];
const SEARCH_DEBOUNCE_MS = 300;

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
    card: {
      member: tr("cardMember", d),
      external: tr("cardExternal", d),
      provisional: tr("cardProvisional", d),
      unreachable: tr("cardUnreachable", d),
      rut: tr("cardRut", d),
      reaches: tr("cardReaches", d),
      reachesNone: tr("cardReachesNone", d),
      dependsOnEvent: tr("cardDependsOnEvent", d),
    },
  };
}

/**
 * Settings › Libreta de contactos.
 *
 * The organization's directory of people, stored by the Control Tower API
 * and shared by every operator. Contacts created here (or from the call
 * panel's "Llamar y guardar en la libreta") can be picked in "who to call".
 * The API filters the book and sends it 100 contacts at a time; the next 100 load as the list is scrolled.
 */
export default function ContactBookPageContent({
  dict,
  lang,
}: ContactBookPageContentProps) {
  const d = dict?.contactBook as I18nRecord;
  const breadcrumbDict = dict?.breadcrumb as I18nRecord;
  const [filters, setFilters] = useState<ContactFilters>(NO_FILTERS);
  const [search, setSearch] = useState("");
  const [searched, setSearched] = useState("");
  useEffect(() => {
    const timer = setTimeout(
      () => setSearched(search.trim()),
      SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [search]);
  const member = tr("cardMember", d);
  const external = tr("cardExternal", d);
  const query = useMemo<TowerContactQuery>(() => {
    let kind: TowerContactQuery["kind"];
    if (filters.kind === member) kind = "member";
    else if (filters.kind === external) kind = "external";
    return {
      q: searched,
      kind,
      role: filters.role,
      company: filters.company,
      tag: filters.tag,
    };
  }, [searched, filters, member, external]);
  const {
    contacts,
    facets,
    hydrated,
    error,
    hasMore,
    loadingMore,
    loadMore,
    save,
    addMany,
    remove,
    renameTag,
    deleteTag,
  } = useContactBookPages(query);
  const sentinelRef = useLoadMore(loadMore, hasMore && !loadingMore);
  const { badges } = useContactBadges();
  const { data: reach } = useContactReach();
  const organizations = useMemo(() => bookCompanies(facets), [facets]);
  const [editing, setEditing] = useState<BookContact | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [layout, setLayout] = useState<CatalogLayout>("cards");
  // The CSV preview flags documents already in the book, so the import reads the whole book.
  const { data: wholeBook } = useContacts(importOpen);

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
      const conflict = e instanceof ControlTowerError && e.status === 409;
      let message = tr("saveError", d);
      if (conflict)
        message = e.message.includes("member")
          ? tr("duplicateMember", d)
          : tr("duplicateRut", d);
      ShowNotification({ type: "error", message });
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

  const roles = facets?.roles ?? NO_VALUES;
  const companies = organizations.map((o) => o.name);
  const tags = facets?.tags ?? NO_VALUES;
  const filterDefs = [
    {
      key: "kind" as const,
      label: tr("filterKind", d),
      options: [member, external],
    },
    { key: "role" as const, label: tr("filterRole", d), options: roles },
    {
      key: "company" as const,
      label: tr("filterCompany", d),
      options: companies,
    },
    { key: "tag" as const, label: tr("filterTag", d), options: tags },
  ];
  const labels = contactTableLabels(d);
  const badgesById = new Map(badges.map((b) => [b.id, b]));
  const emptyBook = facets?.total === 0;

  return (
    <SettingsPageShell
      breadcrumbDict={breadcrumbDict}
      lang={lang}
      path={["user", "settings", "contactBook"]}
      icon={HiOutlineBookOpen}
      title={tr("title", d)}
      description={tr("description", d)}
      filters={
        <>
          <FilterSearch
            value={search}
            onChange={setSearch}
            label={tr("searchLabel", d)}
            placeholder={tr("searchPlaceholder", d)}
          />
          {filterDefs.map((f) => (
            <FilterChip
              key={f.key}
              label={f.label}
              value={filters[f.key]}
              options={f.options}
              allLabel={tr("filterAll", d)}
              onChange={(v) => setFilters({ ...filters, [f.key]: v })}
            />
          ))}
        </>
      }
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
        {hydrated && contacts.length === 0 && (error || emptyBook) && (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {error ? tr("loadError", d) : tr("empty", d)}
          </p>
        )}
        {hydrated && !error && !emptyBook && contacts.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            {tr("emptyFiltered", d)}
          </p>
        )}
        {contacts.length > 0 && layout === "cards" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {contacts.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                labels={labels}
                onEdit={openEdit}
                onRemove={removeContact}
                badgesById={badgesById}
                reach={reach ? (reach[c.id] ?? []) : undefined}
                ruleHref={(id) => ruleHref(lang, id)}
              />
            ))}
          </div>
        )}
        {contacts.length > 0 && layout === "list" && (
          <ContactTable
            contacts={contacts}
            badges={badges}
            labels={labels}
            onEdit={openEdit}
            onRemove={removeContact}
          />
        )}
        {hasMore && <div ref={sentinelRef} className="h-8" aria-hidden />}
        {loadingMore && (
          <div className="flex justify-center py-3">
            <Spinner size="sm" aria-label={tr("loadingMore", d)} />
          </div>
        )}
      </div>

      <ContactFormModal
        show={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSave={saveContact}
        onRenameTag={renameTag}
        onDeleteTag={deleteTag}
        organizations={organizations}
        roles={roles}
        takenMemberIds={
          new Set(
            (facets?.members ?? []).flatMap((m) =>
              m.contactId === editing?.id ? [] : [m.memberUserId]
            )
          )
        }
        dict={dict}
      />
      <ImportContactsModal
        show={importOpen}
        onClose={() => setImportOpen(false)}
        contacts={(wholeBook ?? []).map((c) => toBookContact(c, badges))}
        onImport={addMany}
        dict={dict}
      />
    </SettingsPageShell>
  );
}

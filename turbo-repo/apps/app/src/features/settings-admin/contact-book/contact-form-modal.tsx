"use client";

import { useEffect, useState, type ReactNode } from "react";
import { HiOutlineChatAlt2, HiOutlineTag, HiOutlineUser } from "react-icons/hi";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ShowNotification } from "@/features/notifications/notification";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import { ALL_CALL_METHODS } from "@/features/symptoms/components/map-view/prototype/call-center/call-method";
import { isRutValid } from "@/utils/rut";
import { useOrgMembers } from "../hooks/use-org-members";
import ContactBadgesSection from "./contact-badges-section";
import ContactChannelsSection, {
  channelFieldStatus,
  emptyChannelValues,
  type ChannelValues,
} from "./contact-channels-section";
import { normalizeRut } from "./contact-duplicates";
import {
  channelsFromContact,
  channelsToContact,
  emptyChannels,
} from "./contact-form-fields";
import ContactPersonSection, {
  type PersonDraft,
} from "./contact-person-section";
import { makeContactId, TagUpdateError, type BookContact } from "./store";
import {
  ensureBadge,
  renameBadge,
  restoreBadge,
  useContactBadges,
} from "./taxonomy-store";

interface ContactDraft {
  person: PersonDraft;
  badgeIds: string[];
  channels: ChannelValues;
}

function channelValuesFromContact(contact: BookContact): ChannelValues {
  const values = emptyChannelValues();
  const stored = channelsFromContact(contact);
  for (const m of ALL_CALL_METHODS) values[m] = stored[m].value;
  return values;
}

function draftFromContact(contact: BookContact | null): ContactDraft {
  return {
    person: {
      source: contact && !contact.orgMemberId ? "external" : "org",
      orgMemberId: contact?.orgMemberId,
      name: contact?.name ?? "",
      rut: contact?.rut ?? "",
    },
    badgeIds: contact?.badgeIds ?? [],
    channels: contact
      ? channelValuesFromContact(contact)
      : emptyChannelValues(),
  };
}

/** Only channels with a valid address become part of the contact. */
function storedChannels(
  values: ChannelValues
): Pick<BookContact, "channels" | "phone" | "methods"> {
  const channels = emptyChannels();
  for (const m of ALL_CALL_METHODS) {
    if (channelFieldStatus(m, values[m]) === "active")
      channels[m] = { enabled: true, value: values[m] };
  }
  return channelsToContact(channels);
}

function isPersonValid(person: PersonDraft): boolean {
  if (!person.name.trim()) return false;
  if (person.source === "org") return Boolean(person.orgMemberId);
  return !person.rut.trim() || isRutValid(normalizeRut(person.rut));
}

/** One section of the form, shown as a white card on the shaded body. */
function SectionCard({
  icon,
  title,
  subtitle,
  className = "",
  children,
}: Readonly<{
  icon: ReactNode;
  title: string;
  subtitle: string;
  className?: string;
  children: ReactNode;
}>) {
  return (
    <section
      className={`flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      <header className="flex items-center gap-3 border-b border-gray-100 p-2.5 dark:border-gray-700">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {subtitle}
          </p>
        </div>
      </header>
      <div className="flex flex-1 flex-col p-2.5">{children}</div>
    </section>
  );
}

/**
 * Settings › Libreta de contactos create/edit form: a shaded body with three
 * cards — Persona (pick someone from the organization, or type an outside
 * person's name and RUT) and Agrupación (a badge manager) side by side, and
 * Contacto full width below (each channel activated by configuring it).
 * Only badges are written as they're managed; the contact itself isn't
 * stored until "Guardar", which also completes a provisional contact. The
 * form stays open when `onSave` rejects; the caller says why.
 */
export default function ContactFormModal({
  show,
  onClose,
  editing,
  onSave,
  onRenameTag,
  onDeleteTag,
  dict,
}: Readonly<{
  show: boolean;
  onClose: () => void;
  editing: BookContact | null;
  onSave: (contact: BookContact) => void | Promise<unknown>;
  /** A badge was renamed or deleted here: update the contacts that use it.
   *  When the promise rejects, the badge change is undone here. */
  onRenameTag?: (from: string, to: string) => Promise<void>;
  onDeleteTag?: (name: string) => Promise<void>;
  /** `pages.userSettings` dictionary. */
  dict: I18nRecord;
}>) {
  const d = dict?.contactBook as I18nRecord;
  const { badges, ensure, rename, remove } = useContactBadges();
  const { activeOrg } = useOrgScopes();
  const { members, isLoading } = useOrgMembers(
    show ? (activeOrg?.slug ?? null) : null
  );
  const [draft, setDraft] = useState<ContactDraft>(() =>
    draftFromContact(null)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show) setDraft(draftFromContact(editing));
  }, [show, editing]);

  const { person } = draft;
  const rutInvalid =
    person.source === "external" &&
    person.rut.trim() !== "" &&
    !isRutValid(normalizeRut(person.rut));
  const canSave = isPersonValid(person) && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    const external = person.source === "external";
    const badgeIds = draft.badgeIds.filter((id) =>
      badges.some((b) => b.id === id)
    );
    setSaving(true);
    try {
      await onSave({
        ...editing,
        id: editing?.id ?? makeContactId(),
        name: person.name.trim(),
        rut: external ? person.rut.trim() || undefined : editing?.rut,
        orgMemberId: external ? undefined : person.orgMemberId,
        role: editing?.role ?? "",
        badgeIds,
        provisional: false,
        ...storedChannels(draft.channels),
      });
      onClose();
    } catch {
      // Kept open so nothing typed is lost.
    } finally {
      setSaving(false);
    }
  };

  const notifyTagError = (e: unknown) =>
    ShowNotification({
      type: "error",
      message:
        e instanceof TagUpdateError
          ? tr("tagUpdateError", d, { count: String(e.failed) })
          : tr("saveError", d),
    });

  const handleRenameBadge = (id: string, name: string) => {
    const from = badges.find((b) => b.id === id)?.name;
    const to = name.trim();
    const ok = rename(id, name);
    if (ok && from && from !== to && onRenameTag) {
      onRenameTag(from, to).catch((e: unknown) => {
        renameBadge(id, from);
        // Contacts already moved to the new name keep a badge for it.
        if (e instanceof TagUpdateError && e.updated > 0) ensureBadge(to);
        notifyTagError(e);
      });
    }
    return ok;
  };

  const handleDeleteBadge = (id: string) => {
    const badge = badges.find((b) => b.id === id);
    remove(id);
    if (badge && onDeleteTag) {
      onDeleteTag(badge.name).catch((e: unknown) => {
        restoreBadge(badge);
        notifyTagError(e);
      });
    }
  };

  return (
    <AbsoluteModal
      selected={show}
      setSelected={onClose}
      maxWidth="72rem"
      maxHeight="92vh"
      className="w-full rounded-2xl border border-gray-200 bg-white text-left shadow-2xl dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex w-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editing ? tr("editTitle", d) : tr("newContact", d)}
          </h2>
        </div>
        <div className="grid min-h-0 grid-cols-1 gap-4 overflow-y-auto bg-gray-50 px-5 py-5 lg:grid-cols-2 dark:bg-gray-900/60">
          <SectionCard
            icon={<HiOutlineUser className="h-4 w-4" />}
            title={tr("sectionPerson", d)}
            subtitle={tr("sectionPersonHint", d)}
          >
            <ContactPersonSection
              value={person}
              onChange={(next) => setDraft({ ...draft, person: next })}
              members={members}
              membersLoading={isLoading}
              rutInvalid={rutInvalid}
              d={d}
            />
          </SectionCard>
          <SectionCard
            icon={<HiOutlineTag className="h-4 w-4" />}
            title={tr("sectionGrouping", d)}
            subtitle={tr("sectionGroupingHint", d)}
          >
            <ContactBadgesSection
              selectedIds={draft.badgeIds}
              onChange={(badgeIds) => setDraft({ ...draft, badgeIds })}
              badges={badges}
              onCreate={ensure}
              onRename={handleRenameBadge}
              onDelete={handleDeleteBadge}
              d={d}
            />
          </SectionCard>
          <SectionCard
            className="lg:col-span-2"
            icon={<HiOutlineChatAlt2 className="h-4 w-4" />}
            title={tr("sectionContact", d)}
            subtitle={tr("sectionContactHint", d)}
          >
            <ContactChannelsSection
              values={draft.channels}
              onChange={(channels) => setDraft({ ...draft, channels })}
              d={d}
            />
          </SectionCard>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-6 py-3 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {tr("cancel", d)}
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void handleSave()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tr("save", d)}
          </button>
        </div>
      </div>
    </AbsoluteModal>
  );
}

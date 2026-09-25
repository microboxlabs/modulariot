"use client";

/**
 * PROTOTYPE — step 1 of the new "Llamar a…" debug flow: a contact list
 * sourced from its own dedicated `call-roles-store.ts` — not the generic
 * Selectables admin system (that's what the older, non-debug "Llamar al
 * conductor" form's dropdown still reads from via
 * `useSelectableOptions("who_to_call")`, kept untouched as the fallback).
 * The whole row is the call button — hover highlights it, clicking anywhere
 * on it moves to the dialing step. Calls made from here already show up as
 * treatments in the symptom's own timeline, so there's no separate call
 * history here — the trailing column is just a last-call-time + accepted/
 * denied tally, not a log.
 *
 * Adding a contact appends a real entry to that same dedicated store; its
 * typed name IS the person's name (not a role placeholder like the seeded
 * options), and it carries its own real phone number plus which calling
 * channels it's actually reachable on — see `contact-details.ts`. A seeded
 * option has no entry there at all, which is how a row tells the two kinds
 * of contact apart.
 */

import { useEffect, useState } from "react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { tr } from "@/features/i18n/tr.service";
import type { SelectableOption } from "@/features/settings-admin/selectables/types";
import { BentoGrid, PlainSection, GeneralInfoGrid } from "../prototype-form-kit";
import { formatChileanPhone } from "./format-chilean-phone";
import { mockNameForId, mockCallStatsForId } from "./mock-contact-data";
import { useContactDetails, type ContactDetails } from "./contact-details";
import { useCallRoles } from "./call-roles-store";
import ContactRow from "./contact-row";
import { isMockDataEnabled } from "../prototype-api-guard";
import type { CallMethod } from "./call-method";
import {
  useContactBook,
  type BookContact,
} from "@/features/settings-admin/contact-book/store";
import ContactEditorModal from "@/features/settings-admin/contact-book/contact-editor-modal";
import { HiOutlineSearch } from "react-icons/hi";
import { MdAddIcCall } from "react-icons/md";
import { CALL_METHOD_LABEL_KEYS } from "./call-method";

/** Deterministic mock number so a contact's phone stays stable across renders
 *  — there's no real phonebook backing these prototype "other" contacts.
 *  Gated by `isMockDataEnabled` like every other fabricated field here. */
function mockPhoneForId(id: string): string {
  if (!isMockDataEnabled()) return "";
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const digits = ((hash % 90000000) + 10000000).toString();
  return `+56 9 ${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
}

export default function CallCenterMenu({
  dict,
  treatmentData,
  onCall,
  recentCallTimes,
}: {
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  onCall: (
    contact: SelectableOption,
    phoneNumber: string,
    personName: string,
    /** Empty for a custom contact — its option name IS the person's name,
     *  not a role, so there's nothing to badge it with. */
    role: string,
    allowedMethods?: CallMethod[]
  ) => void;
  /** Real last-call time per contact id actually called this session (as
   *  opposed to `mockCallStatsForId`'s stable-but-fake history) — that
   *  contact's row shows this time in green instead of the mock one, and
   *  sorts to the bottom of the list. */
  recentCallTimes?: Record<string, Date>;
}) {
  const t = (k: string) => tr(`symptoms.${k}`, dict);
  const { options, addContact } = useCallRoles();
  const { details, setDetails } = useContactDetails();
  const { contacts: book, save: saveBookContact } = useContactBook();

  // `FormattedDate format="relative"` only recomputes on re-render — without
  // this the "hace X min" next to each contact would freeze at whatever it
  // read on mount instead of ticking forward as real time passes.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const [search, setSearch] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);

  const generalInfo = (
    <GeneralInfoGrid dict={dict} treatmentData={treatmentData} />
  );

  // An entry picked from the contact book stays LINKED to it: name, phone,
  // role and methods are read live from the book (edits in Settings show up
  // here at once), and deleting the person there removes the entry from this
  // list. Entries without a `bookId` (seeded roles, contacts added before the
  // book existed) keep using their own stored details.
  const bookById = new Map(book.map((c) => [c.id, c]));
  const linkedContact = (o: SelectableOption) => {
    const id = details[o.id]?.bookId;
    return id ? bookById.get(id) : undefined;
  };
  const visibleOptions = options.filter(
    (o) => !details[o.id]?.bookId || linkedContact(o)
  );
  const effectiveContact = (
    o: SelectableOption
  ): { name: string; custom: ContactDetails | undefined } => {
    const b = linkedContact(o);
    if (!b) return { name: o.name, custom: details[o.id] };
    return {
      name: b.name,
      custom: {
        phone: b.phone || undefined,
        role: b.role || undefined,
        methods: b.methods.length > 0 ? b.methods : undefined,
      },
    };
  };

  // Shared by rendering and searching so what you can search for is exactly
  // what the row displays.
  const describeOption = (option: SelectableOption) => {
    const isDriver = option.id === options[0]?.id;
    const { name: optionName, custom } = effectiveContact(option);
    const personName = custom
      ? optionName
      : isDriver
        ? (treatmentData?.trip_info?.driver ?? mockNameForId(option.id))
        : mockNameForId(option.id);
    const roleLabel = custom ? (custom.role ?? "") : optionName;
    const phone = formatChileanPhone(
      custom?.phone ??
        (isDriver
          ? (treatmentData?.trip_info?.driver_contact ?? mockPhoneForId(option.id))
          : mockPhoneForId(option.id))
    );
    return { custom, personName, roleLabel, phone };
  };

  const query = search.trim().toLowerCase();
  const queryDigits = query.replace(/\D/g, "");
  const matchesQuery = (name: string, role: string, phone: string) =>
    !query ||
    name.toLowerCase().includes(query) ||
    role.toLowerCase().includes(query) ||
    (queryDigits.length > 0 && phone.replace(/\D/g, "").includes(queryDigits));
  const optionMatches = (o: SelectableOption) => {
    const { personName, roleLabel, phone } = describeOption(o);
    return matchesQuery(personName, roleLabel, phone);
  };

  // Contacts actually called this session sink into their own "Ya llamados"
  // group below the rest (oldest of them first) instead of sitting wherever
  // they started — everyone else keeps the store's own order.
  const pendingOptions = visibleOptions.filter(
    (o) => !recentCallTimes?.[o.id] && optionMatches(o)
  );
  const calledOptions = recentCallTimes
    ? visibleOptions
        .filter((o) => recentCallTimes[o.id] && optionMatches(o))
        .sort(
          (a, b) => recentCallTimes[a.id].getTime() - recentCallTimes[b.id].getTime()
        )
    : [];

  // Contact-book people NOT on this list — only surfaced while searching, and
  // callable directly (no link is created; they just get called).
  const linkedBookIds = new Set(
    options.map((o) => details[o.id]?.bookId).filter((id): id is string => Boolean(id))
  );
  const bookOnly = query
    ? book.filter(
        (c) => !linkedBookIds.has(c.id) && matchesQuery(c.name, c.role, c.phone)
      )
    : [];

  // Every role already in use, seeded or custom — searched as the operator
  // types in the add-contact modal.
  const knownRoles = Array.from(
    new Set([
      ...visibleOptions
        .map((o) => {
          const { name, custom } = effectiveContact(o);
          return custom?.role ?? (custom ? undefined : name);
        })
        .filter((r): r is string => Boolean(r)),
      ...book.map((c) => c.role).filter(Boolean),
    ])
  );

  // "Agregar contacto": same modal as Settings › Libreta de contactos — the
  // person goes into the book and onto this list (linked).
  const handleAddContact = (contact: BookContact) => {
    saveBookContact(contact);
    const optionId = addContact(contact.name);
    setDetails(optionId, { bookId: contact.id });
  };

  const renderContactOption = (option: SelectableOption) => {
    const { custom, personName, roleLabel, phone } = describeOption(option);
    const recentCallAt = recentCallTimes?.[option.id];
    // `recentCallAt` is a real, tracked timestamp regardless of mock mode —
    // accepted/denied have no real backing either way, so default to 0
    // rather than spread `mockCallStatsForId`'s result, which is `null`
    // once mock data is off.
    const stats = recentCallAt
      ? { lastCallAt: recentCallAt, accepted: 0, denied: 0 }
      : mockCallStatsForId(option.id);

    return (
      <ContactRow
        key={option.id}
        personName={personName}
        roleLabel={roleLabel}
        phone={phone}
        stats={stats}
        recentlyCalled={!!recentCallAt}
        justCalledLabel={t("call_center_just_called")}
        ariaLabel={`${t("call_center_call_button")} ${personName}`}
        onClick={() => onCall(option, phone, personName, roleLabel, custom?.methods)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onCall(option, phone, personName, roleLabel, custom?.methods);
          }
        }}
      />
    );
  };

  const renderBookContact = (c: BookContact) => {
    const phone = formatChileanPhone(c.phone);
    const methods = c.methods.length > 0 ? c.methods : undefined;
    const option: SelectableOption = { id: c.id, name: c.name, description: "" };
    return (
      <ContactRow
        key={c.id}
        personName={c.name}
        roleLabel={c.role}
        phone={phone}
        ariaLabel={`${t("call_center_call_button")} ${c.name}`}
        onClick={() => onCall(option, phone, c.name, c.role, methods)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onCall(option, phone, c.name, c.role, methods);
          }
        }}
      />
    );
  };

  return (
    <BentoGrid>
      <PlainSection title={t("proto_section_general")}>{generalInfo}</PlainSection>

      {/* Same colors as the form kit's usual card — just with three explicit
          background tiers layered on top (card / header / row), since every
          row here needs its own background. Hand-rolled instead of stretching
          `FieldCard`, which doesn't have a per-row background hook. */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex h-10 shrink-0 items-center border-b border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="truncate text-sm font-semibold leading-none text-gray-900 dark:text-white">
            {t("proto_section_who")}
          </h3>
        </div>
        <div className="flex shrink-0 items-stretch gap-1 border-b border-gray-200 bg-white p-1.5 dark:border-gray-700 dark:bg-gray-800/60">
          <div className="relative min-w-0 flex-1">
            <HiOutlineSearch className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
            <input
              className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-2.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              placeholder={t("call_center_contact_search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            title={t("call_center_add_contact")}
            aria-label={t("call_center_add_contact")}
            className="flex w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white transition-colors hover:bg-blue-700"
          >
            <MdAddIcCall className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {visibleOptions.length === 0 && !query && (
            <p className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">
              {t("proto_selectable_unassigned")}
            </p>
          )}
          {pendingOptions.map(renderContactOption)}

          {calledOptions.length > 0 && (
            <div className="flex h-7 shrink-0 items-center border-b border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800/60">
              <h4 className="truncate text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("call_center_already_called_header")}
              </h4>
            </div>
          )}
          {calledOptions.map(renderContactOption)}

          {bookOnly.length > 0 && (
            <div className="flex h-7 shrink-0 items-center border-b border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800/60">
              <h4 className="truncate text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("call_center_contact_book_header")}
              </h4>
            </div>
          )}
          {bookOnly.map(renderBookContact)}

          {query &&
            pendingOptions.length === 0 &&
            calledOptions.length === 0 &&
            bookOnly.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
                {t("call_center_contact_none")}
              </p>
            )}
        </div>

      </section>

      <ContactEditorModal
        show={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        editing={null}
        onSave={handleAddContact}
        knownRoles={knownRoles}
        labels={{
          newTitle: t("call_center_contact_new"),
          editTitle: t("call_center_contact_new"),
          cancel: t("call_center_contact_cancel"),
          save: t("call_center_add_contact_confirm"),
          form: {
            name: t("call_center_add_contact_name"),
            role: t("call_center_add_contact_role_placeholder"),
            channelsTitle: t("call_center_ch_channels_title"),
            unfinishedHint: t("call_center_ch_unfinished_hint"),
            states: {
              off: t("call_center_ch_state_off"),
              active: t("call_center_ch_state_active"),
              configured: t("call_center_ch_state_configured"),
            },
            actions: {
              useSamePhone: t("call_center_ch_action_use_same_phone"),
            },
            methodLabels: {
              phone: t(CALL_METHOD_LABEL_KEYS.phone),
              whatsapp: t(CALL_METHOD_LABEL_KEYS.whatsapp),
              meet: t(CALL_METHOD_LABEL_KEYS.meet),
              teams: t(CALL_METHOD_LABEL_KEYS.teams),
            },
            fieldLabels: {
              phone: t("call_center_ch_field_phone"),
              whatsapp: t("call_center_ch_field_whatsapp"),
              meet: t("call_center_ch_field_meet"),
              teams: t("call_center_ch_field_teams"),
            },
          },
        }}
      />
    </BentoGrid>
  );
}

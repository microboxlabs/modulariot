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

import { useEffect, useRef, useState } from "react";
import { Button, TextInput } from "flowbite-react";
import { HiOutlinePlus } from "react-icons/hi";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { tr } from "@/features/i18n/tr.service";
import type { SelectableOption } from "@/features/settings-admin/selectables/types";
import { BentoGrid, PlainSection, GeneralInfoGrid } from "../prototype-form-kit";
import { formatChileanPhone } from "./format-chilean-phone";
import { mockNameForId, mockCallStatsForId } from "./mock-contact-data";
import { useContactDetails } from "./contact-details";
import { useCallRoles } from "./call-roles-store";
import ContactRow from "./contact-row";
import { isMockDataEnabled } from "../prototype-api-guard";
import {
  ALL_CALL_METHODS,
  CALL_METHOD_ICONS,
  CALL_METHOD_LABEL_KEYS,
  type CallMethod,
} from "./call-method";

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

  // `FormattedDate format="relative"` only recomputes on re-render — without
  // this the "hace X min" next to each contact would freeze at whatever it
  // read on mount instead of ticking forward as real time passes.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const [addingContact, setAddingContact] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState("");
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleFieldRef = useRef<HTMLDivElement>(null);
  const [newMethods, setNewMethods] = useState<CallMethod[]>(["phone"]);

  const generalInfo = (
    <GeneralInfoGrid dict={dict} treatmentData={treatmentData} />
  );

  // Contacts actually called this session sink into their own "Ya llamados"
  // group below the rest (oldest of them first) instead of sitting wherever
  // they started — everyone else keeps the store's own order.
  const pendingOptions = options.filter((o) => !recentCallTimes?.[o.id]);
  const calledOptions = recentCallTimes
    ? options
        .filter((o) => recentCallTimes[o.id])
        .sort(
          (a, b) => recentCallTimes[a.id].getTime() - recentCallTimes[b.id].getTime()
        )
    : [];

  // Every role already in use, seeded or custom — searched as the operator
  // types, or used as-is to create a new one if nothing matches.
  const knownRoles = Array.from(
    new Set(
      options
        .map((o) => details[o.id]?.role ?? (details[o.id] ? undefined : o.name))
        .filter((r): r is string => Boolean(r))
    )
  );
  const roleQuery = newRole.trim().toLowerCase();
  const roleSuggestions = knownRoles.filter(
    (r) => r.toLowerCase() !== roleQuery && (!roleQuery || r.toLowerCase().includes(roleQuery))
  );

  useEffect(() => {
    if (!roleMenuOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (!roleFieldRef.current?.contains(e.target as Node)) setRoleMenuOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [roleMenuOpen]);

  const resetAddContactForm = () => {
    setAddingContact(false);
    setNewName("");
    setNewPhone("");
    setNewRole("");
    setNewMethods(["phone"]);
  };

  const toggleNewMethod = (id: CallMethod) => {
    setNewMethods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleAddContact = () => {
    if (!newName.trim()) return;
    const optionId = addContact(newName.trim());
    setDetails(optionId, {
      phone: newPhone.trim() || undefined,
      role: newRole.trim() || undefined,
      methods: newMethods.length > 0 ? newMethods : undefined,
    });
    resetAddContactForm();
  };

  const renderContactOption = (option: SelectableOption) => {
    const isDriver = option.id === options[0]?.id;
    const custom = details[option.id];
    const personName = custom
      ? option.name
      : isDriver
        ? (treatmentData?.trip_info?.driver ?? mockNameForId(option.id))
        : mockNameForId(option.id);
    const roleLabel = custom ? (custom.role ?? "") : option.name;
    const phone = formatChileanPhone(
      custom?.phone ??
        (isDriver
          ? (treatmentData?.trip_info?.driver_contact ?? mockPhoneForId(option.id))
          : mockPhoneForId(option.id))
    );
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
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {options.length === 0 && (
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
        </div>

        {/* Fixed footer — a sibling of the scrollable list above, not its
            last item, so it stays put regardless of how the list scrolls. */}
        {addingContact ? (
          <div className="flex shrink-0 flex-col gap-2 border-t border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800/60">
            <TextInput
              sizing="sm"
              placeholder={t("call_center_add_contact_name")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <TextInput
              sizing="sm"
              type="tel"
              placeholder="+56 9 …"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
            {/* Search existing roles as you type, or just keep typing to
                create a new one — a role here is free text, not a managed
                list, so there's nothing to "create" beyond using the text. */}
            <div ref={roleFieldRef} className="relative">
              <TextInput
                sizing="sm"
                placeholder={t("call_center_add_contact_role_placeholder")}
                value={newRole}
                onChange={(e) => {
                  setNewRole(e.target.value);
                  setRoleMenuOpen(true);
                }}
                onFocus={() => setRoleMenuOpen(true)}
              />
              {roleMenuOpen && roleSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-32 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
                  {roleSuggestions.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setNewRole(r);
                        setRoleMenuOpen(false);
                      }}
                      className="block w-full truncate px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
                {t("call_center_add_contact_methods")}
              </span>
              <div className="flex flex-wrap gap-2">
                {ALL_CALL_METHODS.map((id) => {
                  const Icon = CALL_METHOD_ICONS[id];
                  const active = newMethods.includes(id);
                  const label = t(CALL_METHOD_LABEL_KEYS[id]);
                  return (
                    <button
                      key={id}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={active}
                      onClick={() => toggleNewMethod(id)}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                        active
                          ? "border-blue-500 bg-blue-500/20 text-blue-700 dark:text-blue-300"
                          : "border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:text-gray-300"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="xs"
                color="light"
                className="flex-1"
                onClick={resetAddContactForm}
              >
                {t("proto_back")}
              </Button>
              <Button
                size="xs"
                color="blue"
                className="flex-1"
                disabled={!newName.trim()}
                onClick={handleAddContact}
              >
                {t("call_center_add_contact_confirm")}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingContact(true)}
            className="flex w-full shrink-0 items-center gap-2 border-t border-gray-200 px-3 py-2.5 text-left text-xs font-medium text-blue-600 transition-colors hover:bg-white dark:border-gray-700 dark:text-blue-400 dark:hover:bg-gray-700"
          >
            <HiOutlinePlus className="h-4 w-4" />
            {t("call_center_add_contact")}
          </button>
        )}
      </section>
    </BentoGrid>
  );
}

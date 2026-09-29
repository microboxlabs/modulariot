"use client";

/**
 * PROTOTYPE — step 1 of the "Llamar a…" flow: who to call. The trip's driver
 * comes first, then the organization's contacts from the Control Tower API,
 * each with its last-call time and answered/missed counts. Contacts called in
 * this treatment episode sink into their own "Ya llamados" group. The whole
 * row is the call button. "Agregar contacto" creates a contact through the API.
 */

import { useEffect, useRef, useState } from "react";
import { Button, TextInput } from "flowbite-react";
import { HiOutlinePlus } from "react-icons/hi";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { tr } from "@/features/i18n/tr.service";
import { ShowNotification } from "@/features/notifications/notification";
import { BentoGrid, PlainSection, GeneralInfoGrid } from "../prototype-form-kit";
import { useTreatmentSession } from "../treatment-session";
import { formatChileanPhone } from "./format-chilean-phone";
import ContactRow from "./contact-row";
import { targetIdOfAction, useCallTargets, type CallTarget } from "./call-targets";
import {
  ALL_CALL_METHODS,
  CALL_METHOD_ICONS,
  CALL_METHOD_LABEL_KEYS,
  type CallMethod,
} from "./call-method";

/** Latest call time per call-list row, from the episode's recorded calls. */
function useEpisodeCallTimes(): Record<string, Date> {
  const { actions } = useTreatmentSession();
  const times: Record<string, Date> = {};
  for (const action of actions) {
    const id = targetIdOfAction(action);
    if (!id) continue;
    const at = new Date(action.performedAt);
    if (!times[id] || times[id] < at) times[id] = at;
  }
  return times;
}

export default function CallCenterMenu({
  dict,
  treatmentData,
  onCall,
}: Readonly<{
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  onCall: (target: CallTarget) => void;
}>) {
  const t = (k: string) => tr(`symptoms.${k}`, dict);
  const { targets, knownRoles, addContact } = useCallTargets(treatmentData);
  const recentCallTimes = useEpisodeCallTimes();

  // `FormattedDate format="relative"` only recomputes on re-render — without
  // this the "hace X min" next to each contact would freeze at whatever it
  // read on mount instead of ticking forward as real time passes.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const [addingContact, setAddingContact] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState("");
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleFieldRef = useRef<HTMLDivElement>(null);
  const [newMethods, setNewMethods] = useState<CallMethod[]>(["phone"]);

  // Contacts called in this episode go to "Ya llamados", oldest first.
  const pendingTargets = targets.filter((o) => !recentCallTimes[o.id]);
  const calledTargets = targets
    .filter((o) => recentCallTimes[o.id])
    .sort((a, b) => recentCallTimes[a.id].getTime() - recentCallTimes[b.id].getTime());

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

  const handleAddContact = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      await addContact({
        name: newName.trim(),
        phone: newPhone.trim(),
        role: newRole.trim(),
        methods: newMethods,
      });
      resetAddContactForm();
    } catch (error) {
      ShowNotification({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const renderTarget = (target: CallTarget) => {
    const recentCallAt = recentCallTimes[target.id];
    const stats = recentCallAt
      ? { lastCallAt: recentCallAt, accepted: target.stats?.accepted ?? 0, denied: target.stats?.denied ?? 0 }
      : target.stats;
    const phone = formatChileanPhone(target.phone);
    return (
      <ContactRow
        key={target.id}
        personName={target.personName}
        roleLabel={target.role}
        phone={phone}
        stats={stats}
        recentlyCalled={!!recentCallAt}
        justCalledLabel={t("call_center_just_called")}
        ariaLabel={`${t("call_center_call_button")} ${target.personName}`}
        onClick={() => onCall(target)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onCall(target);
          }
        }}
      />
    );
  };

  return (
    <BentoGrid>
      <PlainSection title={t("proto_section_general")}>
        <GeneralInfoGrid dict={dict} treatmentData={treatmentData} />
      </PlainSection>

      {/* Three explicit background tiers (card / header / row), since every
          row here needs its own background. */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex h-10 shrink-0 items-center border-b border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="truncate text-sm font-semibold leading-none text-gray-900 dark:text-white">
            {t("proto_section_who")}
          </h3>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {pendingTargets.map(renderTarget)}

          {calledTargets.length > 0 && (
            <div className="flex h-7 shrink-0 items-center border-b border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800/60">
              <h4 className="truncate text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("call_center_already_called_header")}
              </h4>
            </div>
          )}
          {calledTargets.map(renderTarget)}
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
            {/* Search existing roles as you type, or keep typing to use a new one. */}
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
              <Button size="xs" color="light" className="flex-1" onClick={resetAddContactForm}>
                {t("proto_back")}
              </Button>
              <Button
                size="xs"
                color="blue"
                className="flex-1"
                disabled={!newName.trim() || saving}
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

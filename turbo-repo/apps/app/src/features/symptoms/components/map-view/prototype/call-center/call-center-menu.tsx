"use client";

/**
 * "A quién llamar": the level's operator steps in order, each with the
 * contacts of the book that meet its condition, as the server evaluates it
 * with the case trip's RUTs. The rest of the book is under "Otros contactos".
 * With no steps, the whole book. Clicking a row moves to dialing.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  HiChevronDown,
  HiChevronRight,
  HiOutlineSearch,
  HiPlus,
} from "react-icons/hi";
import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { ShowNotification } from "@/features/notifications/notification";
import {
  DRIVER_ROLE,
  type WhoSummary,
} from "@/features/symptoms/control-tower/step-who";
import {
  type TowerContact,
  type TowerTripContacts,
  useSymptomTreatments,
  useTripContacts,
} from "@/features/symptoms/control-tower/control-tower-api";
import {
  type Step,
  useLevelResponse,
} from "@/features/symptoms/maintainer/maintainer-api";
import {
  BentoGrid,
  GeneralInfoGrid,
  PlainSection,
} from "../prototype-form-kit";
import {
  calledInCase,
  type CallGroup,
  callPlan,
  driverIds,
  fillScript,
  matchesTarget,
  stepAt,
  stepConditions,
} from "./call-plan";
import {
  ALL_CALL_METHODS,
  CALL_METHOD_LABEL_KEYS,
  type CallMethod,
} from "./call-method";
import {
  type CallTarget,
  type NewContactPreset,
  stepMethod,
  useCallTargets,
} from "./call-targets";
import ContactRow from "./contact-row";
import { formatChileanPhone } from "./format-chilean-phone";
import NewNumberPanel, {
  draftFromQuery,
  type NewNumberAction,
  type NewNumberDraft,
} from "./new-number-panel";

const CHANNEL_KEYS: Record<string, string> = {
  call: "channelCall",
  whatsapp: "channelWhatsapp",
  teams: "channelTeams",
  email: "channelEmail",
};

function channelLabel(channel: string | null, d: I18nRecord) {
  const key = channel ? CHANNEL_KEYS[channel] : undefined;
  return key ? trDynamic(key, d) : (channel ?? "");
}

function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * A step's heading: "Conductor del viaje", "<Rol> · <empresa transportista>",
 * the role, or the condition itself when the clauses cannot say it.
 */
function targetText(
  who: string,
  summary: WhoSummary | null,
  carrierName: string | undefined,
  d: I18nRecord
) {
  if (!who.trim()) return tr("anyone", d);
  if (!summary) return who;
  if (summary.driver) return tr("driver", d);
  if (summary.carrier)
    return tr("groupCarrier", d, {
      role: summary.role ?? tr("anyRole", d),
      company: carrierName?.trim() || tr("tripCarrier", d),
    });
  return summary.role ?? who;
}

/** What an empty step says. */
function notInBookText(summary: WhoSummary | null, d: I18nRecord) {
  if (summary?.driver) return tr("driverNotInBook", d);
  if (summary?.carrier)
    return summary.role
      ? tr("carrierRoleNotInBook", d, { role: summary.role })
      : tr("carrierNotInBook", d);
  return tr("noContacts", d);
}

/** The role and RUTs a contact created from an empty trip step starts with. */
function presetFor(
  summary: WhoSummary | null,
  trip: TowerTripContacts | undefined,
  carrierName: string | undefined
): NewContactPreset | undefined {
  const driverRut =
    trip?.data.driverRut ??
    (summary?.driverField === "either"
      ? trip?.data.secondDriverRut
      : undefined);
  if (summary?.driver && driverRut)
    return { role: DRIVER_ROLE, nationalId: driverRut };
  if (summary?.carrier && trip?.data.carrierRut)
    return {
      role: summary.role ?? "",
      companyRut: trip?.data.carrierRut,
      company: carrierName?.trim() || undefined,
    };
  return undefined;
}

const NO_STEPS: Step[] = [];

function methodLabels(dict: I18nRecord): Record<CallMethod, string> {
  return Object.fromEntries(
    ALL_CALL_METHODS.map((m) => [
      m,
      trDynamic(`symptoms.${CALL_METHOD_LABEL_KEYS[m]}`, dict),
    ])
  ) as Record<CallMethod, string>;
}

const SUBHEADER =
  "flex h-7 shrink-0 items-center border-b border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800/60";

/** Seconds since `startedAt`, ticking every second. */
function useElapsed(startedAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (now - startedAt) / 1000;
}

function TargetRow({
  target,
  calledAt,
  step,
  dict,
  d,
  onCall,
}: Readonly<{
  target: CallTarget;
  calledAt: Date | undefined;
  /** The step the row is listed under; absent under "Otros contactos". */
  step?: Step;
  dict: I18nRecord;
  d: I18nRecord;
  onCall: (target: CallTarget) => void;
}>) {
  const wanted = step ? stepMethod(step.channel) : null;
  const unavailable = wanted !== null && !target.methods.includes(wanted);
  const phone = formatChileanPhone(target.phone);
  const stats = calledAt
    ? {
        lastCallAt: calledAt,
        accepted: target.stats?.accepted ?? 0,
        denied: target.stats?.denied ?? 0,
      }
    : target.stats;
  return (
    <ContactRow
      personName={target.personName}
      roleLabel={target.role}
      phone={phone}
      stats={stats}
      recentlyCalled={!!calledAt}
      justCalledLabel={tr("symptoms.call_center_just_called", dict)}
      ariaLabel={`${tr("symptoms.call_center_call_button", dict)} ${target.personName}`}
      methods={target.methods}
      methodLabels={methodLabels(dict)}
      unavailableNote={
        unavailable
          ? tr("unavailableOn", d, { channel: channelLabel(step!.channel, d) })
          : undefined
      }
      onClick={() => onCall({ ...target, phone })}
    />
  );
}

function StepGroup({
  group,
  due,
  elapsed,
  stepEnd,
  loading,
  called,
  treatmentData,
  trip,
  canSkip,
  dict,
  d,
  onCall,
  onSkip,
  onNewNumber,
}: Readonly<{
  group: CallGroup;
  due: number;
  elapsed: number;
  stepEnd: number;
  loading: boolean;
  called: ReadonlyMap<string, Date>;
  treatmentData: TreatmentsGeneralResponseItem | null;
  /** The server's answer for the steps' conditions, with the trip's RUTs. */
  trip: TowerTripContacts | undefined;
  canSkip: boolean;
  dict: I18nRecord;
  d: I18nRecord;
  onCall: (target: CallTarget) => void;
  onSkip: () => void;
  onNewNumber: (draft: NewNumberDraft) => void;
}>) {
  const carrierName = treatmentData?.trip_info?.carrier;
  const preset = presetFor(group.summary, trip, carrierName);
  const { step, index } = group;
  const isDue = index === due;
  const [skipping, setSkipping] = useState(false);
  const [reason, setReason] = useState("");
  let tone = "bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  if (isDue)
    tone =
      "border-l-2 border-l-blue-600 bg-blue-50 font-semibold text-gray-900 dark:bg-blue-900/20 dark:text-white";
  else if (index < due)
    tone = "bg-white text-gray-400 dark:bg-gray-800 dark:text-gray-500";
  return (
    <div aria-current={isDue ? "step" : undefined}>
      <div
        className={`flex items-center gap-2 border-b border-gray-200 px-3 py-2 text-xs dark:border-gray-700 ${tone}`}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[10px]">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate">
          {targetText(group.who, group.summary, carrierName, d)}
        </span>
        <span>{channelLabel(step.channel, d)}</span>
        <span className="w-12 text-right">{step.budgetMinutes ?? "—"} min</span>
      </div>
      {isDue && step.script && (
        <blockquote className="border-b border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
          <span className="mb-1 block text-xs text-gray-500">
            {tr("say", d)}
          </span>
          {fillScript(step.script, treatmentData)}
        </blockquote>
      )}
      {group.targets.map((target) => (
        <TargetRow
          key={target.id}
          target={target}
          calledAt={called.get(target.id)}
          step={step}
          dict={dict}
          d={d}
          onCall={onCall}
        />
      ))}
      {group.targets.length === 0 && !loading && (
        <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400">
          <p className="min-w-0 flex-1">{notInBookText(group.summary, d)}</p>
          {preset && (
            <button
              type="button"
              onClick={() => onNewNumber({ phone: "", name: "", preset })}
              className="flex shrink-0 items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              <HiPlus className="h-3.5 w-3.5" />
              {tr("newNumber", d)}
            </button>
          )}
        </div>
      )}
      {isDue && (
        <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <span>{tr("dueIn", d, { time: clock(stepEnd - elapsed) })}</span>
          {canSkip && !skipping && (
            <button
              type="button"
              className="ml-auto flex items-center text-blue-700 hover:underline dark:text-blue-300"
              onClick={() => setSkipping(true)}
            >
              {tr("skip", d)}
              <HiChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {isDue && skipping && (
        <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
          <input
            aria-label={tr("skipReason", d)}
            className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            placeholder={tr("skipReason", d)}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            type="button"
            disabled={!reason.trim()}
            className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
            onClick={() => {
              setSkipping(false);
              setReason("");
              onSkip();
            }}
          >
            {tr("skipConfirm", d)}
          </button>
        </div>
      )}
    </div>
  );
}

function OtherContacts({
  targets,
  called,
  collapsible,
  dict,
  d,
  onCall,
  onNewNumber,
}: Readonly<{
  targets: CallTarget[];
  called: ReadonlyMap<string, Date>;
  /** False shows the list open, with no header. */
  collapsible: boolean;
  dict: I18nRecord;
  d: I18nRecord;
  onCall: (target: CallTarget) => void;
  onNewNumber: (draft: NewNumberDraft) => void;
}>) {
  const [open, setOpen] = useState(!collapsible);
  const [search, setSearch] = useState("");
  const shown = targets.filter((t) => matchesTarget(t, search));
  const Chevron = open ? HiChevronDown : HiChevronRight;
  return (
    <>
      {collapsible && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={`${SUBHEADER} gap-1 text-left`}
        >
          <Chevron className="h-3.5 w-3.5 text-gray-500" />
          <h4 className="truncate text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {tr("otherContacts", d, { n: String(targets.length) })}
          </h4>
        </button>
      )}
      {(!collapsible || open) && (
        <>
          <div className="flex shrink-0 items-stretch gap-1 border-b border-gray-200 bg-white p-1.5 dark:border-gray-700 dark:bg-gray-800/60">
            <div className="relative min-w-0 flex-1">
              <HiOutlineSearch className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
              <input
                className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-2.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                placeholder={trDynamic(
                  collapsible
                    ? "symptoms.call_center_other_search_placeholder"
                    : "symptoms.call_center_contact_search_placeholder",
                  dict
                )}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {shown.map((target) => (
            <TargetRow
              key={target.id}
              target={target}
              calledAt={called.get(target.id)}
              dict={dict}
              d={d}
              onCall={onCall}
            />
          ))}
          {search.trim() && shown.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
              {tr("symptoms.call_center_contact_none", dict)}
            </p>
          )}
          <button
            type="button"
            onClick={() => onNewNumber(draftFromQuery(search))}
            className="flex shrink-0 items-center gap-1.5 border-b border-gray-200 bg-white px-3 py-2.5 text-left text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-blue-500/10"
          >
            <HiPlus className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {search.trim()
                ? tr("symptoms.call_center_add_query", dict, {
                    query: search.trim(),
                  })
                : tr("newNumber", d)}
            </span>
          </button>
        </>
      )}
    </>
  );
}

function newTarget(
  contact: TowerContact | null,
  name: string,
  phone: string
): CallTarget {
  return {
    id: contact?.id ?? `new:${phone}`,
    contactId: contact?.id,
    personName: contact?.name ?? name,
    role: contact?.role ?? "",
    phone: formatChileanPhone(contact?.phone ?? phone),
    methods: ["phone", "whatsapp"],
    stats: null,
  };
}

export default function CallCenterMenu({
  dict,
  treatmentData,
  startedAt,
  skippedTo,
  onSkip,
  onCall,
}: Readonly<{
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  /** When the panel opened; the due step follows the time since. */
  startedAt: number;
  /** The step the operator skipped to, if any. */
  skippedTo: number | null;
  onSkip: (step: number) => void;
  onCall: (target: CallTarget) => void;
}>) {
  const d = (dict.symptoms as I18nRecord)?.ladder as I18nRecord;
  const symptom = treatmentData?.symptom_info;
  const { data: level } = useLevelResponse(
    symptom?.name ?? null,
    symptom?.icu_code ?? null
  );
  const { targets, addContact, isLoading } = useCallTargets();
  // Only engine cases (negative ids) have Control Tower treatments and a trip the server reads.
  const caseId = symptom?.id != null && symptom.id < 0 ? symptom.id : null;
  const { data: treatments } = useSymptomTreatments(caseId);
  const elapsed = useElapsed(startedAt);
  const [addDraft, setAddDraft] = useState<NewNumberDraft | null>(null);
  const callVersion = useRef(0);
  useEffect(
    () => () => {
      callVersion.current += 1;
    },
    []
  );
  const selectTarget = (target: CallTarget) => {
    callVersion.current += 1;
    onCall(target);
  };

  const response = level?.level.response;
  const steps = response?.operator ? (response.steps ?? NO_STEPS) : NO_STEPS;
  const conditions = useMemo(() => stepConditions(steps), [steps]);
  const { data: tripView, mutate: refreshTrip } = useTripContacts(
    symptom?.id,
    conditions
  );
  const matches = tripView?.matches;
  const called = useMemo(
    () => calledInCase(treatments, driverIds(steps, matches ?? [])),
    [treatments, steps, matches]
  );
  const plan = useMemo(
    () => callPlan(steps, targets, called, matches),
    [steps, targets, called, matches]
  );
  const due =
    steps.length > 0 ? Math.max(stepAt(steps, elapsed), skippedTo ?? 0) : -1;
  const stepEnd = steps
    .slice(0, due + 1)
    .reduce((sum, s) => sum + (s.budgetMinutes ?? 0) * 60, 0);
  const sla = (response?.slaMinutes ?? 0) * 60;

  const handleNewNumber = async (
    { phone, name, preset }: NewNumberDraft,
    action: NewNumberAction
  ) => {
    const version = ++callVersion.current;
    const number = phone.trim();
    const personName = name.trim() || formatChileanPhone(number);
    setAddDraft(null);
    if (action === "callAndSave") {
      try {
        const saved = await addContact({
          name: personName,
          phone: number,
          preset,
        });
        void refreshTrip();
        if (callVersion.current === version)
          selectTarget(newTarget(saved, personName, number));
        return;
      } catch {
        if (callVersion.current !== version) return;
        ShowNotification({
          type: "error",
          message: tr("symptoms.call_center_new_save_error", dict),
        });
      }
    }
    selectTarget(newTarget(null, personName, number));
  };

  return (
    <BentoGrid>
      <PlainSection title={tr("symptoms.proto_section_general", dict)}>
        <GeneralInfoGrid dict={dict} treatmentData={treatmentData} />
      </PlainSection>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="truncate text-sm font-semibold leading-none text-gray-900 dark:text-white">
            {tr("symptoms.proto_section_who", dict)}
          </h3>
          {steps.length > 0 && level && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              v{level.version}
            </span>
          )}
          {steps.length > 0 && sla > 0 && (
            <span
              className={`ml-auto font-mono text-xs ${elapsed > sla ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}`}
            >
              SLA {clock(sla - elapsed)}
            </span>
          )}
        </div>
        {steps.length > 0 && (
          // Announced only when the due step changes, not every second.
          <p className="sr-only" role="status" aria-live="polite">
            {tr("dueStep", d, {
              n: String(due + 1),
              role: targetText(
                plan.groups[due]?.who ?? "",
                plan.groups[due]?.summary ?? null,
                treatmentData?.trip_info?.carrier,
                d
              ),
            })}
          </p>
        )}
        {addDraft && (
          <NewNumberPanel
            dict={dict}
            initial={addDraft}
            onSubmit={(draft, action) => void handleNewNumber(draft, action)}
            onCancel={() => setAddDraft(null)}
          />
        )}
        <div
          className={`min-h-0 flex-1 flex-col overflow-y-auto ${addDraft ? "hidden" : "flex"}`}
        >
          {plan.groups.map((group) => (
            <StepGroup
              key={`step-${group.index}`}
              group={group}
              trip={tripView}
              onNewNumber={setAddDraft}
              due={due}
              elapsed={elapsed}
              stepEnd={stepEnd}
              loading={isLoading}
              called={called}
              treatmentData={treatmentData}
              canSkip={due < steps.length - 1}
              dict={dict}
              d={d}
              onCall={selectTarget}
              onSkip={() => onSkip(due + 1)}
            />
          ))}
          <OtherContacts
            targets={plan.others}
            called={called}
            collapsible={steps.length > 0}
            dict={dict}
            d={d}
            onCall={selectTarget}
            onNewNumber={setAddDraft}
          />
        </div>
      </section>
    </BentoGrid>
  );
}

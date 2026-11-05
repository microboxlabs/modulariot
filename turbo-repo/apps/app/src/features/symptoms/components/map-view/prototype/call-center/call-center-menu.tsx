"use client";

/**
 * "A quién llamar": the level's operator steps in order, each with the
 * contacts of the book that meet its condition, as the server evaluates it
 * with the case trip's RUTs. The rest of the book is under "Otros contactos".
 * With no steps, the whole book. Clicking a row moves to dialing.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  HiChevronDown,
  HiChevronRight,
  HiOutlineSearch,
  HiPhone,
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
  type ScriptContext,
  type TowerContact,
  type TowerTripContacts,
  useCaseContext,
  useSymptomTreatments,
  useTripContacts,
} from "@/features/symptoms/control-tower/control-tower-api";
import {
  type Step,
  useControlTowerAccess,
  useLevelResponse,
} from "@/features/symptoms/maintainer/maintainer-api";
import {
  type FieldLabels,
  type FilledPart,
  filledParts,
  partsText,
} from "@/features/symptoms/maintainer/script-fill";
import ScriptText from "@/features/symptoms/maintainer/script-text";
import {
  BentoGrid,
  GeneralInfoGrid,
  PlainSection,
} from "../prototype-form-kit";
import {
  calledInCase,
  type CallGroup,
  callPlan,
  contextOfTreatment,
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
  isTripDriver,
  type NewContactPreset,
  stepMethod,
  tripPhoneE164,
  useCallTargets,
} from "./call-targets";
import ContactRow from "./contact-row";
import {
  EMERGENCY_COUNTRY,
  EMERGENCY_NUMBERS,
  emergencyTarget,
} from "./emergency-numbers";
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
    return {
      role: DRIVER_ROLE,
      nationalId: driverRut,
      nationalIdType: /^\d{11}$/.test(trip?.data.carrierRut ?? "")
        ? "DNI"
        : "RUT",
    };
  if (summary?.carrier && trip?.data.carrierRut)
    return {
      role: summary.role ?? "",
      companyRut: trip?.data.carrierRut,
      companyTaxIdType: /^\d{11}$/.test(trip.data.carrierRut) ? "RUC" : "RUT",
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

/** Rows of "Otros contactos" rendered per page; the menu re-renders every second for the SLA clock. */
const OTHERS_PAGE = 50;

const SUBHEADER =
  "flex h-7 shrink-0 items-center border-b border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800/60";

/** Seconds since `startedAt`, ticking every second; null with no start. */
function useElapsed(startedAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  return startedAt === null ? null : Math.max(0, (now - startedAt) / 1000);
}

/** The names of the script's fields, for the blanks the case cannot fill. */
function fieldLabels(dict: I18nRecord): FieldLabels {
  const pages = dict.pages as I18nRecord | undefined;
  const settings = pages?.userSettings as I18nRecord | undefined;
  const catalog = settings?.symptomCatalog as I18nRecord | undefined;
  return catalog?.scriptField as FieldLabels;
}

function TargetRow({
  target,
  calledAt,
  step,
  script,
  dict,
  d,
  onCall,
  tripPhone,
  canEditContacts = false,
  onUseTripPhone,
}: Readonly<{
  target: CallTarget;
  calledAt: Date | undefined;
  /** The step the row is listed under; absent under "Otros contactos". */
  step?: Step;
  /** The step's script and goal, filled with the case; absent outside a step. */
  script?: CallScript;
  dict: I18nRecord;
  d: I18nRecord;
  onCall: OnCall;
  /** The trip's driver phone in E.164; passed only for the trip driver's row. */
  tripPhone?: string;
  /** The user can create and edit book contacts. */
  canEditContacts?: boolean;
  /** Saves `tripPhone` on the contact and calls it; resolves once done or failed. */
  onUseTripPhone?: OnUseTripPhone;
}>) {
  const { lang } = useParams<{ lang: string }>();
  const [savingTripPhone, setSavingTripPhone] = useState(false);
  const wanted = step ? stepMethod(step.channel) : null;
  const reachable = target.methods.length > 0;
  const unavailable =
    reachable && wanted !== null && !target.methods.includes(wanted);
  // A book contact with no phone, when the trip has the driver's number.
  const fallback =
    tripPhone && target.contactId && !target.phone.trim()
      ? tripPhone
      : undefined;
  const offerFallback = Boolean(fallback && canEditContacts && onUseTripPhone);
  // The trip phone line below replaces the "no channels" note.
  let note: string | undefined;
  if (!fallback && !reachable)
    note = tr("symptoms.call_center_no_channels", dict);
  else if (!fallback && unavailable)
    note = tr("unavailableOn", d, { channel: channelLabel(step!.channel, d) });
  const phone = formatChileanPhone(target.phone);
  const applyTripPhone = async () => {
    if (!fallback || !onUseTripPhone) return;
    setSavingTripPhone(true);
    try {
      await onUseTripPhone(target, fallback, script);
    } finally {
      setSavingTripPhone(false);
    }
  };
  const stats = calledAt
    ? {
        lastCallAt: calledAt,
        accepted: target.stats?.accepted ?? 0,
        denied: target.stats?.denied ?? 0,
      }
    : target.stats;
  return (
    <>
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
        unavailableNote={note}
        onClick={
          reachable
            ? () =>
                script
                  ? onCall({ ...target, phone }, script)
                  : onCall({ ...target, phone })
            : undefined
        }
      />
      {fallback && offerFallback && (
        <button
          type="button"
          disabled={savingTripPhone}
          onClick={() => void applyTripPhone()}
          className="flex w-full items-center gap-1.5 border-b border-gray-200 bg-white px-3 py-2 text-left text-sm font-medium text-blue-600 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-blue-400"
        >
          <HiPhone className="h-3.5 w-3.5 shrink-0" />
          {tr("symptoms.call_center_use_trip_phone", dict, {
            phone: formatChileanPhone(fallback),
          })}
        </button>
      )}
      {fallback && !offerFallback && (
        <p className="border-b border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {tr("symptoms.call_center_trip_phone", dict)}{" "}
          <a
            href={`tel:${fallback}`}
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {formatChileanPhone(fallback)}
          </a>
        </p>
      )}
      {!reachable && target.contactId && !offerFallback && (
        <Link
          href={`/${lang}/users/settings/contact-book?edit=${encodeURIComponent(target.contactId)}`}
          className="block border-b border-gray-200 bg-white px-3 py-2 text-sm font-medium text-blue-600 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-blue-400"
          aria-label={`${tr("symptoms.call_center_edit_contact", dict)}: ${target.personName}`}
        >
          {tr("symptoms.call_center_edit_contact", dict)}
        </Link>
      )}
    </>
  );
}

/**
 * What the operator reads while calling: the step's message and goal, filled
 * with the case. A field the case lacks is a named blank in the parts and
 * `[name]` in the text.
 */
export interface CallScript {
  message: string;
  goal: string;
  messageParts?: FilledPart[];
  goalParts?: FilledPart[];
}

function callScript(
  step: Step,
  ctx: ScriptContext,
  labels: FieldLabels
): CallScript | undefined {
  if (!step.script?.trim() && !step.goal?.trim()) return undefined;
  const messageParts = filledParts(step.script ?? "", ctx, labels);
  const goalParts = filledParts(step.goal ?? "", ctx, labels);
  return {
    message: partsText(messageParts),
    goal: partsText(goalParts),
    messageParts,
    goalParts,
  };
}

export type OnCall = (target: CallTarget, script?: CallScript) => void;
type OnUseTripPhone = (
  target: CallTarget,
  phone: string,
  script?: CallScript
) => Promise<void>;
type NewCallDraft = NewNumberDraft & { script?: CallScript };

function StepGroup({
  group,
  due,
  elapsed,
  stepEnd,
  loading,
  lookupFailed,
  called,
  treatmentData,
  scriptContext,
  labels,
  trip,
  canSkip,
  canEditContacts,
  dict,
  d,
  onCall,
  onSkip,
  onNewNumber,
  onUseTripPhone,
}: Readonly<{
  group: CallGroup;
  due: number;
  /** Seconds at the level; null when the case's start is unknown. */
  elapsed: number | null;
  stepEnd: number;
  loading: boolean;
  lookupFailed: boolean;
  called: ReadonlyMap<string, Date>;
  treatmentData: TreatmentsGeneralResponseItem | null;
  /** What the step's script reads: the case's context, or its trip info for a legacy case. */
  scriptContext: ScriptContext;
  labels: FieldLabels;
  /** The server's answer for the steps' conditions, with the trip's RUTs. */
  trip: TowerTripContacts | undefined;
  canSkip: boolean;
  canEditContacts: boolean;
  dict: I18nRecord;
  d: I18nRecord;
  onCall: OnCall;
  onSkip: () => void;
  onNewNumber: (draft: NewCallDraft) => void;
  onUseTripPhone: OnUseTripPhone;
}>) {
  const carrierName = treatmentData?.trip_info?.carrier;
  const tripPhone = tripPhoneE164(treatmentData?.trip_info?.driver_contact);
  const driverRut = trip?.data.driverRut;
  const preset = presetFor(group.summary, trip, carrierName);
  const script = callScript(group.step, scriptContext, labels);
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
      {isDue && script && (
        <blockquote className="border-b border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
          {script.message && (
            <>
              <span className="mb-1 block text-xs text-gray-500">
                {tr("say", d)}
              </span>
              <ScriptText
                parts={script.messageParts ?? []}
                title={tr("blankHint", d)}
              />
            </>
          )}
          {step.goal?.trim() && (
            <span className="mt-1 block text-xs text-gray-500">
              {tr("goal", d)}:{" "}
              <ScriptText
                parts={script.goalParts ?? []}
                title={tr("blankHint", d)}
              />
            </span>
          )}
        </blockquote>
      )}
      {group.targets.map((target) => (
        <TargetRow
          key={target.id}
          target={target}
          calledAt={called.get(target.id)}
          step={step}
          script={script}
          dict={dict}
          d={d}
          onCall={onCall}
          tripPhone={
            tripPhone && isTripDriver(target, driverRut) ? tripPhone : undefined
          }
          canEditContacts={canEditContacts}
          onUseTripPhone={onUseTripPhone}
        />
      ))}
      {group.targets.length === 0 && loading && (
        <output className="px-3 py-2 text-xs">{tr("lookupPending", d)}</output>
      )}
      {group.targets.length === 0 && !loading && (
        <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400">
          <p className="min-w-0 flex-1">
            {lookupFailed
              ? tr("tripLookupError", d)
              : notInBookText(group.summary, d)}
          </p>
          {preset && !lookupFailed && (
            <button
              type="button"
              onClick={() =>
                onNewNumber({ phone: "", name: "", preset, script })
              }
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
          <span>
            {elapsed === null
              ? tr("dueNoStart", d)
              : tr("dueIn", d, { time: clock(stepEnd - elapsed) })}
          </span>
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
  onCall: OnCall;
  onNewNumber: (draft: NewCallDraft) => void;
}>) {
  const [open, setOpen] = useState(!collapsible);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(OTHERS_PAGE);
  const shown = targets.filter((t) => matchesTarget(t, search));
  const visible = shown.slice(0, limit);
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
          <div className="sticky top-0 z-10 flex shrink-0 items-stretch gap-1 border-b border-gray-200 bg-white p-1.5 dark:border-gray-700 dark:bg-gray-800">
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
                onChange={(e) => {
                  setSearch(e.target.value);
                  setLimit(OTHERS_PAGE);
                }}
              />
            </div>
          </div>
          {visible.map((target) => (
            <TargetRow
              key={target.id}
              target={target}
              calledAt={called.get(target.id)}
              dict={dict}
              d={d}
              onCall={onCall}
            />
          ))}
          {shown.length > visible.length && (
            <button
              type="button"
              onClick={() => setLimit(limit + OTHERS_PAGE)}
              className="shrink-0 border-b border-gray-200 bg-white px-3 py-2 text-left text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-blue-500/10"
            >
              {tr("showMore", d, { n: String(shown.length - visible.length) })}
            </button>
          )}
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

/** The country's emergency numbers, pinned under the scrolling body; each one is called like a contact. */
function EmergencyNumbers({
  dict,
  onCall,
}: Readonly<{ dict: I18nRecord; onCall: OnCall }>) {
  const numbers = EMERGENCY_NUMBERS[EMERGENCY_COUNTRY] ?? [];
  if (numbers.length === 0) return null;
  return (
    <div className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {tr("symptoms.call_center_emergency", dict)}
      </h4>
      <div className="grid grid-cols-2 gap-1.5">
        {numbers.map((e) => (
          <button
            key={e.number}
            type="button"
            aria-label={tr("symptoms.call_center_emergency_call", dict, {
              name: e.name,
              number: e.number,
            })}
            onClick={() => onCall(emergencyTarget(EMERGENCY_COUNTRY, e))}
            className="flex min-w-0 cursor-pointer items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-left text-xs text-red-800 transition-colors hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-200 dark:hover:bg-red-900/40"
          >
            <HiPhone className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{e.name}</span>
            <span className="font-mono font-semibold">{e.number}</span>
          </button>
        ))}
      </div>
    </div>
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
    channels: contact?.channels ?? { phone, whatsapp: phone },
    methods: ["phone", "whatsapp"],
    stats: null,
  };
}

export default function CallCenterMenu({
  dict,
  treatmentData,
  skippedTo,
  onSkip,
  onCall,
}: Readonly<{
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  /** The step the operator skipped to, if any. */
  skippedTo: number | null;
  onSkip: (step: number) => void;
  onCall: OnCall;
}>) {
  const d = (dict.symptoms as I18nRecord)?.ladder as I18nRecord;
  const symptom = treatmentData?.symptom_info;
  const {
    data: level,
    error: levelError,
    mutate: refreshLevel,
  } = useLevelResponse(symptom?.name ?? null, symptom?.icu_code ?? null);
  const {
    targets,
    addContact,
    saveTripPhone,
    isLoading,
    error: bookError,
  } = useCallTargets();
  const { can } = useControlTowerAccess();
  const canEditContacts = can("controltower:contact.write");
  const levelFailed = Boolean(levelError && levelError.status !== 404);
  // Only engine cases (negative ids) have Control Tower treatments and a trip the server reads.
  const caseId = symptom?.id != null && symptom.id < 0 ? symptom.id : null;
  const { data: treatments } = useSymptomTreatments(caseId);
  const { data: caseContext } = useCaseContext(caseId);
  const scriptContext = useMemo(
    () => caseContext ?? contextOfTreatment(treatmentData),
    [caseContext, treatmentData]
  );
  const labels = useMemo(() => fieldLabels(dict), [dict]);
  // The inbox and this panel share the server's current-level/hold rule.
  const parsedSince = Date.parse(symptom?.sla_since ?? "");
  const since = Number.isFinite(parsedSince) ? parsedSince : null;
  const elapsed = useElapsed(since);
  const [addDraft, setAddDraft] = useState<NewCallDraft | null>(null);
  const callVersion = useRef(0);
  useEffect(
    () => () => {
      callVersion.current += 1;
    },
    []
  );
  const selectTarget: OnCall = (target, script) => {
    callVersion.current += 1;
    if (script) onCall(target, script);
    else onCall(target);
  };

  const response = level?.level.response;
  const steps = response?.operator ? (response.steps ?? NO_STEPS) : NO_STEPS;
  const conditions = useMemo(() => stepConditions(steps), [steps]);
  const {
    data: tripView,
    mutate: refreshTrip,
    isLoading: tripLoading,
    error: tripError,
  } = useTripContacts(symptom?.id, conditions);
  const matches = tripView?.matches;
  const called = useMemo(() => calledInCase(treatments), [treatments]);
  const plan = useMemo(
    () => callPlan(steps, targets, called, matches),
    [steps, targets, called, matches]
  );
  const due =
    steps.length > 0
      ? Math.max(elapsed === null ? 0 : stepAt(steps, elapsed), skippedTo ?? 0)
      : -1;
  const stepEnd = steps
    .slice(0, due + 1)
    .reduce((sum, s) => sum + (s.budgetMinutes ?? 0) * 60, 0);
  const sla = (response?.slaMinutes ?? 0) * 60;

  const handleNewNumber = async (
    { phone, name, preset, script }: NewCallDraft,
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
          selectTarget(newTarget(saved, personName, number), script);
        return;
      } catch {
        if (callVersion.current !== version) return;
        ShowNotification({
          type: "error",
          message: tr("symptoms.call_center_new_save_error", dict),
        });
      }
    }
    selectTarget(newTarget(null, personName, number), script);
  };

  // Saves the trip's phone on the driver's book contact, then calls that contact.
  const handleUseTripPhone: OnUseTripPhone = async (target, phone, script) => {
    if (!target.contactId) return;
    const version = ++callVersion.current;
    try {
      const saved = await saveTripPhone(target.contactId, phone);
      if (callVersion.current !== version) return;
      selectTarget(
        { ...saved, phone: formatChileanPhone(saved.phone) },
        script
      );
    } catch {
      if (callVersion.current !== version) return;
      ShowNotification({
        type: "error",
        message: tr("symptoms.call_center_trip_phone_error", dict),
      });
    }
  };

  return (
    <BentoGrid>
      <div
        data-testid="call-center-scroll"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
      >
        <PlainSection title={tr("symptoms.proto_section_general", dict)}>
          <GeneralInfoGrid dict={dict} treatmentData={treatmentData} />
        </PlainSection>

        <section className="flex shrink-0 flex-col overflow-clip rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="truncate text-sm font-semibold leading-none text-gray-900 dark:text-white">
              {tr("symptoms.proto_section_who", dict)}
            </h3>
            {steps.length > 0 && level && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                v{level.version}
              </span>
            )}
            {steps.length > 0 && sla > 0 && elapsed !== null && (
              <span
                className={`ml-auto font-mono text-xs ${elapsed > sla ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}`}
              >
                SLA {clock(sla - elapsed)}
              </span>
            )}
            {steps.length > 0 && sla > 0 && since === null && (
              <span className="ml-auto truncate text-xs text-gray-500 dark:text-gray-400">
                {tr("slaNoStart", d, { min: String(sla / 60) })}
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
              onSubmit={(draft, action) =>
                void handleNewNumber(
                  { ...draft, script: addDraft.script },
                  action
                )
              }
              onCancel={() => setAddDraft(null)}
            />
          )}
          {levelFailed && (
            <div role="alert" className="p-3 text-sm text-red-600">
              <p>{tr("levelLookupError", d)}</p>
              <button
                type="button"
                onClick={() => void refreshLevel()}
                className="underline"
              >
                {tr("retryLookup", d)}
              </button>
            </div>
          )}
          <div
            className={`flex-col ${addDraft || levelFailed ? "hidden" : "flex"}`}
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
                loading={isLoading || Boolean(tripLoading)}
                lookupFailed={Boolean(bookError || tripError)}
                called={called}
                treatmentData={treatmentData}
                scriptContext={scriptContext}
                labels={labels}
                canSkip={due < steps.length - 1}
                canEditContacts={canEditContacts}
                onUseTripPhone={handleUseTripPhone}
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
      </div>
      <EmergencyNumbers dict={dict} onCall={selectTarget} />
    </BentoGrid>
  );
}

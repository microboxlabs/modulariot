"use client";

/**
 * A symptom's treatments, from the Control Tower API: one collapsible
 * "Tratamiento N" card per episode, with its calls (who, channel, outcome,
 * when) and its ignore/invalidate decisions. Shared by the timeline and the
 * symptom card shown under the map during a call. Renders nothing while the
 * symptom has no treatments.
 */

import { useEffect, useState } from "react";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  size,
  useDismiss,
  useFloating,
  useHover,
  useInteractions,
} from "@floating-ui/react";
import {
  HiChevronDown,
  HiChevronRight,
  HiOutlineClipboardCheck,
} from "react-icons/hi";
import { FormattedDate } from "@/features/common/components/formatted-date";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  type TowerAction,
  type TowerTreatment,
  useSymptomTreatments,
} from "@/features/symptoms/control-tower/control-tower-api";
import CallLogRow from "./prototype/call-center/call-log-row";
import CopyButton from "./prototype/call-center/copy-button";
import { callLogEntryOf } from "./prototype/call-center/call-log";

/** i18n key (under `symptoms.`) for each non-call action. */
const ACTION_LABEL_KEYS: Record<Exclude<TowerAction["kind"], "CALL">, string> = {
  IGNORE: "ignore_condition",
  INVALIDATE: "invalidate_symptom",
  NOTE: "treatment_note",
};

/** Same hover tooltip for every row: what was said, and what came back. */
function DetailTooltip({
  message,
  response,
  t,
  children,
}: Readonly<{
  message: string;
  response?: string;
  t: (k: string) => string;
  /** Render prop: the row's own "highlighted" look follows the tooltip's
   *  `open` state rather than CSS `:hover`, which doesn't know about the
   *  scroll-close behavior below. */
  children: (open: boolean) => React.ReactNode;
}>) {
  return (
    <InstantTooltip
      content={
        <div className="text-xs">
          {message && (
            <p className="font-medium">
              {t("message")}: <span className="font-light">{message}</span>
            </p>
          )}
          {response && (
            <>
              {message && <hr className="my-2 border-gray-700" />}
              <p className="font-medium">
                {t("response")}: <span className="font-light">{response}</span>
              </p>
            </>
          )}
        </div>
      }
    >
      {children}
    </InstantTooltip>
  );
}

/**
 * Built directly on `@floating-ui/react` instead of Flowbite's `Tooltip`,
 * whose safe-polygon hover kept the previous row's tooltip open while the
 * pointer moved to the next row. Plain `useHover` closes the instant the
 * pointer leaves the trigger.
 */
function InstantTooltip({
  content,
  children,
}: Readonly<{
  content: React.ReactNode;
  children: (open: boolean) => React.ReactNode;
}>) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "top",
    middleware: [
      offset(0),
      flip(),
      shift({ padding: 8 }),
      size({
        apply({ rects, elements }) {
          elements.floating.style.width = `${rects.reference.width}px`;
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });
  const hover = useHover(context, { move: false });
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, dismiss]);

  // Scrolling under a stationary cursor doesn't fire mouseleave, so close on
  // any scroll (capture phase, since `scroll` doesn't bubble).
  useEffect(() => {
    if (!open) return;
    const handleScroll = () => setOpen(false);
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [open]);

  return (
    <>
      <div ref={refs.setReference} {...getReferenceProps()} className="w-full">
        {children(open)}
      </div>
      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-9999 rounded-t-lg rounded-b-none border border-b-0 border-white bg-gray-900 px-3 py-2 text-sm text-white shadow-sm"
          >
            {content}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

/** An ignore, invalidate or note action: its reason and note. */
function DecisionRow({
  dict,
  action,
  roundedBottom,
}: Readonly<{
  dict: I18nRecord;
  action: TowerAction;
  roundedBottom: boolean;
}>) {
  const t = (k: string) => (dict.symptoms as I18nRecord)[k] as string;
  const labelKey = action.kind === "CALL" ? "treatment_note" : ACTION_LABEL_KEYS[action.kind];
  const label = t(labelKey) ?? action.kind;
  const reason = action.outcomeLabel ?? "";
  const note = action.note ?? "";
  const at = new Date(action.performedAt);

  const getCopyText = () =>
    [label, formatDateString(at, "datetime"), reason, note].filter(Boolean).join("\n");

  return (
    <DetailTooltip t={t} message={reason} response={note}>
      {(open) => (
        <div
          className={`flex w-full items-center gap-2 border-x border-b bg-gray-50 px-2 py-1.5 transition-colors dark:bg-gray-800/50 ${
            open ? "border-white" : "border-transparent"
          } ${roundedBottom ? "rounded-b-md" : ""}`}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            <HiOutlineClipboardCheck className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">
              {label}
            </p>
            {(reason || note) && (
              <p className="wrap-break-word text-[10px] text-gray-500 dark:text-gray-400">
                {[reason, note].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <span className="shrink-0 text-[10px] text-gray-500 dark:text-gray-400">
            <FormattedDate date={at} format="time" />
          </span>
          <CopyButton dict={dict} getText={getCopyText} />
        </div>
      )}
    </DetailTooltip>
  );
}

function ActionRow({
  dict,
  action,
  roundedBottom,
}: Readonly<{
  dict: I18nRecord;
  action: TowerAction;
  roundedBottom: boolean;
}>) {
  const t = (k: string) => (dict.symptoms as I18nRecord)[k] as string;
  if (action.kind !== "CALL") {
    return <DecisionRow dict={dict} action={action} roundedBottom={roundedBottom} />;
  }
  const entry = callLogEntryOf(action);
  return (
    <DetailTooltip t={t} message={entry.message} response={entry.response}>
      {(open) => (
        <CallLogRow dict={dict} entry={entry} roundedBottom={roundedBottom} highlighted={open} />
      )}
    </DetailTooltip>
  );
}

function EpisodeCard({
  dict,
  treatment,
  number,
  expanded,
  onToggle,
}: Readonly<{
  dict: I18nRecord;
  treatment: TowerTreatment;
  number: number;
  expanded: boolean;
  onToggle: () => void;
}>) {
  const t = (k: string) => (dict.symptoms as I18nRecord)[k] as string;
  const isOpen = treatment.status === "OPEN";
  return (
    <div className="flex w-full flex-col overflow-hidden rounded-md border border-gray-200 bg-white text-xs font-light shadow-sm dark:border-gray-700 dark:bg-gray-800/40">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex cursor-pointer items-center justify-between gap-2 border-b border-gray-100 px-2 py-1.5 text-left transition-colors hover:bg-gray-100 dark:border-gray-700/60 dark:bg-gray-800 dark:hover:bg-gray-700"
      >
        <span className="flex min-w-0 items-center gap-1">
          {expanded ? (
            <HiChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          ) : (
            <HiChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          )}
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {t("treatment_group_label")} {number}
          </span>
          {isOpen && (
            <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-[10px] font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
              {t("treatment_in_progress")}
            </span>
          )}
        </span>
        <span className="text-[10px] text-gray-500 dark:text-gray-400">
          <FormattedDate date={new Date(treatment.openedAt)} format="time" />
        </span>
      </button>
      {/* Grid-rows 0fr/1fr: animates between zero and the content's natural height. */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700">
            {treatment.actions.map((action, i) => (
              <ActionRow
                key={action.id}
                dict={dict}
                action={action}
                roundedBottom={i === treatment.actions.length - 1}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Episodes worth showing: anything with a recorded action. */
function visibleEpisodes(treatments: TowerTreatment[] | undefined): TowerTreatment[] {
  return (treatments ?? []).filter((t) => t.actions.length > 0);
}

export default function TreatmentsTimelineBox({
  dict,
  symptomId,
}: Readonly<{
  dict: I18nRecord;
  symptomId: number | null | undefined;
}>) {
  const { data, error } = useSymptomTreatments(symptomId);
  // Undefined = default (every episode expanded); once the operator
  // collapses one, that episode's own choice takes over.
  const [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({});
  const t = (k: string) => (dict.symptoms as I18nRecord)[k] as string;

  if (error) {
    return <p className="text-[10px] text-red-500">{t("treatments_load_error")}</p>;
  }
  const episodes = visibleEpisodes(data);
  if (episodes.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {episodes.map((treatment, i) => {
        const expanded = expandedOverrides[treatment.id] ?? true;
        return (
          <EpisodeCard
            key={treatment.id}
            dict={dict}
            treatment={treatment}
            number={i + 1}
            expanded={expanded}
            onToggle={() =>
              setExpandedOverrides((prev) => ({ ...prev, [treatment.id]: !expanded }))
            }
          />
        );
      })}
    </div>
  );
}

/** True once the symptom has at least one episode with a recorded action. */
export function useHasTreatments(symptomId: number | null | undefined): boolean {
  const { data } = useSymptomTreatments(symptomId);
  return visibleEpisodes(data).length > 0;
}

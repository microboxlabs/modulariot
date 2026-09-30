"use client";

/**
 * Shared treatments list — same one built for the floating context card
 * shown at the bottom of the map while a call is open (`prototype/call-
 * center/symptom-context-card.tsx`), reused here so the timeline's own
 * per-occurrence treatments list looks and behaves identically: episodes
 * grouped (see `group-treatments.ts`), collapsible, with the rich mock
 * call-log breakdown for "llamar al conductor" treatments. Just the inner
 * "Tratamiento N" cards — no outer titled card wrapping them.
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
import { TreatmentTimelineElement } from "@/features/symptoms/types/timeline";
import CallLogRow from "./prototype/call-center/call-log-row";
import CopyButton from "./prototype/call-center/copy-button";
import { mockCallLogForTreatment } from "./prototype/call-center/mock-call-log";
import { groupTreatments } from "./prototype/call-center/group-treatments";

/** Shared by every procedure kind — same hover tooltip either way, just
 *  fed a different message/response: the real treatment record's for
 *  non-call rows, a mocked one per individual call entry for call rows (see
 *  `mock-call-log.ts`) so several calls under one treatment don't all show
 *  the same detail on hover. */
function DetailTooltip({
  message,
  response,
  t,
  children,
}: {
  message: string;
  response?: string;
  t: (k: string) => string;
  /** Render prop, not a plain node: the row's own "highlighted" look is
   *  driven by this same `open` state rather than CSS `:hover`, since
   *  `:hover` doesn't know about the scroll-close behavior below — without
   *  this the border could stay lit after a scroll closes the tooltip. */
  children: (open: boolean) => React.ReactNode;
}) {
  return (
    <InstantTooltip
      content={
        <div className="text-xs">
          <p className="font-medium">
            {t("message")}: <span className="font-light">{message}</span>
          </p>
          {response && (
            <>
              <hr className="my-2 border-gray-200 dark:border-gray-700" />
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

/** Convention used across the call-center prototype for "this treatment is a
 *  call" — matches the type set by `prototype-inline-form.tsx`'s preaction. */
const CALL_TREATMENT_TYPE = "LLAMAR AL CONDUCTOR";

/**
 * Built directly on `@floating-ui/react` instead of Flowbite's `Tooltip`:
 * Flowbite hardcodes `useHover(context, { handleClose: safePolygon() })`,
 * which keeps a tooltip open while the pointer travels toward it — with
 * these rows sitting flush against each other, that meant moving from one
 * row up into what looked like the next row's space kept the *previous*
 * tooltip open instead of handing off immediately. Plain `useHover` (no
 * `handleClose`) closes the instant the pointer leaves the trigger, no
 * grace path, and with no CSS transition either the swap is instant.
 */
function InstantTooltip({
  content,
  children,
}: {
  content: React.ReactNode;
  children: (open: boolean) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "top",
    middleware: [
      offset(0),
      flip(),
      shift({ padding: 8 }),
      // Matches the floating element's width to the trigger's own rect
      // directly, every time position is (re)computed — no separate
      // ResizeObserver/state to go stale or race with layout (that
      // approach could "lock in" a too-narrow width if it fired before
      // the trigger's real width had settled).
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

  // Scrolling doesn't reliably fire mouseenter/mouseleave on whatever
  // becomes newly hovered under a *stationary* cursor, so without this the
  // tooltip stays glued to a row that has already scrolled away instead of
  // handing off to whatever the cursor is actually over now. Closing on any
  // scroll (capture phase, since `scroll` doesn't bubble) is the simplest
  // fix — the next real pointer movement re-triggers hover correctly for
  // whatever's actually underneath.
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
            className="z-9999 rounded-t-lg rounded-b-none border border-b-0 border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm dark:border-white dark:bg-gray-900 dark:text-white"
          >
            {content}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

/**
 * Same card language as the call-log rows below (icon + name/detail stack)
 * instead of a bare underlined line — the deeper message/response pair still
 * lives in the hover tooltip, sized to match this trigger card exactly
 * rather than shrinking to its own content.
 */
function GenericTreatmentRow({
  dict,
  treatment,
  roundedBottom = false,
  time,
}: {
  dict: I18nRecord;
  treatment: TreatmentTimelineElement;
  /** See `CallLogRow`'s prop of the same name. */
  roundedBottom?: boolean;
  /** The treatment record itself carries no timestamp — this is the
   *  episode's own group time (same one shown in the "Tratamiento N"
   *  header above), the closest thing to "when" this row has. */
  time?: Date | null;
}) {
  const t = (k: string) => (dict.symptoms as I18nRecord)[k] as string;
  const label = t(treatment.treatment_type.toUpperCase()) ?? treatment.treatment_type;

  const getCopyText = () => {
    const lines = [label];
    if (time) lines.push(formatDateString(time, "datetime"));
    if (treatment.description.message) {
      lines.push(`${t("message")}: ${treatment.description.message}`);
    }
    if (treatment.description.driver_response) {
      lines.push(`${t("response")}: ${treatment.description.driver_response}`);
    }
    return lines.join("\n");
  };

  return (
    <DetailTooltip
      t={t}
      message={treatment.description.message}
      response={treatment.description.driver_response}
    >
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
            {treatment.description.message && (
              <p className="wrap-break-word text-[10px] text-gray-500 dark:text-gray-400">
                {treatment.description.message}
              </p>
            )}
          </div>
          <CopyButton dict={dict} getText={getCopyText} />
        </div>
      )}
    </DetailTooltip>
  );
}

export default function TreatmentsTimelineBox({
  dict,
  treatments,
  seed,
  start,
  end,
}: {
  dict: I18nRecord;
  treatments: TreatmentTimelineElement[];
  /** Deterministic seed for the mock call-log/grouping — a real treatment
   *  record has no id, so callers pass something stable like the symptom id. */
  seed: string;
  start?: string | null;
  end?: string | null;
}) {
  // Undefined = "use the default" (every episode starts expanded); once the
  // operator collapses one, that group's own choice takes over from then on.
  const [expandedOverrides, setExpandedOverrides] = useState<
    Record<string, boolean>
  >({});
  const t = (k: string) => (dict.symptoms as I18nRecord)[k] as string;

  const toggleGroup = (id: string, currentlyExpanded: boolean) =>
    setExpandedOverrides((prev) => ({ ...prev, [id]: !currentlyExpanded }));

  // One line (non-call) or the rich mock call-log list (call) for a single
  // procedure inside a treatment group — see `group-treatments.ts`. `isLast`
  // is true only for the very last row that will render at the bottom of
  // the whole card, so its corners can match the card's own `rounded-md`
  // (the card clips flush content to that shape via `overflow-hidden` —
  // without a matching radius here, the hover ring gets visibly cut off at
  // an angle instead of following the curve).
  const renderProcedure = (
    treatment: TreatmentTimelineElement,
    index: number,
    isLast: boolean,
    groupTime?: Date | null
  ) => {
    const isCallTreatment =
      treatment.treatment_type.toUpperCase() === CALL_TREATMENT_TYPE;

    if (!isCallTreatment) {
      return (
        <GenericTreatmentRow
          key={index}
          dict={dict}
          treatment={treatment}
          roundedBottom={isLast}
          time={groupTime}
        />
      );
    }

    // Frontend-only mock breakdown — see `mock-call-log.ts`. There's no
    // real per-call data on a treatment record, so this synthesizes a
    // plausible message/response *per mock call*, not just the one real
    // treatment record's — several calls under one treatment shouldn't all
    // show the same detail on hover.
    const entrySeed = `${seed}-${index}`;
    const entries = mockCallLogForTreatment(entrySeed);

    return (
      <div
        key={index}
        className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700"
      >
        {entries.map((entry, entryIndex) => (
          <DetailTooltip
            key={entry.id}
            t={t}
            message={entry.message}
            response={entry.response}
          >
            {(open) => (
              <CallLogRow
                dict={dict}
                entry={entry}
                roundedBottom={isLast && entryIndex === entries.length - 1}
                highlighted={open}
              />
            )}
          </DetailTooltip>
        ))}
      </div>
    );
  };

  if (treatments.length === 0) return null;

  const naturalGroups = groupTreatments(treatments, seed, start, end).map(
    (group, i) => ({ ...group, number: i + 1 })
  );

  return (
    <div className="flex flex-col gap-1.5">
      {naturalGroups.map((group) => {
        const expanded = expandedOverrides[group.id] ?? true;
        return (
          <div
            key={group.id}
            className="flex w-full flex-col overflow-hidden rounded-md border border-gray-200 bg-white text-xs font-light shadow-sm dark:border-gray-700 dark:bg-gray-800/40"
          >
            {/* No padding on this card itself, just the rounded corners —
                each item inside (the header here, the procedures below)
                carries its own padding instead, and `overflow-hidden` clips
                them to the rounded shape since they sit flush against the
                edges. Clicking the header expands/collapses this episode's
                procedures. */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleGroup(group.id, expanded)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleGroup(group.id, expanded);
                }
              }}
              className="flex cursor-pointer items-center justify-between gap-2 border-b border-gray-100 px-2 py-1.5 transition-colors hover:bg-gray-100 dark:border-gray-700/60 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <span className="flex min-w-0 items-center gap-1">
                {expanded ? (
                  <HiChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                ) : (
                  <HiChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                )}
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {t("treatment_group_label")} {group.number}
                </p>
              </span>
              {group.time && (
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  <FormattedDate date={group.time} format="time" />
                </span>
              )}
            </div>
            {/* Grid-rows 0fr/1fr trick (see `call-dialing-step.tsx`'s timer):
                animates smoothly between zero and the content's natural
                height with no fixed height to guess at, and — unlike a
                plain conditional unmount or a max-height transition — truly
                collapses to zero, no leftover space at rest. */}
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700">
                  {group.items.map(({ treatment, index }, itemIndex) =>
                    renderProcedure(
                      treatment,
                      index,
                      itemIndex === group.items.length - 1,
                      group.time
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

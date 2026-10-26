"use client";

import { Modal, ModalBody, ModalHeader } from "flowbite-react";
import { FaCheck } from "react-icons/fa";
import { HiClock, HiX } from "react-icons/hi";
import CustomCard from "@/features/common/components/custom-card/custom-card";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { useMyAccess } from "@/features/settings-admin/team/team-api";
import type { Milestone } from "../monitors/monitors-api";
import { useTripsPermission } from "../monitors/monitors-api";
import {
  MILESTONE_CONFIRM,
  type TripMilestone,
} from "../milestones/milestones-api";
import { shortTime } from "../board/trip-card";
import type { TripSheet } from "./sheet-api";
import { MilestoneRow } from "./milestone-row";

/**
 * The milestone a person acts on next: one waiting for confirmation, else the
 * first not confirmed after the last confirmed one.
 */
export function nextMilestone(milestones: TripMilestone[]) {
  const pending = milestones.find((m) => m.status === "pending");
  if (pending) return pending;
  const last = milestones.findLastIndex((m) => m.status === "confirmed");
  return (
    milestones.slice(last + 1).find((m) => m.status !== "confirmed") ?? null
  );
}

/** The plan time shown for each milestone. */
export function plannedAt(sheet: TripSheet, m: Milestone) {
  const planned: Partial<Record<Milestone, string | null>> = {
    presentation: sheet.card.plannedStart,
    departure: sheet.card.plannedStart,
    arrival: sheet.card.plannedArrival,
  };
  return planned[m] ?? null;
}

/** The permission, and membership of the milestone's team when it has one. */
export function useCanConfirm(sheet: TripSheet) {
  const permission = useTripsPermission(MILESTONE_CONFIRM);
  const { access } = useMyAccess();
  const mine = new Set((access?.teams ?? []).map((t) => t.id));
  return (m: Milestone) => {
    const team = sheet.confirmers[m];
    return {
      canConfirm: permission && (!team || mine.has(team)),
      teamOnly: Boolean(team) && !mine.has(team ?? ""),
    };
  };
}

function StatusIcon({ status }: Readonly<{ status: TripMilestone["status"] }>) {
  const outer =
    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full";
  switch (status) {
    case "confirmed":
      return (
        <span className={`${outer} bg-gray-400 p-1 text-white`}>
          <FaCheck className="h-4 w-4" />
        </span>
      );
    case "pending":
      return (
        <span className={`${outer} bg-yellow-400 text-white`}>
          <HiClock className="h-4 w-4" />
        </span>
      );
    case "rejected":
      return (
        <span className={`${outer} bg-red-500 text-white`}>
          <HiX className="h-4 w-4" />
        </span>
      );
    default:
      return (
        <span
          className={`${outer} border-2 border-gray-400 bg-white dark:bg-gray-800`}
        />
      );
  }
}

/** The trip's milestones as a checklist; each one opens its detail. */
export function MilestoneChecklist({
  sheet,
  d,
  lang,
  onOpen,
}: Readonly<{
  sheet: TripSheet;
  d: I18nRecord;
  lang: string;
  onOpen: (m: Milestone) => void;
}>) {
  return (
    <CustomCard
      title={tr("sheet.milestones", d)}
      subtitle={tr("sheet.dispatch", d)}
    >
      <ul className="flex flex-col gap-1">
        {sheet.milestones.map((m) => {
          const at =
            m.status === "confirmed"
              ? m.confirmedAt
              : (m.proposedAt ?? plannedAt(sheet, m.milestone));
          return (
            <li key={m.milestone}>
              <button
                type="button"
                onClick={() => onOpen(m.milestone)}
                title={trDynamic(`milestoneStatus.${m.status}`, d)}
                className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <StatusIcon status={m.status} />
                <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">
                  {trDynamic(`milestone.${m.milestone}`, d)}
                </span>
                {at && (
                  <span className="text-xs text-gray-400">
                    {shortTime(at, lang)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </CustomCard>
  );
}

export function MilestoneModal({
  sheet,
  milestone,
  d,
  lang,
  onClose,
}: Readonly<{
  sheet: TripSheet;
  milestone: Milestone | null;
  d: I18nRecord;
  lang: string;
  onClose: () => void;
}>) {
  const can = useCanConfirm(sheet);
  const m = sheet.milestones.find((x) => x.milestone === milestone);
  return (
    <Modal show={Boolean(m)} onClose={onClose} size="lg" dismissible>
      <ModalHeader>
        {m
          ? trDynamic(`milestone.${m.milestone}`, d)
          : tr("sheet.milestones", d)}
      </ModalHeader>
      <ModalBody>
        {m && (
          <MilestoneRow
            m={m}
            planned={plannedAt(sheet, m.milestone)}
            {...can(m.milestone)}
            d={d}
            lang={lang}
          />
        )}
      </ModalBody>
    </Modal>
  );
}

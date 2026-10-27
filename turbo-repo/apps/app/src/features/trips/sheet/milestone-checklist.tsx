"use client";

import { Modal, ModalBody, ModalHeader } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { useMyAccess } from "@/features/settings-admin/team/team-api";
import type { Milestone } from "../monitors/monitors-api";
import { useTripsPermission } from "../monitors/monitors-api";
import {
  MILESTONE_CONFIRM,
  type TripMilestone,
} from "../milestones/milestones-api";
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

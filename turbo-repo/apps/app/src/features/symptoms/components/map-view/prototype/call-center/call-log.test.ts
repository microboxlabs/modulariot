import { describe, expect, it } from "vitest";
import type { TowerAction } from "@/features/symptoms/control-tower/control-tower-api";
import { callLogEntryOf, formatCallLogDuration } from "./call-log";
import { DRIVER_TARGET_ID, targetIdOfAction } from "./call-targets";

const action = (patch: Partial<TowerAction>): TowerAction => ({
  id: "a1",
  treatmentId: "t1",
  seq: 1,
  kind: "CALL",
  contactId: null,
  contactName: "Camila",
  contactRole: "Jefe de operaciones",
  contactPhone: null,
  method: "WHATSAPP",
  outcomeKey: "result_commits",
  outcomeLabel: "Contesta — se compromete a corregir",
  answered: true,
  durationSeconds: 61,
  message: "Se informó la condición.",
  note: "Se detiene en la próxima estación",
  tags: [],
  details: {},
  performedBy: "ops@example.com",
  performedAt: "2026-09-22T12:00:00Z",
  ...patch,
});

describe("callLogEntryOf", () => {
  it("maps a recorded call to the timeline row", () => {
    const entry = callLogEntryOf(action({}));
    expect(entry).toMatchObject({
      calledName: "Camila",
      method: "whatsapp",
      outcome: "answered",
      durationSeconds: 61,
      message: "Se informó la condición.",
      response: "Contesta — se compromete a corregir · Se detiene en la próxima estación",
    });
    expect(entry.at.toISOString()).toBe("2026-09-22T12:00:00.000Z");
  });

  it("treats an unanswered call as missed and falls back to the duration when answered is unknown", () => {
    expect(callLogEntryOf(action({ answered: false })).outcome).toBe("missed");
    expect(callLogEntryOf(action({ answered: null, durationSeconds: 0 })).outcome).toBe("missed");
    expect(callLogEntryOf(action({ answered: null, durationSeconds: 5, method: null })).method).toBe("phone");
  });
});

describe("targetIdOfAction", () => {
  it("links a call to its contact row, the driver by role, and ignores decisions", () => {
    expect(targetIdOfAction(action({ contactId: "c1" }))).toBe("c1");
    expect(targetIdOfAction(action({ contactRole: "Conductor" }))).toBe(DRIVER_TARGET_ID);
    expect(targetIdOfAction(action({}))).toBeNull();
    expect(targetIdOfAction(action({ kind: "IGNORE", contactId: "c1" }))).toBeNull();
  });
});

it("formats durations as mm:ss", () => {
  expect(formatCallLogDuration(61)).toBe("01:01");
});

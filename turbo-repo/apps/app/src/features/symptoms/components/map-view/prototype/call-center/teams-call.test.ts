import { describe, expect, it, vi } from "vitest";
import {
  openTeamsCall,
  teamsCallLinks,
  type TeamsWindow,
} from "./channel-link";
import { pendingTeamsCall, telephonyDetails } from "./telnyx-call";
import { callLogEntryOf } from "./call-log";
import { scheduleTeamsReconcile } from "@/features/symptoms/control-tower/telephony-api";
import type { TowerAction } from "@/features/symptoms/control-tower/control-tower-api";

function fakeWindow() {
  let blur: (() => void) | null = null;
  let timeout: (() => void) | null = null;
  const win: TeamsWindow = {
    location: { href: "" },
    open: vi.fn(),
    addEventListener: (_t, cb) => {
      blur = cb;
    },
    removeEventListener: () => {
      blur = null;
    },
    setTimeout: (cb) => {
      timeout = cb;
    },
  };
  return {
    win,
    blur: () => blur?.(),
    elapse: () => timeout?.(),
  };
}

describe("Teams calls", () => {
  it("builds the app link and the web link for a number", () => {
    expect(teamsCallLinks("+56 9 0000 0000")).toEqual({
      app: "msteams:/l/call/0/0?users=4:+56900000000",
      web: "https://teams.microsoft.com/l/call/0/0?users=4:+56900000000",
    });
    expect(teamsCallLinks("123")).toBeNull();
  });

  it("falls back to the web when no app takes the link", () => {
    const { win, elapse } = fakeWindow();
    const links = teamsCallLinks("+56900000000")!;
    openTeamsCall(links, win);
    expect(win.location.href).toBe(links.app);
    elapse();
    expect(win.open).toHaveBeenCalledWith(
      links.web,
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("does not open the web when the app took the focus", () => {
    const { win, blur, elapse } = fakeWindow();
    openTeamsCall(teamsCallLinks("+56900000000")!, win);
    blur();
    elapse();
    expect(win.open).not.toHaveBeenCalled();
  });

  it("a Teams call is saved as pending with its window", () => {
    const start = Date.parse("2026-11-04T10:00:00Z");
    const result = pendingTeamsCall("+56911111111", start, start + 61_400);
    expect(result.durationSeconds).toBe(61);
    expect(telephonyDetails(result)).toMatchObject({
      provider: "TEAMS_PHONE",
      status: "PENDING",
      calleeNumber: "+56911111111",
      startedAt: "2026-11-04T10:00:00.000Z",
      endedAt: "2026-11-04T10:01:01.400Z",
    });
  });

  it("the call log marks a pending record", () => {
    const action = {
      id: "a1",
      method: "PHONE",
      contactName: "Luis",
      performedAt: "2026-11-04T10:01:00Z",
      durationSeconds: 61,
      answered: null,
      details: { telephony: { status: "PENDING" } },
    } as unknown as TowerAction;
    expect(callLogEntryOf(action).pending).toBe(true);
    expect(
      callLogEntryOf({ ...action, details: {} } as TowerAction).pending
    ).toBe(false);
  });

  it("preserves retries for each save while earlier retries are still scheduled", async () => {
    const run = vi.fn().mockResolvedValue({});
    const timers: [() => void, number][] = [];
    const timer = (cb: () => void, ms: number) => timers.push([cb, ms]);
    scheduleTeamsReconcile(run, [120_000, 600_000], timer);
    scheduleTeamsReconcile(run, [120_000, 600_000], timer);
    expect(timers.map(([, ms]) => ms)).toEqual([
      120_000, 600_000, 120_000, 600_000,
    ]);
    timers.forEach(([cb]) => cb());
    expect(run).toHaveBeenCalledTimes(4);
    scheduleTeamsReconcile(run, [1], timer);
    expect(timers).toHaveLength(5);
  });
});

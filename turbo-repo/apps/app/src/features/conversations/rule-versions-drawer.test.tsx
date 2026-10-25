import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { RuleSpec, RuleVersion } from "./conversations-types";
import RuleVersionsDrawer, { versionHistory } from "./rule-versions-drawer";

const d = es.pages.userSettings.communications;

const spec = (template: string): RuleSpec => ({
  trigger: { event: "trip.alert", when: null },
  groups: [{ id: "rule", entries: [{ role: "driver" }] }],
  steps: [
    {
      after: 0,
      channel: "email",
      template,
      to: ["rule"],
      waitForReply: 0,
      onReply: "stop",
    },
  ],
});

const version = (v: string, at: string, template: string): RuleVersion => ({
  id: v,
  version: v,
  bump: "MINOR",
  status: "PUBLISHED",
  spec: spec(template),
  reason: `razón ${v}`,
  createdAt: at,
  createdBy: "owner@example.com",
});

const V1 = version("0.1.0", "2026-10-24T10:00:00Z", "a");
const V2 = version("0.2.0", "2026-10-25T10:00:00Z", "b");

describe("versionHistory", () => {
  it("lists the newest first, each with its changes from the one before", () => {
    const history = versionHistory([V1, V2], d);
    expect(history.map((h) => h.version.version)).toEqual(["0.2.0", "0.1.0"]);
    expect(history[0].changes.length).toBeGreaterThan(0);
    expect(history[1].changes.map((c) => c.key)).toEqual(["first"]);
  });
});

describe("RuleVersionsDrawer", () => {
  it("marks the version in force and copies an older one into the draft", () => {
    const onRestore = vi.fn();
    render(
      <RuleVersionsDrawer
        show
        versions={[V1, V2]}
        current="0.2.0"
        canWrite
        d={d}
        onClose={vi.fn()}
        onRestore={onRestore}
      />
    );
    expect(screen.getByText("En vigor")).toBeTruthy();
    expect(screen.getByText("razón 0.1.0")).toBeTruthy();
    const back = screen.getAllByRole("button", {
      name: "Volver a esta versión",
    });
    expect(back).toHaveLength(1);
    fireEvent.click(back[0]);
    expect(onRestore.mock.lastCall?.[0].steps[0].template).toBe("a");
  });
});

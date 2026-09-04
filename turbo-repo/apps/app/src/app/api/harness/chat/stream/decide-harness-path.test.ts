/**
 * Regression test for the chat's demo-trigger ordering: `demoCreateStory`
 * must only ever fire as a stand-in for the real harness, never ahead of
 * `isModulithConfigured()` — otherwise, with ENABLE_STORYTELLING on, any
 * real (configured-harness) turn that merely mentions "story"/"stories"
 * gets hijacked into a fake create_story card instead of reaching the
 * actual harness. See decideHarnessPath in route.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrFn } from "@/features/i18n/i18n.service.types";

const isModulithConfiguredMock = vi.fn();

vi.mock("@/lib/modulith-host", () => ({
  modulithHost: () => "https://modulith.example",
  isModulithConfigured: () => isModulithConfiguredMock(),
}));

// route.ts's other top-level imports pull in real backends (Alfresco,
// the miot-harness client) that can't resolve/run in this unit test — same
// collaborators the sibling search/stream/route.test.ts stubs out.
vi.mock("../../../utils/alfresco-crud-client", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("../../../utils/tenant-scope", () => ({
  resolveTenantScope: vi.fn(),
}));

vi.mock("@microboxlabs/miot-harness-client", () => ({
  createMiotHarnessClient: vi.fn(),
  TERMINAL_EVENT_TYPES: new Set(["run.completed", "run.failed"]),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const tr: TrFn = (path) => path;

function userMessage(content: string) {
  return [{ id: "m1", role: "user" as const, content }];
}

describe("decideHarnessPath", () => {
  const originalFlag = process.env.ENABLE_STORYTELLING;

  beforeEach(() => {
    vi.resetModules();
    isModulithConfiguredMock.mockReset();
  });

  afterEach(() => {
    process.env.ENABLE_STORYTELLING = originalFlag;
  });

  it("does not intercept a real turn that mentions 'story' once the harness is configured", async () => {
    process.env.ENABLE_STORYTELLING = "true";
    isModulithConfiguredMock.mockReturnValue(true);
    const { decideHarnessPath } = await import("./route");

    const send = vi.fn();
    const decision = decideHarnessPath(
      send,
      userMessage("Can you tell me the story behind this alert?"),
      "run-1",
      "thread-1",
      tr,
    );

    expect(decision).toEqual({
      handled: false,
      message: "Can you tell me the story behind this alert?",
    });
    // Nothing should have been synthesized locally — this turn goes to the
    // real harness, driven by the caller once decideHarnessPath returns.
    expect(send).not.toHaveBeenCalledWith(
      expect.objectContaining({ toolCallName: "create_story" }),
    );
  });

  it("still serves the demo create_story trigger when the harness is unconfigured", async () => {
    process.env.ENABLE_STORYTELLING = "true";
    isModulithConfiguredMock.mockReturnValue(false);
    const { decideHarnessPath } = await import("./route");

    const send = vi.fn();
    const decision = decideHarnessPath(
      send,
      userMessage("create a story about the fleet"),
      "run-1",
      "thread-1",
      tr,
    );

    expect(decision).toEqual({ handled: true });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "TOOL_CALL_START", toolCallName: "create_story" }),
    );
  });

  it("never triggers create_story when the storytelling flag is off, even if the harness is unconfigured", async () => {
    process.env.ENABLE_STORYTELLING = "false";
    isModulithConfiguredMock.mockReturnValue(false);
    const { decideHarnessPath } = await import("./route");

    const send = vi.fn();
    decideHarnessPath(
      send,
      userMessage("create a story about the fleet"),
      "run-1",
      "thread-1",
      tr,
    );

    expect(send).not.toHaveBeenCalledWith(
      expect.objectContaining({ toolCallName: "create_story" }),
    );
  });
});

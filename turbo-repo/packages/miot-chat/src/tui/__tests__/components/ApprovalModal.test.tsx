import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { ApprovalModal } from "../../modals/ApprovalModal.js";
import { approveCommand } from "../../slash/handlers/approve.js";
import {
  APPROVALS_UI_ENV,
  isApprovalsUiEnabled,
  APPROVAL_REPLY_PLACEHOLDER,
} from "../../session/approvals.js";
import type { PendingApproval } from "../../session/types.js";

function approval(): PendingApproval {
  return {
    id: "appr-1",
    runId: "run-1",
    message: "writes to inventory.db",
    data: { tool: "write_db", rows: 12 },
    ts: "2026-01-01T00:00:00Z",
  };
}

describe("approvals — feature flag", () => {
  it("is off by default", () => {
    expect(isApprovalsUiEnabled({})).toBe(false);
  });

  it("respects MIOT_CHAT_APPROVALS_UI=1 / true", () => {
    expect(isApprovalsUiEnabled({ [APPROVALS_UI_ENV]: "1" })).toBe(true);
    expect(isApprovalsUiEnabled({ [APPROVALS_UI_ENV]: "true" })).toBe(true);
    expect(isApprovalsUiEnabled({ [APPROVALS_UI_ENV]: "TRUE" })).toBe(true);
  });

  it("treats anything else as off", () => {
    expect(isApprovalsUiEnabled({ [APPROVALS_UI_ENV]: "0" })).toBe(false);
    expect(isApprovalsUiEnabled({ [APPROVALS_UI_ENV]: "" })).toBe(false);
    expect(isApprovalsUiEnabled({ [APPROVALS_UI_ENV]: "yes" })).toBe(false);
  });
});

describe("<ApprovalModal />", () => {
  it("renders the approval message and the placeholder note", () => {
    const { lastFrame } = render(
      <ApprovalModal approval={approval()} onResolve={() => undefined} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("approval requested");
    expect(frame).toContain("writes to inventory.db");
    expect(frame).toContain("write_db");
    expect(frame).toContain("[Y] approve");
    expect(frame).toContain(APPROVAL_REPLY_PLACEHOLDER);
  });

  it("calls onResolve('approve', id) on Y", async () => {
    const onResolve = vi.fn();
    const { stdin } = render(
      <ApprovalModal approval={approval()} onResolve={onResolve} />,
    );
    stdin.write("y");
    await Promise.resolve();
    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledWith("approve", "appr-1");
  });

  it("calls onResolve('deny', id) on N", async () => {
    const onResolve = vi.fn();
    const { stdin } = render(
      <ApprovalModal approval={approval()} onResolve={onResolve} />,
    );
    stdin.write("N");
    await Promise.resolve();
    expect(onResolve).toHaveBeenCalledWith("deny", "appr-1");
  });

  it("calls onResolve('later', id) on Esc", async () => {
    const onResolve = vi.fn();
    const { stdin } = render(
      <ApprovalModal approval={approval()} onResolve={onResolve} />,
    );
    stdin.write("\x1b");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onResolve).toHaveBeenCalledWith("later", "appr-1");
  });
});

describe("/approve handler", () => {
  it("dispatches RESOLVE_APPROVAL with the parsed decision and id", async () => {
    const r = await approveCommand.handle(["approve", "appr-1"], {});
    expect(r).toEqual({
      dispatch: { kind: "RESOLVE_APPROVAL", id: "appr-1", decision: "approve" },
    });
  });

  it("supports deny and later decisions", async () => {
    const a = await approveCommand.handle(["deny", "appr-2"], {});
    expect(a.dispatch?.kind).toBe("RESOLVE_APPROVAL");
    const b = await approveCommand.handle(["later", "appr-3"], {});
    expect(b.dispatch?.kind).toBe("RESOLVE_APPROVAL");
  });

  it("errors on an unknown decision", async () => {
    const r = await approveCommand.handle(["yolo", "id"], {});
    expect(r.error).toContain("unknown decision");
  });

  it("errors on missing args", async () => {
    const r = await approveCommand.handle([], {});
    expect(r.error).toContain("usage:");
  });
});

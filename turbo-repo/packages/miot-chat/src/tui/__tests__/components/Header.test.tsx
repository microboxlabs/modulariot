import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { Header } from "../../header/Header.js";
import type { SessionMeta } from "../../session/types.js";

function meta(partial: Partial<SessionMeta> = {}): SessionMeta {
  return {
    conversationId: "abcdef0123456789",
    tenantId: "demo-tenant",
    userId: "demo-user",
    mode: "auto",
    baseUrl: "http://localhost:8000",
    profileName: null,
    ...partial,
  };
}

describe("<Header />", () => {
  it("shows tenant, user, conv short id, mode, baseUrl", () => {
    const { lastFrame } = render(<Header meta={meta()} streaming={false} pendingApprovals={0} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("tenant=demo-tenant");
    expect(frame).toContain("user=demo-user");
    expect(frame).toContain("conv=abcdef01");
    expect(frame).toContain("mode=auto");
    expect(frame).toContain("http://localhost:8000");
  });

  it("includes the profile name when present", () => {
    const { lastFrame } = render(
      <Header
        meta={meta({ profileName: "staging" })}
        streaming={false}
        pendingApprovals={0}
      />,
    );
    expect(lastFrame() ?? "").toContain("profile=staging");
  });

  it("renders a spinner glyph when streaming", () => {
    const { lastFrame } = render(<Header meta={meta()} streaming={true} pendingApprovals={0} />);
    const frame = lastFrame() ?? "";
    // The header includes the spinner *and* a "streaming" or running label.
    expect(frame).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
  });

  it("does not render the spinner when idle", () => {
    const { lastFrame } = render(<Header meta={meta()} streaming={false} pendingApprovals={0} />);
    const frame = lastFrame() ?? "";
    expect(frame).not.toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
  });

  it("flags an agentic + non-mintral combo as warn", () => {
    const { lastFrame } = render(
      <Header
        meta={meta({ mode: "agentic", tenantId: "other" })}
        streaming={false}
        pendingApprovals={0}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("⚠");
    expect(frame).toContain("mode=agentic");
  });

  it("does NOT warn when agentic mode is on mintral", () => {
    const { lastFrame } = render(
      <Header
        meta={meta({ mode: "agentic", tenantId: "mintral" })}
        streaming={false}
        pendingApprovals={0}
      />,
    );
    expect(lastFrame() ?? "").not.toContain("⚠");
  });

  it("shows a pending-approvals count when there is one", () => {
    const { lastFrame } = render(
      <Header meta={meta()} streaming={false} pendingApprovals={2} />,
    );
    expect(lastFrame() ?? "").toContain("approvals=2");
  });

  it("hides the approvals chip when there are none", () => {
    const { lastFrame } = render(
      <Header meta={meta()} streaming={false} pendingApprovals={0} />,
    );
    expect(lastFrame() ?? "").not.toContain("approvals=");
  });
});

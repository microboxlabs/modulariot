import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { TopLine } from "../../chrome/TopLine.js";
import type { SessionMeta } from "../../session/types.js";

function meta(partial: Partial<SessionMeta> = {}): SessionMeta {
  return {
    conversationId: "abcdef0123456789",
    tenantId: "demo-tenant",
    userId: "demo-user",
    mode: "auto",
    baseUrl: "http://localhost:8000",
    profileName: null,
    debug: false,
    ...partial,
  };
}

describe("<TopLine />", () => {
  it("shows tenant, user, and conv short id", () => {
    const { lastFrame } = render(<TopLine meta={meta()} streaming={false} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("demo-tenant");
    expect(frame).toContain("demo-user");
    expect(frame).toContain("conv abcdef01");
  });

  it("renders a spinner glyph when streaming", () => {
    const { lastFrame } = render(<TopLine meta={meta()} streaming={true} />);
    expect(lastFrame() ?? "").toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
  });

  it("does not render the spinner when idle", () => {
    const { lastFrame } = render(<TopLine meta={meta()} streaming={false} />);
    expect(lastFrame() ?? "").not.toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
  });
});

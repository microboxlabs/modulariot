import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { RuleStep } from "./conversations-types";

const api = vi.hoisted(() => ({
  useConnectionChannel: vi.fn(),
}));
vi.mock("./conversations-api", () => api);

import RuleSteps from "./rule-steps";

const d = es.pages.userSettings.communications;

const SLACK_STEP: RuleStep = {
  after: 0,
  channel: "slack",
  template: "",
  to: "audience",
  waitForReply: 0,
  onReply: "stop",
};

const connection = (id: string, name: string) => ({
  id,
  name,
  baseUrl: "https://example.com/hooks",
  status: "ACTIVE",
  lastTestedAt: null,
  lastTestResult: null,
});

describe("RuleSteps, steps that call a connection", () => {
  it("asks for one of the channel's connections instead of recipients, and the template is optional", () => {
    api.useConnectionChannel.mockImplementation((channel: string | null) => ({
      data:
        channel === "slack"
          ? {
              operation: "deliver",
              requestSchema: {},
              connections: [connection("c1", "Torre de control")],
            }
          : undefined,
    }));
    const onChange = vi.fn();
    render(
      <RuleSteps
        steps={[SLACK_STEP]}
        templates={[]}
        fields={[]}
        readOnly={false}
        d={d}
        onChange={onChange}
      />
    );
    expect(api.useConnectionChannel).toHaveBeenCalledWith("slack");
    expect(screen.getByRole("option", { name: "Sin plantilla" })).toBeTruthy();
    expect(screen.getByText("A").parentElement?.className).toContain("hidden");

    fireEvent.change(screen.getByLabelText("Conexión"), {
      target: { value: "c1" },
    });
    expect(onChange).toHaveBeenLastCalledWith([
      { ...SLACK_STEP, connection: "c1" },
    ]);
  });

  it("shows no connection field on a step written to people", () => {
    api.useConnectionChannel.mockReturnValue({ data: undefined });
    render(
      <RuleSteps
        steps={[{ ...SLACK_STEP, channel: "email" }]}
        templates={[]}
        fields={[]}
        readOnly={false}
        d={d}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByLabelText("Conexión")).toBeNull();
  });
});

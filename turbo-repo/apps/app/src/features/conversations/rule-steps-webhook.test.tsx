import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { RuleStep } from "./conversations-types";

const api = vi.hoisted(() => ({
  useWebhookChannel: vi.fn(),
}));
vi.mock("./conversations-api", () => api);

import RuleSteps from "./rule-steps";

const d = es.pages.userSettings.communications;

const WEBHOOK_STEP: RuleStep = {
  after: 0,
  channel: "webhook",
  template: "",
  to: "audience",
  waitForReply: 0,
  onReply: "stop",
};

describe("RuleSteps, webhook step", () => {
  it("asks for a connection instead of recipients, and the template is optional", () => {
    api.useWebhookChannel.mockReturnValue({
      data: {
        operation: "deliver",
        requestSchema: {},
        connections: [
          {
            id: "c1",
            name: "Sistema de incidentes",
            baseUrl: "https://example.com/hooks",
            status: "ACTIVE",
            lastTestedAt: null,
            lastTestResult: null,
          },
        ],
      },
    });
    const onChange = vi.fn();
    render(
      <RuleSteps
        steps={[WEBHOOK_STEP]}
        templates={[]}
        fields={[]}
        readOnly={false}
        d={d}
        onChange={onChange}
      />
    );
    expect(api.useWebhookChannel).toHaveBeenCalledWith(true);
    expect(screen.getByRole("option", { name: "Sin plantilla" })).toBeTruthy();
    expect(screen.getByText("A").parentElement?.className).toContain("hidden");

    fireEvent.change(screen.getByLabelText("Conexión"), {
      target: { value: "c1" },
    });
    expect(onChange).toHaveBeenLastCalledWith([
      { ...WEBHOOK_STEP, connection: "c1" },
    ]);
  });

  it("does not load connections when no step is a webhook", () => {
    api.useWebhookChannel.mockReturnValue({ data: undefined });
    render(
      <RuleSteps
        steps={[{ ...WEBHOOK_STEP, channel: "email" }]}
        templates={[]}
        fields={[]}
        readOnly={false}
        d={d}
        onChange={vi.fn()}
      />
    );
    expect(api.useWebhookChannel).toHaveBeenLastCalledWith(false);
    expect(screen.queryByLabelText("Conexión")).toBeNull();
  });
});

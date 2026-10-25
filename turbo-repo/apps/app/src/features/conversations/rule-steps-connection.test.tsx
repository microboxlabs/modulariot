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
  to: [],
  waitForReply: 0,
  onReply: "stop",
};

const GROUPS = [{ id: "drivers", entries: [{ role: "driver" }] }];

const connection = (id: string, name: string) => ({
  id,
  name,
  host: "example.com",
  status: "ACTIVE",
  lastTestedAt: null,
  lastTestResult: null,
});

describe("RuleSteps, steps that call a connection", () => {
  it("asks for one of the channel's connections instead of groups, and the template is optional", () => {
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
        groups={GROUPS}
        templates={[]}
        readOnly={false}
        d={d}
        onChange={onChange}
      />
    );
    expect(api.useConnectionChannel).toHaveBeenCalledWith("slack");
    expect(screen.getByRole("option", { name: "Sin plantilla" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: /Grupos/ })).toBeNull();

    fireEvent.change(screen.getByLabelText("Conexión"), {
      target: { value: "c1" },
    });
    expect(onChange).toHaveBeenLastCalledWith([
      { ...SLACK_STEP, connection: "c1" },
    ]);
  });

  it("links to the channel's page when it has no connections", () => {
    api.useConnectionChannel.mockReturnValue({
      data: { operation: null, requestSchema: null, connections: [] },
    });
    render(
      <RuleSteps
        steps={[SLACK_STEP]}
        groups={GROUPS}
        templates={[]}
        readOnly={false}
        d={d}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByLabelText("Conexión")).toBeNull();
    expect(screen.getByText(/No hay conexiones de Slack/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Crear una" }).getAttribute("href")
    ).toBe("/es/users/settings/communications?section=channel%3Aslack");
  });

  it("shows the groups and no connection on a step written to people", () => {
    api.useConnectionChannel.mockReturnValue({ data: undefined });
    render(
      <RuleSteps
        steps={[{ ...SLACK_STEP, channel: "email", to: ["drivers"] }]}
        groups={GROUPS}
        templates={[]}
        readOnly={false}
        d={d}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByLabelText("Conexión")).toBeNull();
    expect(screen.getByRole("group", { name: /Grupos/ })).toBeTruthy();
  });
});

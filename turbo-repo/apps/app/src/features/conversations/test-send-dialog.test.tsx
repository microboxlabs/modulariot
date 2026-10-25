import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { RuleStep, SampleEvent } from "./conversations-types";

const api = vi.hoisted(() => ({ invokeRule: vi.fn() }));
vi.mock("./conversations-api", () => api);
vi.mock(
  "@/features/symptoms/control-tower/control-tower-api",
  async (original) => ({
    ...(await original<object>()),
    useContacts: () => ({
      data: [
        {
          id: "c1",
          name: "Ana Prueba",
          role: "Jefe de torre",
          phone: null,
          active: true,
          company: null,
          channels: { email: "ana@example.com", whatsapp: "+56 9 1234 5678" },
        },
      ],
    }),
  })
);

import TestSendDialog, { testDestination, testEvent } from "./test-send-dialog";

const d = es.pages.userSettings.communications;

const step = (channel: RuleStep["channel"]): RuleStep => ({
  after: 0,
  channel,
  template: "x",
  to: ["g"],
  waitForReply: 0,
  onReply: "stop",
});

const SAMPLE: SampleEvent = {
  type: "trip.alert",
  context: { kind: "trip", key: "1" },
  data: { orderRef: "", level: 4 },
  test: false,
  at: "2026-10-25T12:00:00Z",
};

describe("testDestination", () => {
  it("sends each step to the address of its channel, the preferred one to the phone", () => {
    const to = { email: "a@example.com", phone: "+56900000099", name: "" };
    expect(testDestination(step("email"), to)).toEqual({
      kind: "email",
      address: "a@example.com",
    });
    expect(testDestination(step("preferred"), to)).toEqual({
      kind: "phone",
      address: "+56900000099",
    });
    expect(testDestination(step("whatsapp"), { ...to, phone: "" }).kind).toBe(
      "none"
    );
    expect(testDestination(step("slack"), to).kind).toBe("connection");
  });
});

describe("testEvent", () => {
  it("fills blank fields with fictitious sample values", () => {
    expect(testEvent(SAMPLE).data).toEqual({ orderRef: "OT-0001", level: 4 });
  });
});

describe("TestSendDialog", () => {
  it("takes a contact from the book and sends the draft to them", async () => {
    const beforeSend = vi.fn().mockResolvedValue(undefined);
    api.invokeRule.mockResolvedValue({});
    render(
      <TestSendDialog
        open
        ruleId="r1"
        groups={["g", "h"]}
        steps={[step("whatsapp"), step("email"), step("slack")]}
        sample={SAMPLE}
        lang="es"
        d={d}
        beforeSend={beforeSend}
        onClose={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText("Desde la libreta"), {
      target: { value: "ana" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ana Prueba/ }));
    const steps = screen.getByRole("list", { name: "Lo que envía cada paso" });
    expect(within(steps).getByText("+56 9 1234 5678")).toBeTruthy();
    expect(within(steps).getByText("ana@example.com")).toBeTruthy();
    expect(within(steps).getByText("no se llama a la conexión")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enviar prueba" }));
    });
    expect(beforeSend).toHaveBeenCalled();
    const ana = {
      name: "Ana Prueba",
      email: "ana@example.com",
      phone: "+56 9 1234 5678",
    };
    expect(api.invokeRule).toHaveBeenCalledWith("r1", {
      version: "draft",
      event: expect.objectContaining({ type: "trip.alert" }),
      to: { g: [ana], h: [ana] },
    });
    expect(screen.getByText(/La prueba empezó/)).toBeTruthy();
  });

  it("cannot send without an address for any step", () => {
    render(
      <TestSendDialog
        open
        ruleId="r1"
        groups={["g"]}
        steps={[step("email")]}
        sample={SAMPLE}
        lang="es"
        d={d}
        beforeSend={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Enviar prueba",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });
});

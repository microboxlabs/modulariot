import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { SampleEvent, Simulation } from "./conversations-types";
import SimulationSection, { SimulationTimeline } from "./simulation";

const d = es.pages.userSettings.communications;

const AT = "2026-10-23T12:00:00.000Z";

const RESULT: Simulation = {
  matches: true,
  recipients: [
    { address: "+56900000000", channel: "whatsapp", name: "Juan Soto" },
    { address: "tower@example.com", channel: "email", name: "Jefe de torre" },
  ],
  messages: [
    {
      step: 1,
      at: "2026-10-23T12:05:00.000Z",
      channel: "email",
      to: {
        address: "tower@example.com",
        channel: "email",
        name: "Jefe de torre",
      },
      text: "Botón de pánico sin respuesta.",
    },
    {
      step: 0,
      at: AT,
      channel: "whatsapp",
      to: { address: "+56900000000", channel: "whatsapp", name: "Juan Soto" },
      text: "Hola Juan Soto, ¿estás bien?",
    },
  ],
};

describe("SimulationTimeline", () => {
  it("lists the messages in time order with minute, channel, recipient and text", () => {
    render(<SimulationTimeline result={RESULT} eventAt={AT} d={d} />);
    const items = within(
      screen.getByRole("list", { name: "Mensajes simulados" })
    ).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("t+0'");
    expect(items[0].textContent).toContain("WhatsApp");
    expect(items[0].textContent).toContain("Juan Soto");
    expect(items[0].textContent).toContain("Hola Juan Soto, ¿estás bien?");
    expect(items[1].textContent).toContain("t+5'");
    expect(items[1].textContent).toContain("Correo");
    expect(items[1].textContent).toContain("Paso 2");
    expect(screen.getByText("2 destinatarios.")).toBeTruthy();
  });

  it("says so when the rule does not fire", () => {
    render(
      <SimulationTimeline
        result={{ matches: false, recipients: [], messages: [] }}
        eventAt={AT}
        d={d}
      />
    );
    expect(screen.getByRole("status").textContent).toBe(
      "La regla no se activa con este evento."
    );
  });
});

describe("SimulationSection", () => {
  const initial: SampleEvent = {
    type: "symptom.case.opened",
    context: { kind: "symptom_case", key: "1" },
    data: { symptomKey: "panic-button", level: 4 },
    test: true,
    at: AT,
  };

  it("sends the edited event and shows the timeline", async () => {
    const onSimulate = vi.fn().mockResolvedValue(RESULT);
    render(
      <SimulationSection
        initial={initial}
        disabled={false}
        d={d}
        onSimulate={onSimulate}
      />
    );
    const editor = screen.getByLabelText(
      "Evento de muestra (JSON)"
    ) as HTMLTextAreaElement;
    expect(JSON.parse(editor.value)).toEqual(initial);
    fireEvent.change(editor, {
      target: { value: JSON.stringify({ ...initial, data: { level: 3 } }) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simular" }));
    await waitFor(() =>
      expect(
        screen.getByRole("list", { name: "Mensajes simulados" })
      ).toBeTruthy()
    );
    expect(onSimulate).toHaveBeenCalledWith({ ...initial, data: { level: 3 } });
  });

  it("refuses JSON it cannot read without calling the server", () => {
    const onSimulate = vi.fn();
    render(
      <SimulationSection
        initial={initial}
        disabled={false}
        d={d}
        onSimulate={onSimulate}
      />
    );
    fireEvent.change(screen.getByLabelText("Evento de muestra (JSON)"), {
      target: { value: "{ nope" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simular" }));
    expect(screen.getByRole("alert").textContent).toBe(
      "El evento no es un JSON válido."
    );
    expect(onSimulate).not.toHaveBeenCalled();
  });
});

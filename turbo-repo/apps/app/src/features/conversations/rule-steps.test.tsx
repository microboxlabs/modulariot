import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { ConversationTemplate, RuleStep } from "./conversations-types";
import RuleSteps from "./rule-steps";

const d = es.pages.userSettings.communications;

const TEMPLATES = [
  { id: "t1", key: "panic-check", name: "Chequeo de pánico" },
  { id: "t2", key: "panic-tower", name: "Aviso a la torre" },
] as ConversationTemplate[];

const STEPS: RuleStep[] = [
  {
    after: 0,
    channel: "whatsapp",
    template: "panic-check",
    to: "audience",
    waitForReply: 5,
    onReply: "stop",
  },
  {
    after: 0,
    channel: "email",
    template: "panic-tower",
    to: [{ address: "tower@example.com", channel: "email", name: "Torre" }],
    waitForReply: 10,
    onReply: "stop",
  },
];

/** The steps as a controlled list, with every change recorded. */
function Harness({
  initial,
  onChange,
}: Readonly<{ initial: RuleStep[]; onChange: (s: RuleStep[]) => void }>) {
  const [steps, setSteps] = useState(initial);
  return (
    <RuleSteps
      steps={steps}
      templates={TEMPLATES}
      fields={[]}
      readOnly={false}
      d={d}
      onChange={(next) => {
        setSteps(next);
        onChange(next);
      }}
    />
  );
}

const DRAG = "Arrastra para cambiar el orden, o usa ↑ ↓.";

const rows = () => screen.getAllByRole("listitem", { name: /^Paso \d$/ });

describe("RuleSteps", () => {
  it("shows one row per step with its channel, template and wait", () => {
    render(<Harness initial={STEPS} onChange={vi.fn()} />);
    const [first, second] = rows();
    expect(
      (within(first).getByLabelText("Canal") as HTMLSelectElement).value
    ).toBe("whatsapp");
    expect(
      (within(first).getByLabelText("Plantilla") as HTMLSelectElement).value
    ).toBe("panic-check");
    expect(
      (
        within(first).getByLabelText(
          "Minutos de espera de respuesta"
        ) as HTMLInputElement
      ).value
    ).toBe("5");
    expect(within(second).getByDisplayValue("tower@example.com")).toBeTruthy();
  });

  it("adds, moves and removes steps", () => {
    const onChange = vi.fn();
    render(<Harness initial={STEPS} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar paso" }));
    expect(rows()).toHaveLength(3);
    expect(onChange.mock.lastCall?.[0][2]).toMatchObject({
      channel: "whatsapp",
      to: "audience",
      template: "",
    });

    fireEvent.keyDown(within(rows()[1]).getByRole("button", { name: DRAG }), {
      key: "ArrowUp",
    });
    expect(
      onChange.mock.lastCall?.[0].map((s: RuleStep) => s.template)
    ).toEqual(["panic-tower", "panic-check", ""]);
    expect(
      (within(rows()[0]).getByLabelText("Plantilla") as HTMLSelectElement).value
    ).toBe("panic-tower");

    fireEvent.click(
      within(rows()[0]).getByRole("button", { name: "Quitar paso" })
    );
    expect(rows()).toHaveLength(2);
    expect(
      onChange.mock.lastCall?.[0].map((s: RuleStep) => s.template)
    ).toEqual(["panic-check", ""]);
  });

  it("moves a step by dropping it on another, and keeps the ends in place", () => {
    const onChange = vi.fn();
    render(<Harness initial={STEPS} onChange={onChange} />);
    const [first, second] = rows();
    const handle = within(second).getByRole("button", { name: DRAG });
    fireEvent.dragStart(handle, {
      dataTransfer: { setData: vi.fn(), setDragImage: vi.fn() },
    });
    fireEvent.dragOver(first);
    fireEvent.drop(first);
    expect(
      onChange.mock.lastCall?.[0].map((s: RuleStep) => s.template)
    ).toEqual(["panic-tower", "panic-check"]);

    onChange.mockClear();
    fireEvent.keyDown(within(rows()[0]).getByRole("button", { name: DRAG }), {
      key: "ArrowUp",
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("has no drag handle with a single step", () => {
    render(<Harness initial={[STEPS[0]]} onChange={vi.fn()} />);
    expect(within(rows()[0]).queryByRole("button", { name: DRAG })).toBeNull();
  });

  it("waits for a reply only on WhatsApp and email", () => {
    const onChange = vi.fn();
    render(<Harness initial={[STEPS[0]]} onChange={onChange} />);
    const row = rows()[0];
    expect(within(row).getByLabelText("Si responde")).toBeTruthy();

    fireEvent.change(within(row).getByLabelText("Canal"), {
      target: { value: "preferred" },
    });
    expect(onChange.mock.lastCall?.[0][0]).toMatchObject({
      channel: "preferred",
      waitForReply: 0,
    });
    expect(
      within(rows()[0]).queryByLabelText("Minutos de espera de respuesta")
    ).toBeNull();
    expect(within(rows()[0]).getByText(/no espera respuesta/)).toBeTruthy();

    fireEvent.change(within(rows()[0]).getByLabelText("Canal"), {
      target: { value: "email" },
    });
    expect(
      within(rows()[0]).getByLabelText("Minutos de espera de respuesta")
    ).toBeTruthy();
    // With no wait there is nothing to do on a reply.
    expect(within(rows()[0]).queryByLabelText("Si responde")).toBeNull();
  });

  it("sends a step to other people with their own list", () => {
    const onChange = vi.fn();
    render(<Harness initial={[STEPS[0]]} onChange={onChange} />);
    fireEvent.change(within(rows()[0]).getByLabelText("A"), {
      target: { value: "custom" },
    });
    expect(onChange.mock.lastCall?.[0][0].to).toEqual([{ role: "tower_lead" }]);
    expect((screen.getByLabelText("Rol") as HTMLSelectElement).value).toBe(
      "tower_lead"
    );
  });

  it("shows a step's findings under it and marks its template", () => {
    render(
      <RuleSteps
        steps={[STEPS[0]]}
        templates={TEMPLATES}
        fields={[]}
        errors={{
          0: {
            messages: ["El paso 1 no tiene plantilla."],
            template: true,
            channel: false,
            connection: false,
            entries: {},
          },
        }}
        readOnly={false}
        d={d}
        onChange={vi.fn()}
      />
    );
    const row = rows()[0];
    expect(within(row).getByText("El paso 1 no tiene plantilla.")).toBeTruthy();
    expect(within(row).getByLabelText("Plantilla").className).toContain(
      "border-red-500"
    );
    expect(within(row).getByLabelText("Canal").className).not.toContain(
      "border-red-500"
    );
  });

  it("marks the step's own recipient that has the problem, not its template", () => {
    render(
      <RuleSteps
        steps={[STEPS[1]]}
        templates={TEMPLATES}
        fields={[]}
        errors={{
          0: {
            messages: [],
            template: false,
            channel: false,
            connection: false,
            entries: { 0: ["Ningún contacto tiene el rol Jefe de torre."] },
          },
        }}
        readOnly={false}
        d={d}
        onChange={vi.fn()}
      />
    );
    const row = rows()[0];
    expect(within(row).getByLabelText("Plantilla").className).not.toContain(
      "border-red-500"
    );
    expect(within(row).getByLabelText("Número o correo").className).toContain(
      "border-red-500"
    );
    expect(
      within(row).getByText("Ningún contacto tiene el rol Jefe de torre.")
    ).toBeTruthy();
  });
});

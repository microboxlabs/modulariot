import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type {
  ConversationTemplate,
  RecipientGroup,
  RuleStep,
} from "./conversations-types";
import RuleSteps, { gapMinutes, withGap } from "./rule-steps";

const d = es.pages.userSettings.communications;

const TEMPLATES = [
  { id: "t1", key: "panic-check", name: "Chequeo de pánico" },
  { id: "t2", key: "panic-tower", name: "Aviso a la torre" },
] as ConversationTemplate[];

const GROUPS: RecipientGroup[] = [
  { id: "drivers", name: "Conductores", entries: [{ role: "driver" }] },
  {
    id: "tower",
    name: "Torre",
    entries: [{ address: "tower@example.com", channel: "email" }],
  },
];

const STEPS: RuleStep[] = [
  {
    after: 0,
    channel: "whatsapp",
    template: "panic-check",
    to: ["drivers"],
    waitForReply: 5,
    onReply: "stop",
  },
  {
    after: 0,
    channel: "email",
    template: "panic-tower",
    to: ["tower"],
    waitForReply: 10,
    onReply: "stop",
  },
];

/** The steps as a controlled list, with every change recorded. */
function Harness({
  initial,
  groups = GROUPS,
  onChange,
}: Readonly<{
  initial: RuleStep[];
  groups?: RecipientGroup[];
  onChange: (s: RuleStep[]) => void;
}>) {
  const [steps, setSteps] = useState(initial);
  return (
    <RuleSteps
      steps={steps}
      groups={groups}
      templates={TEMPLATES}
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

const chip = (row: HTMLElement, name: string) =>
  within(row).getByRole("button", { name });

/** The pill around a control, which carries its error mark. */
const pill = (el: HTMLElement) => el.closest(".rounded-md") as HTMLElement;

describe("RuleSteps", () => {
  it("shows each step as channel, template and groups, with the wait on the line to the next", () => {
    render(<Harness initial={STEPS} onChange={vi.fn()} />);
    const [first, second] = rows();
    expect(
      (within(first).getByLabelText("Canal") as HTMLSelectElement).value
    ).toBe("whatsapp");
    expect(
      (within(first).getByLabelText("Plantilla") as HTMLInputElement).value
    ).toBe(TEMPLATES.find((t) => t.key === "panic-check")?.name);
    expect(chip(first, "Conductores").getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(chip(first, "Torre").getAttribute("aria-pressed")).toBe("false");
    expect(
      (
        within(first).getByLabelText(
          "Cuándo sigue el siguiente paso"
        ) as HTMLSelectElement
      ).value
    ).toBe("stop");
    expect(
      (
        within(first).getByLabelText(
          "Minutos hasta el siguiente paso"
        ) as HTMLInputElement
      ).value
    ).toBe("5");
    expect(chip(second, "Torre").getAttribute("aria-pressed")).toBe("true");
    expect(
      (
        screen.getByLabelText(
          "Minutos de espera de respuesta"
        ) as HTMLInputElement
      ).value
    ).toBe("10");
  });

  it("adds a step for the first group, moves it and removes one", () => {
    const onChange = vi.fn();
    render(<Harness initial={STEPS} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar paso" }));
    expect(rows()).toHaveLength(3);
    expect(onChange.mock.lastCall?.[0][2]).toMatchObject({
      channel: "whatsapp",
      to: ["drivers"],
      template: "",
    });

    fireEvent.keyDown(within(rows()[1]).getByRole("button", { name: DRAG }), {
      key: "ArrowUp",
    });
    expect(
      onChange.mock.lastCall?.[0].map((s: RuleStep) => s.template)
    ).toEqual(["panic-tower", "panic-check", ""]);

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

  it("toggles the groups a step writes to, and lets an unknown one be removed", () => {
    const onChange = vi.fn();
    render(
      <Harness
        initial={[{ ...STEPS[0], to: ["drivers", "night"] }]}
        onChange={onChange}
      />
    );
    fireEvent.click(chip(rows()[0], "Torre"));
    expect(onChange.mock.lastCall?.[0][0].to).toEqual([
      "drivers",
      "night",
      "tower",
    ]);
    fireEvent.click(chip(rows()[0], "night ✕"));
    expect(onChange.mock.lastCall?.[0][0].to).toEqual(["drivers", "tower"]);
  });

  it("asks for a group when the rule has none", () => {
    render(
      <Harness
        initial={[{ ...STEPS[0], to: [] }]}
        groups={[]}
        onChange={vi.fn()}
      />
    );
    expect(
      within(rows()[0]).getByText("Agrega un grupo en «A quién».")
    ).toBeTruthy();
  });

  it("starts the first step right away or some minutes after the event", () => {
    const onChange = vi.fn();
    render(<Harness initial={STEPS} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Cuándo sale el primer paso"), {
      target: { value: "later" },
    });
    expect(onChange.mock.lastCall?.[0][0].after).toBe(5);
    fireEvent.change(screen.getByLabelText("Minutos antes de enviar"), {
      target: { value: "12" },
    });
    expect(onChange.mock.lastCall?.[0][0].after).toBe(12);
  });

  it("keeps the wait on the channel's own minutes and the gap through a channel change", () => {
    const onChange = vi.fn();
    render(<Harness initial={STEPS} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Minutos hasta el siguiente paso"), {
      target: { value: "15" },
    });
    expect(onChange.mock.lastCall?.[0][0].waitForReply).toBe(15);
    expect(onChange.mock.lastCall?.[0][1].after).toBe(0);

    fireEvent.change(within(rows()[0]).getByLabelText("Canal"), {
      target: { value: "preferred" },
    });
    const steps = onChange.mock.lastCall?.[0] as RuleStep[];
    expect(steps[0].waitForReply).toBe(0);
    expect(steps[1].after).toBe(15);
    expect(
      (
        screen.getByLabelText(
          "Cuándo sigue el siguiente paso"
        ) as HTMLSelectElement
      ).value
    ).toBe("after");
  });

  it("sends the next step right away, replies or not, and asks for minutes again when it waits", () => {
    const onChange = vi.fn();
    render(<Harness initial={STEPS} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Cuándo sigue el siguiente paso"), {
      target: { value: "now" },
    });
    let steps = onChange.mock.lastCall?.[0] as RuleStep[];
    expect([steps[0].waitForReply, steps[0].onReply, steps[1].after]).toEqual([
      0,
      "continue",
      0,
    ]);
    expect(
      screen.queryByLabelText("Minutos hasta el siguiente paso")
    ).toBeNull();

    fireEvent.change(screen.getByLabelText("Cuándo sigue el siguiente paso"), {
      target: { value: "stop" },
    });
    steps = onChange.mock.lastCall?.[0] as RuleStep[];
    expect([steps[0].waitForReply, steps[0].onReply]).toEqual([5, "stop"]);
  });

  it("shows a step's findings under it and marks the parts they are about", () => {
    render(
      <RuleSteps
        steps={[STEPS[0]]}
        groups={GROUPS}
        templates={TEMPLATES}
        errors={{
          0: {
            messages: ["El paso 1 no tiene plantilla."],
            template: true,
            channel: false,
            connection: false,
            groups: false,
          },
        }}
        readOnly={false}
        d={d}
        onChange={vi.fn()}
      />
    );
    const row = rows()[0];
    expect(within(row).getByText("El paso 1 no tiene plantilla.")).toBeTruthy();
    expect(pill(within(row).getByLabelText("Plantilla")).className).toContain(
      "border-red-500"
    );
    expect(pill(within(row).getByLabelText("Canal")).className).not.toContain(
      "border-red-500"
    );
  });
});

describe("the gap between two steps", () => {
  it("is the first step's wait plus the next one's delay", () => {
    expect(gapMinutes([{ ...STEPS[0] }, { ...STEPS[1], after: 3 }], 0)).toBe(8);
  });

  it("is kept as the wait on a reply channel, else as the next step's delay", () => {
    expect(withGap(STEPS, 0, 7).map((s) => [s.waitForReply, s.after])).toEqual([
      [7, 0],
      [10, 0],
    ]);
    const slack = [{ ...STEPS[0], channel: "slack" as const }, STEPS[1]];
    expect(withGap(slack, 0, 7).map((s) => [s.waitForReply, s.after])).toEqual([
      [0, 0],
      [10, 7],
    ]);
  });
});

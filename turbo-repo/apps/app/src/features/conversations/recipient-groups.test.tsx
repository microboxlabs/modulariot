import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { RecipientGroup, RuleStep } from "./conversations-types";
import RecipientGroups from "./recipient-groups";
import { emptyStep } from "./rule-model";

vi.mock("./contacts-audience", () => ({ default: () => null }));

const d = es.pages.userSettings.communications;

const GROUPS: RecipientGroup[] = [
  { id: "rule", name: null, entries: [{ role: "driver" }] },
  { id: "tower", name: "Torre", entries: [{ role: "tower_lead" }] },
];

const STEPS: RuleStep[] = [emptyStep(["rule", "tower"]), emptyStep(["tower"])];

function draw(onChange = vi.fn(), errors = {}) {
  render(
    <RecipientGroups
      groups={GROUPS}
      steps={STEPS}
      fields={[]}
      errors={errors}
      readOnly={false}
      d={d}
      onChange={onChange}
    />
  );
  return onChange;
}

describe("RecipientGroups", () => {
  it("shows each group with its name, id and the steps that write to it", () => {
    draw();
    const rule = screen.getByRole("region", { name: "Grupo 1" });
    expect(within(rule).getByText("rule")).toBeTruthy();
    expect(within(rule).getByText("Lo usa: Paso 1")).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Torre" })).getByText(
        "Lo usa: Paso 1, Paso 2"
      )
    ).toBeTruthy();
  });

  it("renames a group, and a removed group leaves the steps that named it", () => {
    const onChange = draw();
    const torre = screen.getByRole("region", { name: "Torre" });
    fireEvent.change(within(torre).getByLabelText("Nombre del grupo"), {
      target: { value: "Torre de control" },
    });
    expect(onChange.mock.lastCall?.[0][1].name).toBe("Torre de control");

    fireEvent.click(
      within(torre).getByRole("button", { name: "Quitar grupo" })
    );
    const [groups, steps] = onChange.mock.lastCall as [
      RecipientGroup[],
      RuleStep[],
    ];
    expect(groups.map((g) => g.id)).toEqual(["rule"]);
    expect(steps.map((s) => s.to)).toEqual([["rule"], []]);
  });

  it("adds a group with an id of its own", () => {
    const onChange = draw();
    fireEvent.click(screen.getByRole("button", { name: "Agregar grupo" }));
    expect(onChange.mock.lastCall?.[0][2]).toMatchObject({
      id: "group-3",
      entries: [{ role: "driver" }],
    });
  });

  it("shows a group's findings and its recipients' under them", () => {
    draw(vi.fn(), {
      1: {
        messages: ["Ningún paso escribe a «Torre»."],
        entries: { 0: ["Ningún contacto tiene el rol Jefe de torre."] },
      },
    });
    const torre = screen.getByRole("region", { name: "Torre" });
    expect(
      within(torre).getByText("Ningún paso escribe a «Torre».")
    ).toBeTruthy();
    expect(
      within(torre).getByText("Ningún contacto tiene el rol Jefe de torre.")
    ).toBeTruthy();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bookRoles, type BookRole } from "../control-tower/contact-roles";
import type { TowerContact } from "../control-tower/control-tower-api";
import LevelSteps from "./level-steps";
import RolePicker, { roleMissing } from "./role-picker";

const d = {
  rolePick: "Elegir rol",
  roleDriver: "Conductor del viaje",
  roleWithContacts: "{role} · {n} contactos",
  roleWithOneContact: "{role} · 1 contacto",
  roleNoContacts: "Rol sin contactos en la libreta",
  stepRole: "A quién",
};

const ROLES: BookRole[] = [
  { role: "Jefe de turno", activeContacts: 1 },
  { role: "Transportista", activeContacts: 3 },
];

const contact = (patch: Partial<TowerContact>): TowerContact =>
  ({
    id: "c",
    name: "N",
    role: null,
    active: true,
    ...patch,
  }) as TowerContact;

describe("bookRoles", () => {
  it("sorts the roles, counts active contacts and leaves out the driver", () => {
    expect(
      bookRoles(
        ["Transportista", "conductor", "Jefe de turno", "transportista"],
        [
          contact({ role: "Transportista" }),
          contact({ role: " transportista " }),
          contact({ role: "Transportista", active: false }),
          contact({ role: "Conductor" }),
        ]
      )
    ).toEqual([
      { role: "Jefe de turno", activeContacts: 0 },
      { role: "Transportista", activeContacts: 2 },
    ]);
  });
});

describe("roleMissing", () => {
  it("flags a role the book does not have or has no active contact for", () => {
    expect(roleMissing("Supervisor", ROLES)).toBe(true);
    expect(
      roleMissing("Jefe de turno", [
        { role: "Jefe de turno", activeContacts: 0 },
      ])
    ).toBe(true);
    expect(roleMissing("transportista", ROLES)).toBe(false);
    expect(roleMissing("Conductor", ROLES)).toBe(false);
    expect(roleMissing("", ROLES)).toBe(false);
    expect(roleMissing("Supervisor", undefined)).toBe(false);
  });
});

describe("RolePicker", () => {
  it("offers the driver and the book's roles with their contacts", () => {
    const onChange = vi.fn();
    render(
      <RolePicker
        value=""
        roles={ROLES}
        label="A quién"
        d={d}
        onChange={onChange}
      />
    );
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual([
      "Elegir rol",
      "Conductor del viaje",
      "Jefe de turno · 1 contacto",
      "Transportista · 3 contactos",
    ]);
    fireEvent.change(screen.getByLabelText("A quién"), {
      target: { value: "Conductor" },
    });
    expect(onChange).toHaveBeenCalledWith("Conductor");
  });

  it("keeps a saved role the book no longer has", () => {
    render(
      <RolePicker
        value="Supervisor"
        roles={ROLES}
        label="A quién"
        d={d}
        onChange={vi.fn()}
      />
    );
    expect((screen.getByLabelText("A quién") as HTMLSelectElement).value).toBe(
      "Supervisor"
    );
  });
});

describe("LevelSteps role picker", () => {
  it("keeps an unknown saved role and warns about it", () => {
    const onChange = vi.fn();
    render(
      <LevelSteps
        steps={[
          { role: "Supervisor", channel: "call", budgetMinutes: 2, script: "" },
          {
            role: "Transportista",
            channel: "call",
            budgetMinutes: 2,
            script: "",
          },
        ]}
        slaMinutes={5}
        roles={ROLES}
        readOnly={false}
        d={d}
        onChange={onChange}
      />
    );
    const [first, second] = screen.getAllByLabelText(
      "A quién"
    ) as HTMLSelectElement[];
    expect(first!.value).toBe("Supervisor");
    expect(second!.value).toBe("Transportista");
    expect(screen.getAllByText("Rol sin contactos en la libreta")).toHaveLength(
      1
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});

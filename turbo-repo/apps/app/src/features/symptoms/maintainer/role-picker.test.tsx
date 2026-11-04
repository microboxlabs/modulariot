import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ScopeRoles } from "../control-tower/contact-roles";
import LevelSteps from "./level-steps";
import TargetPicker, { roleMissing } from "./role-picker";

const d = {
  rolePick: "Elegir rol",
  roleAny: "Cualquier rol",
  roleWithContacts: "{role} · {n} contactos",
  roleWithOneContact: "{role} · 1 contacto",
  roleNoContacts: "Rol sin contactos en la libreta",
  roleGroupTrip: "Del viaje",
  roleGroupOrg: "De la organización",
  roleWithHint: "{role} · {hint}",
  scopePick: "Elegir",
  scopeDriver: "Conductor del viaje",
  scopeCarrier: "Transportista del viaje",
  scopeOrg: "Organización",
  scopeHintTrip: "por RUT del viaje",
  stepScope: "{label} · de",
  stepScopeRole: "{label} · rol",
  stepRole: "A quién",
};

const ROLES: ScopeRoles = {
  carrier: [
    { role: "Gerente de Seguridad", activeContacts: 4 },
    { role: "Oficina Comercial", activeContacts: 1 },
  ],
  org: [{ role: "Jefe de Torre", activeContacts: 2 }],
};

const options = (el: HTMLElement) =>
  within(el)
    .getAllByRole("option")
    .map((o) => [(o as HTMLOptionElement).value, o.textContent]);

function renderPicker(target: Parameters<typeof TargetPicker>[0]["target"]) {
  const onChange = vi.fn();
  render(
    <TargetPicker
      target={target}
      roles={ROLES}
      label="A quién"
      className=""
      d={d}
      onChange={onChange}
    />
  );
  return onChange;
}

describe("TargetPicker", () => {
  it("groups the scopes and hides the role for the driver", () => {
    const onChange = renderPicker({ scope: "DRIVER", role: null });
    const scope = screen.getByLabelText("A quién · de");
    const groups = within(scope).getAllByRole("group");
    expect(groups.map((g) => g.getAttribute("label"))).toEqual([
      "Del viaje",
      "De la organización",
    ]);
    expect(options(groups[0]!)).toEqual([
      ["DRIVER", "Conductor del viaje · por RUT del viaje"],
      ["TRIP_CARRIER", "Transportista del viaje · por RUT del viaje"],
    ]);
    expect(options(groups[1]!)).toEqual([["ORG", "Organización"]]);
    expect(screen.queryByLabelText("A quién · rol")).toBeNull();

    fireEvent.change(scope, { target: { value: "TRIP_CARRIER" } });
    expect(onChange).toHaveBeenCalledWith({
      scope: "TRIP_CARRIER",
      role: null,
    });
  });

  it("offers any role plus the carrier roles for the trip's carrier", () => {
    const onChange = renderPicker({ scope: "TRIP_CARRIER", role: null });
    const role = screen.getByLabelText("A quién · rol");
    expect(options(role)).toEqual([
      ["", "Cualquier rol"],
      ["Gerente de Seguridad", "Gerente de Seguridad · 4 contactos"],
      ["Oficina Comercial", "Oficina Comercial · 1 contacto"],
    ]);
    fireEvent.change(role, { target: { value: "Gerente de Seguridad" } });
    expect(onChange).toHaveBeenCalledWith({
      scope: "TRIP_CARRIER",
      role: "Gerente de Seguridad",
    });
  });

  it("offers the organization's own roles for the organization", () => {
    renderPicker({ scope: "ORG", role: "jefe de torre" });
    const role = screen.getByLabelText("A quién · rol") as HTMLSelectElement;
    expect(options(role)).toEqual([
      ["", "Elegir rol"],
      ["Jefe de Torre", "Jefe de Torre · 2 contactos"],
    ]);
    expect(role.value).toBe("Jefe de Torre");
  });

  it("keeps a saved role the scope no longer has", () => {
    renderPicker({ scope: "ORG", role: "Supervisor" });
    expect(
      (screen.getByLabelText("A quién · rol") as HTMLSelectElement).value
    ).toBe("Supervisor");
  });
});

describe("roleMissing", () => {
  it("flags a role its scope does not have, never the driver or any carrier role", () => {
    expect(roleMissing({ scope: "ORG", role: "Supervisor" }, ROLES)).toBe(true);
    expect(
      roleMissing({ scope: "ORG", role: "Gerente de Seguridad" }, ROLES)
    ).toBe(true);
    expect(
      roleMissing(
        { scope: "TRIP_CARRIER", role: "Gerente de Seguridad" },
        ROLES
      )
    ).toBe(false);
    expect(roleMissing({ scope: "TRIP_CARRIER", role: null }, ROLES)).toBe(
      false
    );
    expect(roleMissing({ scope: "DRIVER", role: null }, ROLES)).toBe(false);
    expect(roleMissing({ scope: "ORG", role: "Supervisor" }, undefined)).toBe(
      false
    );
  });
});

describe("LevelSteps target picker", () => {
  it("reads older steps, keeps an unknown role and warns about it", () => {
    const onChange = vi.fn();
    render(
      <LevelSteps
        steps={[
          { role: "Conductor", channel: "call", budgetMinutes: 2, script: "" },
          {
            role: "Transportista",
            channel: "call",
            budgetMinutes: 2,
            script: "",
          },
          { role: "Supervisor", channel: "call", budgetMinutes: 2, script: "" },
        ]}
        slaMinutes={10}
        roles={ROLES}
        readOnly={false}
        d={d}
        onChange={onChange}
      />
    );
    const scopes = screen.getAllByLabelText(
      "A quién · de"
    ) as HTMLSelectElement[];
    expect(scopes.map((s) => s.value)).toEqual([
      "DRIVER",
      "TRIP_CARRIER",
      "ORG",
    ]);
    const roles = screen.getAllByLabelText(
      "A quién · rol"
    ) as HTMLSelectElement[];
    expect(roles.map((s) => s.value)).toEqual(["", "Supervisor"]);
    expect(screen.getAllByText("Rol sin contactos en la libreta")).toHaveLength(
      1
    );

    fireEvent.change(roles[0]!, { target: { value: "Oficina Comercial" } });
    expect(onChange.mock.calls[0]?.[0][1]).toEqual({
      role: "Oficina Comercial",
      scope: "TRIP_CARRIER",
      channel: "call",
      budgetMinutes: 2,
      script: "",
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

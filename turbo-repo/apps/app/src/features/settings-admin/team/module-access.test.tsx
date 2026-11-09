import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { ModuleCard } from "./module-access";
import type { AccessCatalog, CatalogModule } from "./team.types";

const d = {
  moduleNone: "Sin acceso",
  moduleNoneHelp: "No ve este módulo.",
  includedByBase: "Incluido",
} as unknown as I18nRecord;

const catalog: AccessCatalog = {
  baseRoles: ["MEMBER", "ADMIN", "OWNER"],
  modules: [],
  permissions: [
    {
      key: "places:view",
      module: "places",
      label: { es: "Ver lugares" },
      explicitOnly: false,
      ownerOnly: false,
    },
    {
      key: "places:write",
      module: "places",
      label: { es: "Editar lugares" },
      explicitOnly: false,
      ownerOnly: false,
    },
    {
      key: "fleet:assets.view",
      module: "fleet",
      label: { es: "Ver flota" },
      explicitOnly: false,
      ownerOnly: false,
    },
  ],
  roles: [
    {
      key: "PLACES_VIEWER",
      module: "places",
      label: { es: "Lector" },
      permissions: ["places:view"],
      memberDefault: true,
    },
    {
      key: "PLACES_MAINTAINER",
      module: "places",
      label: { es: "Mantenedor" },
      permissions: ["places:view", "places:write"],
    },
    {
      key: "FLEET_VIEWER",
      module: "fleet",
      label: { es: "Lector de flota" },
      permissions: ["fleet:assets.view"],
    },
  ],
};

const lugares: CatalogModule = {
  key: "places",
  label: { es: "Lugares" },
  description: {},
  ai: false,
};
const flota: CatalogModule = {
  key: "fleet",
  label: { es: "Flota" },
  description: {},
  ai: false,
};

function renderCard(mod: CatalogModule, value: string) {
  const onChange = vi.fn();
  render(
    <ModuleCard
      mod={mod}
      roles={catalog.roles.filter((r) => r.module === mod.key)}
      catalog={catalog}
      value={value}
      includedByBase={false}
      disabled={false}
      lang="es"
      d={d}
      onChange={onChange}
    />
  );
  return onChange;
}

describe("ModuleCard", () => {
  it("offers only Lector and Mantenedor for Lugares, Lector when no role is held", () => {
    renderCard(lugares, "");
    expect(screen.queryByText("Sin acceso")).toBeNull();
    expect(screen.getByRole("radio", { name: /Lector/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Mantenedor/ })).not.toBeChecked();
  });

  it("assigns Mantenedor, and back to Lector by dropping the explicit role", () => {
    const onChange = renderCard(lugares, "PLACES_MAINTAINER");
    expect(screen.getByRole("radio", { name: /Mantenedor/ })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /Lector/ }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("keeps no access for a module without a member default", () => {
    const onChange = renderCard(flota, "");
    expect(screen.getByRole("radio", { name: /Sin acceso/ })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /Lector de flota/ }));
    expect(onChange).toHaveBeenLastCalledWith("FLEET_VIEWER");
  });
});

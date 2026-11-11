import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import en from "@/lang/en.json";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { AccessCatalog, CustomRole } from "./team.types";

const api = vi.hoisted(() => ({
  roles: [] as unknown[],
  createCustomRole: vi.fn(),
  updateCustomRole: vi.fn(),
  deleteCustomRole: vi.fn(),
  refreshTeamData: vi.fn(),
}));

vi.mock("./team-api", () => ({
  useCustomRoles: () => ({ data: api.roles }),
  createCustomRole: api.createCustomRole,
  updateCustomRole: api.updateCustomRole,
  deleteCustomRole: api.deleteCustomRole,
  refreshTeamData: api.refreshTeamData,
}));

import { CustomRolesSection } from "./custom-roles-section";
import { CustomRolesCard } from "./module-access";
import { withCustomRoles } from "./team-model";

const catalog: AccessCatalog = {
  baseRoles: ["OWNER", "ADMIN", "MEMBER"],
  modules: [
    {
      key: "coordination",
      label: { es: "Coordinación de envíos", en: "Shipping coordination" },
      description: {},
      ai: false,
    },
  ],
  permissions: [
    {
      key: "coordination:kanban.view",
      module: "coordination",
      label: { es: "Ver el tablero de envíos", en: "View the shipping board" },
      explicitOnly: false,
      ownerOnly: false,
    },
    {
      key: "coordination:geographic.view",
      module: "coordination",
      label: { es: "Ver la vista geográfica", en: "View the geographic view" },
      explicitOnly: false,
      ownerOnly: false,
    },
    {
      key: "coordination:stage.escalation",
      module: "coordination",
      label: { es: "Atender escalamientos", en: "Handle escalations" },
      explicitOnly: true,
      ownerOnly: false,
    },
    {
      key: "owners:manage",
      module: "owners",
      label: { es: "Administrar propietarios", en: "Manage owners" },
      explicitOnly: false,
      ownerOnly: true,
    },
  ],
  roles: [
    {
      key: "REVIEWER",
      module: "coordination",
      label: { es: "Revisor", en: "Reviewer" },
      permissions: ["coordination:kanban.view", "coordination:geographic.view"],
    },
  ],
};

const supervisor: CustomRole = {
  id: "11111111-1111-1111-1111-111111111111",
  key: "custom:supervisor",
  label: { es: "Supervisor", en: "Supervisor" },
  description: { es: "Ve el mapa." },
  permissions: ["coordination:geographic.view"],
  holders: { members: 3, teams: 2, serviceAccounts: 1, clients: 0 },
  createdAt: "2026-01-01T00:00:00Z",
  createdBy: null,
  updatedAt: "2026-01-01T00:00:00Z",
  updatedBy: null,
};

const d = es.pages.userSettings.team as unknown as I18nRecord;
/** An Admin: holds everything except owner-only permissions. */
const adminCan = (permission: string) => permission !== "owners:manage";

function renderSection(canManage: boolean, dict: I18nRecord = d, lang = "es") {
  render(
    <CustomRolesSection
      catalog={catalog}
      canManage={canManage}
      can={adminCan}
      lang={lang}
      d={dict}
    />
  );
}

beforeEach(() => {
  api.roles = [supervisor];
  vi.clearAllMocks();
  api.createCustomRole.mockResolvedValue(supervisor);
  api.updateCustomRole.mockResolvedValue(supervisor);
  api.deleteCustomRole.mockResolvedValue({
    key: supervisor.key,
    removedBindings: 6,
    holders: supervisor.holders,
  });
});

describe("CustomRolesSection", () => {
  it("lists custom roles, marked as such, with who holds them", () => {
    renderSection(false);
    const row = screen.getByRole("row", { name: /Supervisor/ });
    expect(within(row).getByText("Personalizado")).toBeInTheDocument();
    expect(within(row).getByText("Permisos: 1")).toBeInTheDocument();
    expect(
      within(row).getByText("Miembros: 3 · Equipos: 2 · Cuentas de servicio: 1")
    ).toBeInTheDocument();
  });

  it("hides create, edit and delete from a caller who is not an owner or admin", () => {
    renderSection(false);
    expect(screen.queryByRole("button", { name: "Nuevo rol" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Eliminar" })).toBeNull();
  });

  it("shows create, edit and delete to an owner or admin", () => {
    renderSection(true);
    expect(screen.getByRole("button", { name: "Nuevo rol" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Editar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled();
  });

  it("says there are none, in the page's language", () => {
    api.roles = [];
    renderSection(
      false,
      en.pages.userSettings.team as unknown as I18nRecord,
      "en"
    );
    expect(
      screen.getByText("The organization has no custom roles.")
    ).toBeInTheDocument();
  });

  it("confirms a delete saying how many members and teams lose the role", async () => {
    renderSection(true);
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(
        "Al eliminar Supervisor, estos titulares pierden el rol. Miembros: 3; equipos: 2; cuentas de servicio: 1."
      )
    ).toBeInTheDocument();
    expect(api.deleteCustomRole).not.toHaveBeenCalled();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Eliminar" })
    );
    await waitFor(() =>
      expect(api.deleteCustomRole).toHaveBeenCalledWith(supervisor.id)
    );
    expect(api.refreshTeamData).toHaveBeenCalled();
  });

  it("creates a role from a name and the ticked permissions", async () => {
    api.roles = [];
    renderSection(true);
    await userEvent.click(screen.getByRole("button", { name: "Nuevo rol" }));
    const dialog = await screen.findByRole("dialog");

    // Without a name or a permission nothing is sent.
    const name = within(dialog).getByLabelText("Nombre (español)");
    await userEvent.type(name, " ");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Crear" })
    );
    expect(
      within(dialog).getByText("El nombre es obligatorio.")
    ).toBeInTheDocument();
    await userEvent.type(name, "Supervisor de ruta ");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Crear" })
    );
    expect(
      within(dialog).getByText("Elige al menos un permiso.")
    ).toBeInTheDocument();
    expect(api.createCustomRole).not.toHaveBeenCalled();

    await userEvent.click(
      within(dialog).getByLabelText("Ver la vista geográfica")
    );
    await userEvent.click(
      within(dialog).getByLabelText(/Atender escalamientos/)
    );
    expect(within(dialog).getByText("Permisos: 2")).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Crear" })
    );

    await waitFor(() =>
      expect(api.createCustomRole).toHaveBeenCalledWith({
        label: { es: "Supervisor de ruta", en: "Supervisor de ruta" },
        description: {},
        permissions: [
          "coordination:geographic.view",
          "coordination:stage.escalation",
        ],
      })
    );
    expect(api.refreshTeamData).toHaveBeenCalled();
  });

  it("groups the picker by module and blocks permissions the caller cannot give", async () => {
    api.roles = [];
    renderSection(true);
    await userEvent.click(screen.getByRole("button", { name: "Nuevo rol" }));
    const dialog = await screen.findByRole("dialog");

    // Module names come from the catalog, else from the dictionary.
    const coordination = within(dialog).getByRole("group", {
      name: "Coordinación de envíos",
    });
    const owners = within(dialog).getByRole("group", { name: "Propietarios" });
    expect(
      within(owners).getByLabelText(/Administrar propietarios/)
    ).toBeDisabled();
    // An explicit-only permission is given without holding it.
    expect(
      within(coordination).getByLabelText(/Atender escalamientos/)
    ).toBeEnabled();

    // The module checkbox ticks every permission of the module the caller can give.
    await userEvent.click(
      within(coordination).getByLabelText("Coordinación de envíos")
    );
    expect(within(dialog).getByText("Permisos: 3")).toBeInTheDocument();

    await userEvent.type(
      within(dialog).getByLabelText("Buscar permisos o módulos"),
      "geográfica"
    );
    expect(
      within(dialog).queryByLabelText("Ver el tablero de envíos")
    ).toBeNull();
    expect(
      within(dialog).getByLabelText("Ver la vista geográfica")
    ).toBeChecked();
  });

  it("edits a role, keeping a permission it already has", async () => {
    api.roles = [{ ...supervisor, permissions: ["owners:manage"] }];
    renderSection(true);
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Nombre (español)")).toHaveValue(
      "Supervisor"
    );
    // Already in the role, so the admin may leave it or remove it.
    expect(
      within(dialog).getByLabelText(/Administrar propietarios/)
    ).toBeEnabled();
    await userEvent.click(
      within(dialog).getByLabelText("Ver el tablero de envíos")
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Guardar" })
    );
    await waitFor(() =>
      expect(api.updateCustomRole).toHaveBeenCalledWith(supervisor.id, {
        label: { es: "Supervisor", en: "Supervisor" },
        description: { es: "Ve el mapa." },
        permissions: ["coordination:kanban.view", "owners:manage"],
      })
    );
  });
});

describe("CustomRolesCard", () => {
  const merged = withCustomRoles(catalog, [supervisor]);
  const custom = merged.roles.filter((r) => r.custom);

  it("renders nothing when the organization has no custom roles", () => {
    const { container } = render(
      <CustomRolesCard
        roles={[]}
        catalog={catalog}
        selection={{}}
        disabled={false}
        lang="es"
        d={d}
        onChange={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("adds a ticked custom role next to the module roles already chosen", async () => {
    const onChange = vi.fn();
    render(
      <CustomRolesCard
        roles={custom}
        catalog={merged}
        selection={{ coordination: "REVIEWER" }}
        disabled={false}
        lang="es"
        d={d}
        onChange={onChange}
      />
    );
    expect(screen.getByText("Ver la vista geográfica")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/Supervisor/));
    expect(onChange).toHaveBeenCalledWith({
      coordination: "REVIEWER",
      "custom:supervisor": "custom:supervisor",
    });
  });
});

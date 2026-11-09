import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/lang/en.json";
import es from "@/lang/es.json";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type {
  CatalogPermission,
  CatalogRole,
  Invitation,
  ServiceAccount,
  Team,
  TeamMember,
} from "./team.types";

const data = vi.hoisted(() => {
  const member = (
    over: Partial<TeamMember> & { userId: string }
  ): TeamMember => ({
    email: `${over.userId}@example.test`,
    name: null,
    baseRole: "MEMBER",
    status: "ACTIVE",
    source: "NATIVE",
    roles: [],
    joinedAt: "2026-01-01T00:00:00Z",
    lastSeenAt: null,
    ...over,
  });
  const members: TeamMember[] = [
    member({ userId: "u1", name: "Member Alpha", baseRole: "OWNER" }),
    member({
      userId: "u2",
      name: "Member Beta",
      baseRole: "ADMIN",
      roles: ["TOWER_OPERATOR"],
    }),
    member({
      userId: "u3",
      name: "Member Gamma",
      roles: ["TOWER_OPERATOR"],
      status: "SUSPENDED",
    }),
  ];
  const roles: CatalogRole[] = [
    {
      key: "TOWER_OPERATOR",
      module: "tower",
      label: { en: "Tower operator" },
      permissions: [],
    },
  ];
  const teams: Team[] = [
    {
      id: "t1",
      name: "Night shift",
      description: null,
      source: "NATIVE",
      members: ["u1", "u3"],
      roles: [],
      createdAt: "2026-01-01T00:00:00Z",
    },
  ];
  const permissions: CatalogPermission[] = [
    {
      key: "tower:read",
      module: "tower",
      label: { en: "Read tower", es: "Leer torre" },
      explicitOnly: false,
      ownerOnly: false,
    },
    {
      key: "trips:read",
      module: "trips",
      label: { en: "Read trips", es: "Leer viajes" },
      explicitOnly: false,
      ownerOnly: false,
    },
  ];
  const invitations: Invitation[] = ["alpha", "beta"].map((id) => ({
    id,
    email: `${id}@example.test`,
    baseRole: "MEMBER",
    roles: [],
    invitedBy: "inviter@example.test",
    createdAt: "2026-01-01T00:00:00Z",
    expiresAt: "2026-01-08T00:00:00Z",
    expired: true,
    organization: "example-organization",
  }));
  const accounts: ServiceAccount[] = ["alpha", "beta"].map((id) => ({
    id,
    name: `Account ${id}`,
    description: null,
    disabled: false,
    roles: [],
    keys: [],
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: null,
    tokenCredentialRef: null,
  }));
  return {
    members,
    roles,
    teams,
    permissions,
    invitations,
    accounts,
    canManageKeys: true,
  };
});

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { email: "u1@example.test" } } }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/features/common/components/Breadcrumb/Breadcrumb", () => ({
  Breadcrumb: () => null,
}));
vi.mock("./team-api", () => ({
  useMyAccess: () => ({
    can: (permission: string) =>
      permission !== "apikeys:manage" || data.canManageKeys,
  }),
  useTeam: () => ({
    data: { organization: "example-organization", members: data.members },
    mutate: vi.fn(),
  }),
  useInvitations: () => ({ data: data.invitations, mutate: vi.fn() }),
  useTeams: () => ({ data: data.teams, mutate: vi.fn() }),
  useServiceAccounts: () => ({ data: data.accounts, mutate: vi.fn() }),
  useAccessCatalog: () => ({
    data: { baseRoles: [], permissions: data.permissions, roles: data.roles },
  }),
  removeMember: vi.fn(),
  resendInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
  setBaseRole: vi.fn(),
  deleteTeam: vi.fn(),
}));

import TeamPageContent from "./team-page-content";

function renderPage(lang = "en") {
  const dictionary = lang === "es" ? es : en;
  render(
    <TeamPageContent
      dict={dictionary.pages.userSettings as unknown as I18nRecord}
      rootDict={dictionary as unknown as I18nRecord}
      lang={lang}
    />
  );
}

function shownNames() {
  const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
  return rows.map((row) => within(row).getAllByRole("cell")[0].textContent);
}

/** Opens a filter badge and picks one option, as a user would. */
async function pick(badge: string, option: string) {
  await userEvent.click(screen.getByRole("button", { name: badge }));
  fireEvent.mouseDown(screen.getByRole("button", { name: option }));
  await userEvent.click(screen.getByRole("heading", { name: "Team" }));
}

beforeEach(() => {
  data.members[1].source = "NATIVE";
  data.canManageKeys = true;
});

describe("TeamPageContent members filters", () => {
  it("lists every member with the total count", () => {
    renderPage();
    expect(shownNames()).toEqual([
      "Member AlphaYou",
      "Member Beta",
      "Member Gamma",
    ]);
    expect(screen.getByText("3 of 3")).toBeInTheDocument();
  });

  it("searches by name", async () => {
    renderPage();
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search by name or email" }),
      "beta"
    );
    expect(shownNames()).toEqual(["Member Beta"]);
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
  });

  it("filters by module role and team together, then clears", async () => {
    renderPage();
    await pick("Module role", "Tower operator");
    expect(shownNames()).toEqual(["Member Beta", "Member Gamma"]);
    await pick("Team", "Night shift");
    expect(shownNames()).toEqual(["Member Gamma"]);

    await userEvent.click(
      screen.getByRole("button", { name: "Clear filters" })
    );
    expect(shownNames()).toHaveLength(3);
  });

  it("filters by status from the values the members have", async () => {
    renderPage();
    await pick("Status", "Suspended");
    expect(shownNames()).toEqual(["Member Gamma"]);
  });

  it("says nothing matches and offers to clear", async () => {
    renderPage();
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search by name or email" }),
      "nobody"
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.getByText("No results match the filters.")
    ).toBeInTheDocument();
    expect(screen.getByText("0 of 3")).toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Clear filters" })[1]
    );
    expect(shownNames()).toHaveLength(3);
  });

  it("hides a filter with a single option", () => {
    renderPage();
    // Every member is NATIVE, so there is nothing to pick by source.
    expect(
      screen.queryByRole("button", { name: "Source" })
    ).not.toBeInTheDocument();
  });

  it("searches by email and clears the search", async () => {
    renderPage();
    await userEvent.type(screen.getByRole("searchbox"), "u2@");
    expect(shownNames()).toEqual(["Member Beta"]);
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(shownNames()).toHaveLength(3);
  });

  it("filters by base role and source together", async () => {
    data.members[1].source = "ALFRESCO";
    renderPage();
    await pick("Source", "Alfresco");
    await pick("Base role", "Admin");
    expect(shownNames()).toEqual(["Member Beta"]);
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
  });

  it("keeps member filters when switching tabs", async () => {
    renderPage();
    await userEvent.type(screen.getByRole("searchbox"), "beta");
    await userEvent.click(screen.getByRole("button", { name: "Teams" }));
    await userEvent.click(screen.getByRole("button", { name: "Members" }));
    expect(shownNames()).toEqual(["Member Beta"]);
    expect(screen.getByRole("searchbox")).toHaveValue("beta");
  });

  it("localizes search actions and counts in Spanish", async () => {
    renderPage("es");
    await userEvent.type(screen.getByRole("searchbox"), "u2@");
    expect(screen.getByText("1 de 3")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Limpiar búsqueda" })
    );
    expect(screen.getByText("3 de 3")).toBeInTheDocument();
  });
});

describe("TeamPageContent other tab searches", () => {
  it.each([
    [
      "Invitations",
      "alpha@",
      "alpha@example.test",
      "beta@example.test",
      "1 of 2",
    ],
    ["Teams", "night", "Night shift", null, "1 of 1"],
    ["API keys", "alpha", "Account alpha", "Account beta", "1 of 2"],
    ["Roles", "tower", "Read tower", "Read trips", "1 of 2"],
  ])(
    "searches the %s tab and shows a no-match state",
    async (tab, query, match, excluded, count) => {
      renderPage();
      await userEvent.click(screen.getByRole("button", { name: tab }));
      await userEvent.type(screen.getByRole("searchbox"), query);
      expect(
        within(screen.getByRole("table")).getByText(match)
      ).toBeInTheDocument();
      if (excluded)
        expect(screen.queryByText(excluded)).not.toBeInTheDocument();
      expect(screen.getByText(count)).toBeInTheDocument();
      await userEvent.type(screen.getByRole("searchbox"), "zzz");
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(
        screen.getByText("No results match the filters.")
      ).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole("button", { name: "Clear search" })
      );
      expect(screen.getByRole("table")).toBeInTheDocument();
    }
  );

  it("hides API keys without its permission", () => {
    data.canManageKeys = false;
    renderPage();
    expect(
      screen.queryByRole("button", { name: "API keys" })
    ).not.toBeInTheDocument();
  });
});

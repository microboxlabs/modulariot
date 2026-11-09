import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import en from "@/lang/en.json";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { CatalogRole, Team, TeamMember } from "./team.types";

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
    member({ userId: "u1", name: "Ana Pérez", baseRole: "OWNER" }),
    member({
      userId: "u2",
      name: "Bruno Soto",
      baseRole: "ADMIN",
      roles: ["TOWER_OPERATOR"],
    }),
    member({
      userId: "u3",
      name: "Carla Ruiz",
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
  return { members, roles, teams };
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
  useMyAccess: () => ({ can: () => true }),
  useTeam: () => ({
    data: { organization: "acme", members: data.members },
    mutate: vi.fn(),
  }),
  useInvitations: () => ({ data: [], mutate: vi.fn() }),
  useTeams: () => ({ data: data.teams, mutate: vi.fn() }),
  useServiceAccounts: () => ({ data: [], mutate: vi.fn() }),
  useAccessCatalog: () => ({
    data: { baseRoles: [], permissions: [], roles: data.roles },
  }),
  removeMember: vi.fn(),
  resendInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
  setBaseRole: vi.fn(),
  deleteTeam: vi.fn(),
}));

import TeamPageContent from "./team-page-content";

const dict = en.pages.userSettings as unknown as I18nRecord;
const rootDict = en as unknown as I18nRecord;

function renderPage() {
  render(<TeamPageContent dict={dict} rootDict={rootDict} lang="en" />);
}

function shownNames() {
  const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
  return rows.map((row) => within(row).getAllByRole("cell")[0].textContent);
}

/** Opens a filter badge and picks one option, as a user would. */
async function pick(badge: string, option: string) {
  await userEvent.click(screen.getByRole("button", { name: badge }));
  fireEvent.mouseDown(screen.getByRole("button", { name: option }));
}

describe("TeamPageContent members filters", () => {
  it("lists every member with the total count", () => {
    renderPage();
    expect(shownNames()).toEqual(["Ana PérezYou", "Bruno Soto", "Carla Ruiz"]);
    expect(screen.getByText("3 of 3")).toBeInTheDocument();
  });

  it("searches by name", async () => {
    renderPage();
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search by name or email" }),
      "bruno"
    );
    expect(shownNames()).toEqual(["Bruno Soto"]);
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
  });

  it("filters by module role and team together, then clears", async () => {
    renderPage();
    await pick("Module role", "Tower operator");
    expect(shownNames()).toEqual(["Bruno Soto", "Carla Ruiz"]);
    await pick("Team", "Night shift");
    expect(shownNames()).toEqual(["Carla Ruiz"]);

    await userEvent.click(
      screen.getByRole("button", { name: "Clear filters" })
    );
    expect(shownNames()).toHaveLength(3);
  });

  it("filters by status from the values the members have", async () => {
    renderPage();
    await pick("Status", "Suspended");
    expect(shownNames()).toEqual(["Carla Ruiz"]);
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
  });

  it("hides a filter with a single option", () => {
    renderPage();
    // Every member is NATIVE, so there is nothing to pick by source.
    expect(
      screen.queryByRole("button", { name: "Source" })
    ).not.toBeInTheDocument();
  });
});

import { describe, expect, it } from "vitest";
import {
  distinctValues,
  filterInvitations,
  filterMembers,
  filterPermissions,
  filterServiceAccounts,
  filterTeams,
  heldRoles,
  isFilteringMembers,
  matchesText,
  NO_MEMBER_FILTERS,
  teamsByUser,
  type MemberFilters,
} from "./team-filters";
import type {
  Invitation,
  ServiceAccount,
  Team,
  TeamMember,
} from "./team.types";

function member(over: Partial<TeamMember> & { userId: string }): TeamMember {
  return {
    email: `${over.userId}@example.test`,
    name: null,
    baseRole: "MEMBER",
    status: "ACTIVE",
    source: "NATIVE",
    roles: [],
    joinedAt: "2026-01-01T00:00:00Z",
    lastSeenAt: null,
    ...over,
  };
}

const alpha = member({
  userId: "u1",
  name: "Member Álpha",
  email: "alpha@example.test",
  baseRole: "OWNER",
  roles: ["CONTROL_TOWER_OPERATOR"],
});
const beta = member({
  userId: "u2",
  name: "Member Beta",
  baseRole: "ADMIN",
  roles: ["CONTROL_TOWER_OPERATOR", "TRIPS_VIEWER"],
  source: "ALFRESCO",
});
const gamma = member({
  userId: "u3",
  name: null,
  email: "gamma@example.test",
  status: "SUSPENDED",
  source: "TOKEN",
});
const members = [alpha, beta, gamma];

const team = (id: string, memberIds: string[]): Team => ({
  id,
  name: `Team ${id}`,
  description: null,
  source: "NATIVE",
  members: memberIds,
  roles: [],
  createdAt: "2026-01-01T00:00:00Z",
});
const teams = [team("night", ["u1", "u3"]), team("day", ["u2"])];

const ids = (list: TeamMember[]) => list.map((m) => m.userId);
const withFilters = (over: Partial<MemberFilters>) =>
  filterMembers(members, { ...NO_MEMBER_FILTERS, ...over }, teams);

describe("matchesText", () => {
  it("matches every word in any field, ignoring case and accents", () => {
    expect(matchesText("ALPHA member", ["Member Álpha", null])).toBe(true);
    expect(
      matchesText("alpha missing", ["Member Álpha", "alpha@example.test"])
    ).toBe(false);
  });

  it("passes everything for a blank query", () => {
    expect(matchesText("   ", [null])).toBe(true);
  });
});

describe("filterMembers", () => {
  it("returns every member without filters", () => {
    expect(ids(filterMembers(members, NO_MEMBER_FILTERS))).toEqual([
      "u1",
      "u2",
      "u3",
    ]);
  });

  it("searches name and email", () => {
    expect(ids(withFilters({ query: "beta" }))).toEqual(["u2"]);
    expect(ids(withFilters({ query: "gamma@" }))).toEqual(["u3"]);
  });

  it("filters by base role, any of the picked ones", () => {
    expect(ids(withFilters({ baseRoles: ["OWNER", "ADMIN"] }))).toEqual([
      "u1",
      "u2",
    ]);
  });

  it("filters by module role, any of the picked ones", () => {
    expect(ids(withFilters({ roles: ["CONTROL_TOWER_OPERATOR"] }))).toEqual([
      "u1",
      "u2",
    ]);
    expect(ids(withFilters({ roles: ["TRIPS_VIEWER"] }))).toEqual(["u2"]);
  });

  it("filters by status and source", () => {
    expect(ids(withFilters({ statuses: ["SUSPENDED"] }))).toEqual(["u3"]);
    expect(ids(withFilters({ sources: ["ALFRESCO", "TOKEN"] }))).toEqual([
      "u2",
      "u3",
    ]);
  });

  it("filters by team membership", () => {
    expect(ids(withFilters({ teams: ["night"] }))).toEqual(["u1", "u3"]);
  });

  it("combines filters with AND", () => {
    expect(
      ids(
        withFilters({
          roles: ["CONTROL_TOWER_OPERATOR"],
          teams: ["night"],
          query: "alpha",
        })
      )
    ).toEqual(["u1"]);
  });

  it("returns nothing when no member passes", () => {
    expect(
      withFilters({ baseRoles: ["OWNER"], statuses: ["SUSPENDED"] })
    ).toEqual([]);
    expect(withFilters({ query: "nobody" })).toEqual([]);
  });
});

describe("member filter helpers", () => {
  it("says whether any filter is set", () => {
    expect(isFilteringMembers(NO_MEMBER_FILTERS)).toBe(false);
    expect(isFilteringMembers({ ...NO_MEMBER_FILTERS, query: " " })).toBe(
      false
    );
    expect(isFilteringMembers({ ...NO_MEMBER_FILTERS, teams: ["x"] })).toBe(
      true
    );
  });

  it("lists distinct statuses, sources and held roles", () => {
    expect(distinctValues(members, "status")).toEqual(["ACTIVE", "SUSPENDED"]);
    expect(distinctValues(members, "source")).toEqual([
      "ALFRESCO",
      "NATIVE",
      "TOKEN",
    ]);
    expect(heldRoles(members)).toEqual([
      "CONTROL_TOWER_OPERATOR",
      "TRIPS_VIEWER",
    ]);
  });

  it("maps users to their teams", () => {
    expect(teamsByUser(teams).get("u1")).toEqual(["night"]);
    expect(teamsByUser(teams).get("u9")).toBeUndefined();
  });
});

describe("search on the other tabs", () => {
  it("searches permission keys, modules and translated labels", () => {
    const list = [
      {
        key: "tower:read",
        module: "tower",
        label: { en: "Read tower", es: "Leer torre" },
        explicitOnly: false,
        ownerOnly: false,
      },
    ];
    for (const query of ["tower:read", "tower", "Leer torre", "READ"]) {
      expect(filterPermissions(list, query)).toEqual(list);
    }
    expect(filterPermissions(list, "missing")).toEqual([]);
    expect(filterPermissions(list, "  ")).toEqual(list);
  });
  it("searches invitations by email and inviter", () => {
    const invitation = (id: string, email: string, invitedBy: string) =>
      ({ id, email, invitedBy }) as Invitation;
    const list = [
      invitation("i1", "new.one@example.test", "admin@example.test"),
      invitation("i2", "other@example.test", "boss@example.test"),
    ];
    expect(filterInvitations(list, "new.one").map((i) => i.id)).toEqual(["i1"]);
    expect(filterInvitations(list, "boss").map((i) => i.id)).toEqual(["i2"]);
  });

  it("searches teams by name and description", () => {
    const list = [
      { ...team("a", []), name: "Night shift" },
      { ...team("b", []), description: "Handles the day shift" },
    ];
    expect(filterTeams(list, "night").map((t) => t.id)).toEqual(["a"]);
    expect(filterTeams(list, "day").map((t) => t.id)).toEqual(["b"]);
  });

  it("searches service accounts by name, description and keys", () => {
    const account = (id: string, name: string, keyName: string) =>
      ({
        id,
        name,
        description: null,
        keys: [{ name: keyName, keyId: `key_${id}` }],
      }) as unknown as ServiceAccount;
    const list = [account("s1", "Feed", "prod"), account("s2", "Sync", "ci")];
    expect(filterServiceAccounts(list, "sync").map((a) => a.id)).toEqual([
      "s2",
    ]);
    expect(filterServiceAccounts(list, "key_s1").map((a) => a.id)).toEqual([
      "s1",
    ]);
    expect(filterServiceAccounts(list, "zzz")).toEqual([]);
  });
});

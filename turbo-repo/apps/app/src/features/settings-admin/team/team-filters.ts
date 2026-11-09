import type {
  Invitation,
  ServiceAccount,
  Team,
  TeamMember,
} from "./team.types";

/** The Members tab filters. An empty list does not filter. */
export interface MemberFilters {
  query: string;
  baseRoles: readonly string[];
  /** Module role keys; a member passes when they hold any of them. */
  roles: readonly string[];
  statuses: readonly string[];
  sources: readonly string[];
  /** Team ids; a member passes when they belong to any of them. */
  teams: readonly string[];
}

export const NO_MEMBER_FILTERS: MemberFilters = {
  query: "",
  baseRoles: [],
  roles: [],
  statuses: [],
  sources: [],
  teams: [],
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** True when every word of `query` appears in one of `fields`, ignoring case and accents. */
export function matchesText(
  query: string,
  fields: readonly (string | null | undefined)[]
): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = normalize(fields.filter(Boolean).join(" "));
  return words.every((w) => text.includes(w));
}

function passes(values: readonly string[], value: string): boolean {
  return values.length === 0 || values.includes(value);
}

function holdsAny(values: readonly string[], held: readonly string[]) {
  return values.length === 0 || values.some((v) => held.includes(v));
}

export function isFilteringMembers(filters: MemberFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.baseRoles.length +
      filters.roles.length +
      filters.statuses.length +
      filters.sources.length +
      filters.teams.length >
      0
  );
}

/** The team ids each user belongs to. */
export function teamsByUser(teams: readonly Team[]): Map<string, string[]> {
  const byUser = new Map<string, string[]>();
  for (const team of teams) {
    for (const userId of team.members) {
      byUser.set(userId, [...(byUser.get(userId) ?? []), team.id]);
    }
  }
  return byUser;
}

/**
 * The members that pass every filter. Values inside one filter are OR,
 * different filters are AND.
 */
export function filterMembers(
  members: readonly TeamMember[],
  filters: MemberFilters,
  teams: readonly Team[] = []
): TeamMember[] {
  const byUser = teamsByUser(teams);
  return members.filter(
    (m) =>
      matchesText(filters.query, [m.name, m.email]) &&
      passes(filters.baseRoles, m.baseRole) &&
      holdsAny(filters.roles, m.roles) &&
      passes(filters.statuses, m.status) &&
      passes(filters.sources, m.source) &&
      holdsAny(filters.teams, byUser.get(m.userId) ?? [])
  );
}

/** The distinct values of a member field, sorted, for filter options. */
export function distinctValues(
  members: readonly TeamMember[],
  field: "status" | "source"
): string[] {
  return [...new Set(members.map((m) => m[field]).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b)
  );
}

/** The module role keys held by any member, so the role filter lists them even if the catalog lacks one. */
export function heldRoles(members: readonly TeamMember[]): string[] {
  return [...new Set(members.flatMap((m) => m.roles))];
}

export function filterInvitations(
  invitations: readonly Invitation[],
  query: string
): Invitation[] {
  return invitations.filter((i) => matchesText(query, [i.email, i.invitedBy]));
}

export function filterTeams(teams: readonly Team[], query: string): Team[] {
  return teams.filter((t) => matchesText(query, [t.name, t.description]));
}

export function filterServiceAccounts(
  accounts: readonly ServiceAccount[],
  query: string
): ServiceAccount[] {
  return accounts.filter((a) =>
    matchesText(query, [
      a.name,
      a.description,
      ...a.keys.flatMap((k) => [k.name, k.keyId]),
    ])
  );
}

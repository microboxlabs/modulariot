"use client";

import { useMemo } from "react";
import { z } from "zod";
import { useTeam, useTeams } from "@/features/settings-admin/team/team-api";

export type PrincipalKind = "member" | "team";

/** Someone, or a team, a dashboard can be shared with. */
export interface Principal {
  /** What a permission names: a member's email, or `team:<id>`. */
  authorityId: string;
  kind: PrincipalKind;
  name: string;
  /** A member's email when the name is shown; a team's member count. */
  detail?: string;
  /** For a team: how many members it has. */
  size?: number;
}

/**
 * How a team is named in a dashboard permission. The modulith asserts the
 * caller's teams under the same name, so the dashboard server matches them.
 */
export const TEAM_AUTHORITY_PREFIX = "team:";

export function teamAuthority(teamId: string): string {
  return `${TEAM_AUTHORITY_PREFIX}${teamId}`;
}

const EMPTY: Principal[] = [];

// Validate the fields this view consumes; each response can fail independently.
const membersSchema = z.object({
  members: z.array(
    z.object({
      email: z.string().nullish(),
      name: z.string().nullish(),
    })
  ),
});
const teamsSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    members: z.array(z.string()),
  })
);

/**
 * The organization's members and teams, from Settings › Equipo. A caller who
 * may not list them gets an empty directory, and can still add an email.
 */
export function usePrincipalDirectory(enabled: boolean) {
  const members = useTeam(enabled);
  const teams = useTeams(enabled);
  const principals = useMemo(() => {
    if (!enabled) return EMPTY;
    const validMembers = membersSchema.safeParse(
      members.error ? undefined : members.data
    );
    const validTeams = teamsSchema.safeParse(
      teams.error ? undefined : teams.data
    );
    const people: Principal[] = (validMembers.data?.members ?? []).flatMap(
      (m) =>
        m.email
          ? [
              {
                authorityId: m.email,
                kind: "member" as const,
                name: m.name?.trim() || m.email,
                ...(m.name?.trim() ? { detail: m.email } : {}),
              },
            ]
          : []
    );
    const groups: Principal[] = (validTeams.data ?? []).map((team) => ({
      authorityId: teamAuthority(team.id),
      kind: "team" as const,
      name: team.name,
      size: team.members.length,
    }));
    // Alphabetical, so the few shown before typing are predictable.
    const byName = (a: Principal, b: Principal) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    return [...people.sort(byName), ...groups.sort(byName)];
  }, [enabled, members.data, members.error, teams.data, teams.error]);
  return {
    principals,
    isLoading: enabled && (members.isLoading || teams.isLoading),
  };
}

import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { usePrincipalDirectory } from "./use-principal-directory";

const state = vi.hoisted(() => ({
  members: {} as object,
  teams: [] as object,
}));
vi.mock("@/features/settings-admin/team/team-api", () => ({
  useTeam: () => ({ data: state.members, isLoading: false }),
  useTeams: () => ({ data: state.teams, isLoading: false }),
}));

it("keeps valid members when a team response is malformed", () => {
  state.members = { members: [{ email: "ana@acme.io", name: "Ana" }] };
  state.teams = [{ id: "ops", name: "Ops", members: null }];
  const { result } = renderHook(() => usePrincipalDirectory(true));
  expect(result.current.principals.map((p) => p.authorityId)).toEqual([
    "ana@acme.io",
  ]);
});

it("keeps valid teams when the member response is malformed", () => {
  state.members = { members: null };
  state.teams = [{ id: "ops", name: "Ops", members: ["ana"] }];
  const { result } = renderHook(() => usePrincipalDirectory(true));
  expect(result.current.principals).toEqual([
    { authorityId: "team:ops", kind: "team", name: "Ops", size: 1 },
  ]);
});

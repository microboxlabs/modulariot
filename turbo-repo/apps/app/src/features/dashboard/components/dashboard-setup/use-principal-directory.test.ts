import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { usePrincipalDirectory } from "./use-principal-directory";

const state = vi.hoisted(() => ({
  members: {} as object,
  teams: [] as object,
  membersError: null as object | null,
  teamsError: null as object | null,
}));
vi.mock("@/features/settings-admin/team/team-api", () => ({
  useTeam: () => ({
    data: state.members,
    error: state.membersError,
    isLoading: false,
  }),
  useTeams: () => ({
    data: state.teams,
    error: state.teamsError,
    isLoading: false,
  }),
}));

beforeEach(() => {
  state.membersError = null;
  state.teamsError = null;
});

it.each(["membersError", "teamsError"] as const)(
  "hides cached data from a denied source (%s) while keeping the other source",
  (source) => {
    state.members = { members: [{ email: "ana@acme.io", name: "Ana" }] };
    state.teams = [{ id: "ops", name: "Ops", members: ["ana"] }];
    const { result, rerender } = renderHook(() => usePrincipalDirectory(true));
    expect(result.current.principals).toHaveLength(2);
    state[source] = { status: 403 };
    rerender();
    expect(result.current.principals.map((p) => p.authorityId)).toEqual(
      source === "membersError" ? ["team:ops"] : ["ana@acme.io"]
    );
  }
);

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

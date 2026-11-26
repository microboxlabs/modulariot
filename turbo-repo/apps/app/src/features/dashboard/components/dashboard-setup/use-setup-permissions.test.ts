import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type {
  DashboardPermissionsOptions,
  PermissionAssignment,
} from "@microboxlabs/miot-dashboard-ui/react";
import { useSetupPermissions } from "./use-setup-permissions";

const state = vi.hoisted(() => ({
  assignments: [] as PermissionAssignment[],
  editorKey: "one",
  loaded: true,
  editable: true,
  busy: false,
  error: null as number | null,
  save: vi.fn(async () => true),
  reload: vi.fn(async () => true),
}));
vi.mock("@microboxlabs/miot-dashboard-ui/react", () => ({
  useDashboardPermissions: () => ({ ...state }),
}));
const options = {} as DashboardPermissionsOptions;
const reader: PermissionAssignment = { authorityId: "ana", role: "Consumer" };
const editor: PermissionAssignment = { authorityId: "ana", role: "Editor" };
beforeEach(() => {
  Object.assign(state, {
    assignments: [reader],
    editorKey: "one",
    loaded: true,
    editable: true,
    busy: false,
    error: null,
  });
  vi.clearAllMocks();
});

it("keeps a dirty draft through a reload under the same editor key", () => {
  const { result, rerender } = renderHook(() => useSetupPermissions(options));
  act(() => result.current.onChange([editor]));
  state.loaded = false;
  state.assignments = [];
  rerender();
  expect(result.current.assignments).toEqual([editor]);
  state.loaded = true;
  state.assignments = [reader];
  rerender();
  expect(result.current.assignments).toEqual([editor]);
  expect(result.current.dirty).toBe(true);
  state.editorKey = "another-session";
  rerender();
  expect(result.current.assignments).toEqual([reader]);
});

it("retains an unconfirmed draft while access is revoked and confirms it after retry", async () => {
  const { result, rerender } = renderHook(() => useSetupPermissions(options));
  act(() => result.current.onChange([editor]));
  Object.assign(state, {
    loaded: false,
    editable: false,
    assignments: [],
    error: 403,
  });
  rerender();
  expect(result.current.assignments).toEqual([editor]);
  expect(result.current.canManage).toBe(false);
  expect(result.current.error).toBe(403);
  expect(await result.current.save()).toBe(false);
  expect(state.save).not.toHaveBeenCalled();
  await result.current.retry();
  expect(state.reload).toHaveBeenCalledOnce();
  Object.assign(state, {
    loaded: true,
    editable: true,
    assignments: [editor],
    error: null,
  });
  rerender();
  expect(result.current.dirty).toBe(false);
  expect(result.current.assignments).toEqual([editor]);
});

it("reapplies only local changes over remote grants and revocations", () => {
  const other: PermissionAssignment = {
    authorityId: "other",
    role: "Consumer",
  };
  const removed: PermissionAssignment = {
    authorityId: "revoked",
    role: "Consumer",
  };
  state.assignments = [reader, removed];
  const { result, rerender } = renderHook(() => useSetupPermissions(options));
  act(() => result.current.onChange([editor, removed]));
  state.assignments = [reader, other];
  rerender();
  expect(result.current.assignments).toEqual([editor, other]);
  expect(result.current.error).toBeNull();
});

it("blocks conflicting edits to one grant until the user discards and reloads", async () => {
  const { result, rerender } = renderHook(() => useSetupPermissions(options));
  act(() => result.current.onChange([editor]));
  state.assignments = [];
  rerender();
  expect(result.current.error).toBe(409);
  expect(await result.current.save()).toBe(false);
  expect(state.save).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.retry();
  });
  expect(result.current.assignments).toEqual([]);
  expect(result.current.dirty).toBe(false);
});

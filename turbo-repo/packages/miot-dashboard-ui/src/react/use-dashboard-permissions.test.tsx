// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  useDashboardPermissions,
  type DashboardPermissionsOptions,
} from "./use-dashboard-permissions";
afterEach(cleanup);
const allowed = {
  canManagePermissions: true,
  readOnly: true,
  canEdit: false,
  canShare: false,
  canDelete: false,
};
const assignment = { authorityId: "reader", role: "Consumer" as const };
function setup() {
  const client = {
    key: (slug?: string) => `/tenant/${slug}`,
    capabilities: vi
      .fn<DashboardPermissionsOptions["client"]["capabilities"]>()
      .mockResolvedValue(allowed),
    permissions: vi
      .fn<DashboardPermissionsOptions["client"]["permissions"]>()
      .mockResolvedValue({ assignments: [assignment] }),
    setPermissions: vi
      .fn<DashboardPermissionsOptions["client"]["setPermissions"]>()
      .mockResolvedValue(undefined),
  };
  return { client, options: { client, slug: "costs", sessionKey: "one" } };
}
it("uses the permission capability independently of edit access, validates drafts and reloads after writing", async () => {
  const { client, options } = setup();
  const { result } = renderHook(useDashboardPermissions, {
    initialProps: options,
  });
  await waitFor(() => expect(result.current.editable).toBe(true));
  expect(await result.current.save([assignment, assignment])).toBe(false);
  expect(client.setPermissions).not.toHaveBeenCalled();
  await act(async () => {
    expect(await result.current.save([assignment])).toBe(true);
  });
  expect(client.setPermissions).toHaveBeenCalledWith(
    "costs",
    [assignment],
    expect.any(AbortSignal),
  );
  expect(client.permissions).toHaveBeenCalledTimes(2);
  client.capabilities.mockResolvedValue({
    ...allowed,
    canManagePermissions: false,
  });
  await act(async () => {
    expect(await result.current.save([assignment])).toBe(false);
  });
  expect(client.setPermissions).toHaveBeenCalledTimes(1);
  expect(result.current.assignments).toEqual([]);
  expect(result.current.error).toBe(403);
});
it("does not discover assignments for a Consumer or permit host-restricted writes", async () => {
  const { client, options } = setup();
  client.capabilities.mockResolvedValue({
    ...allowed,
    canManagePermissions: false,
  });
  const { result, rerender } = renderHook(useDashboardPermissions, {
    initialProps: { ...options, readOnly: false },
  });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(client.permissions).not.toHaveBeenCalled();
  expect(await result.current.save([assignment])).toBe(false);
  client.capabilities.mockResolvedValue(allowed);
  rerender({ ...options, readOnly: true });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.editable).toBe(false);
  expect(await result.current.save([])).toBe(false);
  expect(client.setPermissions).not.toHaveBeenCalled();
});
it("aborts obsolete loads and rejects callbacks retained after unmount", async () => {
  const { client, options } = setup();
  let release!: (value: { assignments: (typeof assignment)[] }) => void;
  client.permissions.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const { result, rerender, unmount } = renderHook(useDashboardPermissions, {
    initialProps: options,
  });
  await waitFor(() => expect(client.permissions).toHaveBeenCalledTimes(1));
  rerender({ ...options, sessionKey: "two" });
  expect(result.current.assignments).toEqual([]);
  expect(client.permissions.mock.calls[0]?.[1]?.aborted).toBe(true);
  await waitFor(() => expect(result.current.loaded).toBe(true));
  await act(async () => {
    release({ assignments: [{ ...assignment, authorityId: "obsolete" }] });
  });
  expect(result.current.assignments).toEqual([assignment]);
  const save = result.current.save;
  unmount();
  expect(await save([assignment])).toBe(false);
  expect(client.setPermissions).not.toHaveBeenCalled();
});

it("prevents concurrent writes and aborts persistence when the session changes", async () => {
  const { client, options } = setup();
  let release!: () => void;
  client.setPermissions.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const { result, rerender } = renderHook(useDashboardPermissions, {
    initialProps: options,
  });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  let saving!: Promise<boolean>;
  act(() => {
    saving = result.current.save([assignment]);
  });
  await waitFor(() => expect(client.setPermissions).toHaveBeenCalledTimes(1));
  expect(await result.current.save([])).toBe(false);
  rerender({ ...options, sessionKey: "replacement" });
  expect(client.setPermissions.mock.calls[0]?.[2]?.aborted).toBe(true);
  await act(async () => {
    release();
    expect(await saving).toBe(false);
  });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(client.permissions).toHaveBeenCalledTimes(2);
});

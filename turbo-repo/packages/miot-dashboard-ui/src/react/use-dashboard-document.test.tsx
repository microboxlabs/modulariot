// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { StrictMode, type PropsWithChildren } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_STORAGE } from "@microboxlabs/miot-dashboard-contract/document";
import type { DashboardDocumentOptions } from "../document";
import { useDashboardDocument } from "./use-dashboard-document";
afterEach(cleanup);
const empty = { ...DEFAULT_STORAGE, name: "Empty" };
function setup() {
  const client = {
    key: (slug?: string) => `/tenant/a/${slug ?? ""}`,
    load: vi.fn<DashboardDocumentOptions["client"]["load"]>().mockResolvedValue({ config: empty, etag: '"7"' }),
    save: vi.fn<DashboardDocumentOptions["client"]["save"]>().mockResolvedValue({ etag: '"8"', revision: 8, updatedAt: "now" }),
    capabilities: vi.fn<DashboardDocumentOptions["client"]["capabilities"]>().mockResolvedValue({ readOnly: false, canEdit: true, canDelete: true, canShare: true, canManagePermissions: true }),
  };
  const options: DashboardDocumentOptions = { client, emptyDocument: empty, sessionKey: "one", slug: "costs" };
  return { client, options };
}
function Strict({ children }: Readonly<PropsWithChildren>) {
  return <StrictMode>{children}</StrictMode>;
}
it("resets drafts on identity changes under StrictMode", async () => {
  const { options } = setup();
  const { result, rerender } = renderHook(useDashboardDocument, { initialProps: options, wrapper: Strict });
  await waitFor(() => expect(result.current.isLoaded).toBe(true));
  act(() => result.current.onChange({ ...empty, name: "Private draft" }));
  const previousKey = result.current.editorKey;
  rerender({ ...options, sessionKey: "two" });
  expect(result.current.config.name).toBe("Empty");
  await waitFor(() => expect(result.current.isLoaded).toBe(true));
  expect(result.current.dirty).toBe(false);
  expect(result.current.editorKey).not.toBe(previousKey);
});
it("applies a changed host read-only restriction without permitting writes", async () => {
  const { client, options } = setup();
  const { result, rerender } = renderHook(useDashboardDocument, { initialProps: options });
  await waitFor(() => expect(result.current.readOnly).toBe(false));
  rerender({ ...options, readOnly: true });
  expect(result.current.readOnly).toBe(true);
  await waitFor(() => expect(result.current.isLoaded).toBe(true));
  act(() => result.current.onChange({ ...empty, name: "Forbidden" }));
  await act(async () => { expect(await result.current.save()).toBe(false); });
  expect(client.save).not.toHaveBeenCalled();
  expect(result.current.dirty).toBe(false);
});
it("aborts pending loads and ignores late data on unmount", async () => {
  const { client, options } = setup();
  let release!: (value: Awaited<ReturnType<typeof client.load>>) => void;
  client.load.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  const { result, unmount } = renderHook(useDashboardDocument, { initialProps: options });
  const save = result.current.save;
  unmount();
  expect(client.load.mock.calls[0]?.[1]?.aborted).toBe(true);
  await act(async () => { release({ config: { ...empty, name: "Late secret" }, etag: '"9"' }); });
  expect(await save()).toBe(false);
  expect(client.save).not.toHaveBeenCalled();
});

// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DashboardApiError } from "../client/error";
import { useQueryCatalog, type QueryCatalogOptions } from "./use-query-catalog";
afterEach(cleanup);
const connections = [{ id: "billing", label: "Billing", operations: [] }];
function setup() {
  const client = { key: (slug?: string) => `/scope/${slug}`, queryCatalog: vi.fn<QueryCatalogOptions["client"]["queryCatalog"]>().mockResolvedValue(connections) };
  return { client, options: { client, slug: "costs", sessionKey: "one", enabled: true } };
}
it("does not discover by default and clears results immediately when editing is revoked", async () => {
  const { client, options } = setup();
  const { result, rerender } = renderHook(useQueryCatalog, { initialProps: { ...options, enabled: false } });
  expect(client.queryCatalog).not.toHaveBeenCalled();
  rerender(options);
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.connections).toEqual(connections);
  rerender({ ...options, enabled: false });
  expect(result.current.connections).toEqual([]);
  expect(client.queryCatalog.mock.calls[0]?.[1]?.aborted).toBe(true);
});
it("ignores late results across sessions and reports unavailable catalogs until explicitly retried", async () => {
  const { client, options } = setup();
  let resolve!: (value: typeof connections) => void;
  client.queryCatalog.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const { result, rerender } = renderHook(useQueryCatalog, { initialProps: options });
  await waitFor(() => expect(client.queryCatalog).toHaveBeenCalledOnce());
  client.queryCatalog.mockRejectedValueOnce(new DashboardApiError(404));
  rerender({ ...options, sessionKey: "two" });
  expect(result.current.connections).toEqual([]);
  expect(client.queryCatalog.mock.calls[0]?.[1]?.aborted).toBe(true);
  await waitFor(() => expect(result.current.error).toBe(404));
  await act(async () => { resolve(connections); });
  expect(result.current.connections).toEqual([]);
  expect(result.current.loaded).toBe(false);
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.connections).toEqual(connections);
});

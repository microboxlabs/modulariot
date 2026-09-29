import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { makeDashboardStorage } from "../test-fixtures";
import { useDashboardDocument } from "./use-dashboard-document";

const empty = makeDashboardStorage();
const capabilities = {
  readOnly: false,
  canEdit: true,
  canDelete: true,
  canShare: true,
  canManagePermissions: true,
};
function setup(canEdit = true) {
  const cache = new Map();
  const value = { provider: () => cache, dedupingInterval: 0 };
  const wrapper = ({ children }: Readonly<PropsWithChildren>) => (
    <SWRConfig value={value}>{children}</SWRConfig>
  );
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const url = String(input);
    return url.includes("/capabilities")
      ? Response.json({ ...capabilities, canEdit, readOnly: !canEdit })
      : Response.json({ data: empty }, { headers: { ETag: '"7"' } });
  });
  const hook = renderHook(
    ({ org }) => useDashboardDocument(org, "fleet", empty, fetcher),
    { wrapper, initialProps: { org: "one" } }
  );
  return { ...hook, fetcher };
}

describe("server dashboard document", () => {
  it("refuses Consumer edits and writes", async () => {
    const { result, fetcher } = setup(false);
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    act(() => result.current.onChange({ ...empty, name: "Forbidden" }));
    await act(async () => {
      expect(await result.current.save()).toBe(false);
    });
    expect(result.current.config.name).toBe(empty.name);
    expect(result.current.dirty).toBe(false);
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
      false
    );
  });

  it("retains edits and the original revision on conflict without retrying", async () => {
    const { result, fetcher } = setup();
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    act(() => result.current.onChange({ ...empty, name: "Local edits" }));
    fetcher.mockResolvedValueOnce(new Response(null, { status: 409 }));
    await act(async () => {
      expect(await result.current.save()).toBe(false);
    });
    expect(result.current.config.name).toBe("Local edits");
    expect(result.current.dirty).toBe(true);
    expect(result.current.error).toBe(409);
    const writes = fetcher.mock.calls.filter(
      ([, init]) => init?.method === "PUT"
    );
    expect(writes).toHaveLength(1);
    expect(writes[0]?.[1]?.headers).toMatchObject({ "if-match": '"7"' });
  });

  it("serializes saves and advances the revision after success", async () => {
    const { result, fetcher } = setup();
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    act(() => result.current.onChange({ ...empty, name: "Edited" }));
    let release!: (response: Response) => void;
    fetcher.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.save();
    });
    expect(result.current.readOnly).toBe(true);
    await act(async () => {
      expect(await result.current.save()).toBe(false);
    });
    act(() =>
      result.current.onChange({ ...empty, name: "Rejected during save" })
    );
    await act(async () => {
      release(
        Response.json(
          { data: { revision: 8, updatedAt: "now" } },
          { headers: { ETag: '"8"' } }
        )
      );
      expect(await pending).toBe(true);
    });
    expect(result.current.dirty).toBe(false);
    expect(result.current.config.name).toBe("Edited");
    act(() => result.current.onChange({ ...empty, name: "Next" }));
    fetcher.mockResolvedValueOnce(new Response(null, { status: 409 }));
    await act(async () => {
      await result.current.save();
    });
    expect(fetcher.mock.calls.at(-1)?.[1]?.headers).toMatchObject({
      "if-match": '"8"',
    });
  });

  it("does not expose another organization's draft or late save response", async () => {
    const { result, fetcher, rerender } = setup();
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    act(() =>
      result.current.onChange({ ...empty, name: "Org one private edit" })
    );
    let release!: (response: Response) => void;
    fetcher.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.save();
    });
    rerender({ org: "two" });
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    await act(async () => {
      release(
        Response.json(
          { data: { revision: 8, updatedAt: "now" } },
          { headers: { ETag: '"8"' } }
        )
      );
      await pending;
    });
    expect(result.current.config.name).toBe(empty.name);
    expect(result.current.dirty).toBe(false);
    act(() => result.current.onChange({ ...empty, name: "Org two" }));
    fetcher.mockResolvedValueOnce(new Response(null, { status: 409 }));
    await act(async () => {
      await result.current.save();
    });
    expect(fetcher.mock.calls.at(-1)?.[0]).toContain("org=two");
    expect(fetcher.mock.calls.at(-1)?.[1]?.headers).toMatchObject({
      "if-match": '"7"',
    });
  });

  it("keeps drafts on a failed reload, then resets editor history on explicit reload", async () => {
    const { result, fetcher } = setup();
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    act(() => result.current.onChange({ ...empty, name: "Unsaved" }));
    fetcher.mockResolvedValueOnce(new Response(null, { status: 503 }));
    await act(async () => {
      expect(await result.current.discardAndReload()).toBe(false);
    });
    expect(result.current.config.name).toBe("Unsaved");
    const oldKey = result.current.editorKey;
    await act(async () => {
      expect(await result.current.discardAndReload()).toBe(true);
    });
    expect(result.current.dirty).toBe(false);
    expect(result.current.editorKey).not.toBe(oldKey);
  });
});

import { describe, expect, it, vi } from "vitest";
import { DEFAULT_STORAGE } from "@microboxlabs/miot-dashboard-contract/document";
import { DashboardApiError } from "./client/error";
import {
  createDashboardDocument,
  type DashboardDocumentOptions,
} from "./document";

const capabilities = {
  readOnly: false,
  canEdit: true,
  canDelete: true,
  canShare: true,
  canManagePermissions: true,
};
const empty = { ...DEFAULT_STORAGE, name: "Empty" };
function setup(options: Partial<DashboardDocumentOptions> = {}) {
  const client = {
    key: (slug?: string) => `/tenants/a/scopes/ops/dashboards/${slug ?? ""}`,
    load: vi
      .fn<DashboardDocumentOptions["client"]["load"]>()
      .mockResolvedValue({ config: empty, etag: '"7"' }),
    save: vi
      .fn<DashboardDocumentOptions["client"]["save"]>()
      .mockResolvedValue({ etag: '"8"', revision: 8, updatedAt: "now" }),
    capabilities: vi
      .fn<DashboardDocumentOptions["client"]["capabilities"]>()
      .mockResolvedValue(capabilities),
  };
  const session = createDashboardDocument({
    client,
    slug: "fleet",
    sessionKey: "login-1",
    emptyDocument: empty,
    ...options,
  });
  return { client, session };
}

describe("isolated document editing", () => {
  it("requires a non-empty authentication generation", () => {
    expect(() => setup({ sessionKey: "" })).toThrow("(400)");
  });

  it("does not start requests when a subscriber tears down the session", async () => {
    const { session, client } = setup();
    session.subscribe(() => session.destroy());
    expect(await session.load()).toBe(false);
    expect(client.load).not.toHaveBeenCalled();
    expect(client.capabilities).not.toHaveBeenCalled();
  });

  it("ignores a rejected load after teardown", async () => {
    const { session, client } = setup();
    let reject!: (error: Error) => void;
    client.load.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const loading = session.load();
    session.destroy();
    expect(client.load.mock.calls[0]?.[1]?.aborted).toBe(true);
    reject(new DashboardApiError(403));
    expect(await loading).toBe(false);
    expect(session.getSnapshot()).toMatchObject({
      isLoaded: false,
      error: null,
      config: empty,
    });
  });

  it("starts read-only and requires both a document and server edit permission", async () => {
    const { session, client } = setup();
    expect(session.getSnapshot().readOnly).toBe(true);
    expect(session.onChange({ ...empty, name: "Before load" })).toBe(false);
    client.capabilities.mockResolvedValue({ ...capabilities, canEdit: false });
    await session.load();
    expect(session.getSnapshot().readOnly).toBe(true);
    expect(session.onChange({ ...empty, name: "Consumer edit" })).toBe(false);
    expect(await session.save()).toBe(false);
    expect(client.save).not.toHaveBeenCalled();
  });

  it("honors host restrictions without granting access", async () => {
    const { session } = setup({ readOnly: true });
    await session.load();
    expect(session.getSnapshot().readOnly).toBe(true);
  });

  it("does not create an absent dashboard through an editor save", async () => {
    const { session, client } = setup();
    client.load.mockResolvedValue({ config: null, etag: '"0"' });
    await session.load();
    expect(session.getSnapshot()).toMatchObject({
      isLoaded: true,
      exists: false,
      readOnly: true,
    });
    expect(await session.save()).toBe(false);
  });

  it("retains edits and ETag on conflict; retries only on explicit save", async () => {
    const { session, client } = setup();
    await session.load();
    session.onChange({ ...empty, name: "Draft" });
    client.save.mockRejectedValueOnce(new DashboardApiError(409));
    expect(await session.save()).toBe(false);
    expect(session.getSnapshot()).toMatchObject({
      config: { name: "Draft" },
      etag: '"7"',
      dirty: true,
      error: 409,
      busy: false,
    });
    expect(client.save).toHaveBeenCalledOnce();
    expect(await session.save()).toBe(true);
    expect(session.getSnapshot()).toMatchObject({
      etag: '"8"',
      dirty: false,
      error: null,
    });
    expect(client.save.mock.calls[1]?.[2]).toBe('"7"');
  });

  it("requires explicit discard and preserves drafts if reload fails", async () => {
    const { session, client } = setup();
    await session.load();
    session.onChange({ ...empty, name: "Draft" });
    expect(await session.load()).toBe(false);
    expect(client.load).toHaveBeenCalledOnce();
    client.load.mockRejectedValueOnce(new Error("private network failure"));
    expect(await session.discardAndReload()).toBe(false);
    expect(session.getSnapshot()).toMatchObject({
      config: { name: "Draft" },
      dirty: true,
      error: 502,
    });
    const editorKey = session.getSnapshot().editorKey;
    expect(await session.discardAndReload()).toBe(true);
    expect(session.getSnapshot()).toMatchObject({
      config: empty,
      dirty: false,
    });
    expect(session.getSnapshot().editorKey).not.toBe(editorKey);
  });

  it("serializes operations and prevents edits during a save", async () => {
    const { session, client } = setup();
    await session.load();
    session.onChange({ ...empty, name: "First edit" });
    let finish!: (value: Awaited<ReturnType<typeof client.save>>) => void;
    client.save.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const saving = session.save();
    expect(session.getSnapshot().readOnly).toBe(true);
    expect(session.onChange({ ...empty, name: "Racing edit" })).toBe(false);
    expect(await session.save()).toBe(false);
    expect(await session.discardAndReload()).toBe(false);
    finish({ etag: '"8"', revision: 8, updatedAt: "now" });
    expect(await saving).toBe(true);
    expect(session.getSnapshot()).toMatchObject({
      config: { name: "First edit" },
      dirty: false,
      readOnly: false,
    });
  });

  it("aborts sibling load requests on failure and fails closed on revoked access", async () => {
    const { session, client } = setup();
    await session.load();
    session.onChange({ ...empty, name: "Retained draft" });
    client.capabilities.mockRejectedValueOnce(new DashboardApiError(403));
    await session.discardAndReload();
    expect(client.load.mock.calls.at(-1)?.[1]?.aborted).toBe(true);
    expect(session.getSnapshot()).toMatchObject({
      dirty: true,
      error: 403,
      readOnly: true,
    });
    expect(await session.save()).toBe(false);
  });

  it("aborts teardown and ignores late writes across separate authentication generations", async () => {
    const { session, client } = setup();
    const next = setup({ sessionKey: "login-2" }).session;
    await Promise.all([session.load(), next.load()]);
    expect(next.getSnapshot().editorKey).not.toBe(
      session.getSnapshot().editorKey,
    );
    session.onChange({ ...empty, name: "Private draft" });
    let finish!: (value: Awaited<ReturnType<typeof client.save>>) => void;
    client.save.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const saving = session.save();
    session.destroy();
    expect(client.save.mock.calls[0]?.[3]?.aborted).toBe(true);
    finish({ etag: '"8"', revision: 8, updatedAt: "now" });
    expect(await saving).toBe(false);
    expect(session.getSnapshot()).toMatchObject({
      config: empty,
      isLoaded: false,
      dirty: false,
    });
    expect(next.getSnapshot()).toMatchObject({
      config: empty,
      etag: '"7"',
      dirty: false,
    });
    expect(await session.load()).toBe(false);
    expect(session.onChange(empty)).toBe(false);
  });

  it("removes subscribers and keeps a stable snapshot between changes", async () => {
    const { session } = setup();
    const listener = vi.fn();
    const initial = session.getSnapshot();
    expect(session.getSnapshot()).toBe(initial);
    const unsubscribe = session.subscribe(listener);
    await session.load();
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    session.onChange({ ...empty, name: "Edit" });
    expect(listener).not.toHaveBeenCalled();
    session.destroy();
    session.subscribe(listener)();
    expect(listener).not.toHaveBeenCalled();
  });
});

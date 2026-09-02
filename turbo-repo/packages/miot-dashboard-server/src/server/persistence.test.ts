/**
 * The standalone server, persisting for real.
 *
 * Everything else about the store is tested at the seam. This runs the whole
 * stack over a socket and then restarts it, because "the data is still there
 * after a deploy" is the one claim a unit test cannot make — and it is the
 * claim that distinguishes this from the in-memory server we had yesterday.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openSqliteStore, type OpenedStore } from "../store/sqlite";
import {
  createInsecureHeaderIdentityResolver,
  createMemoryScopeAuthority,
} from "../testing";
import { serve, type RunningServer } from "./serve";

const AS_ANA = {
  "x-dev-user": "ana",
  "x-dev-tenant": "acme",
  "content-type": "application/json",
};

const config = { version: 2, name: "Fleet", widgets: [] };

describe("a restart", () => {
  let directory: string;
  let path: string;

  beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), "miot-persist-"));
    path = join(directory, "dashboards.db");
  });

  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  const boot = async (): Promise<{
    running: RunningServer;
    opened: OpenedStore;
  }> => {
    const opened = await openSqliteStore({ path });
    const running = await serve({
      identity: createInsecureHeaderIdentityResolver(),
      scopes: createMemoryScopeAuthority({
        acme: { ops: { ana: "Coordinator" } },
      }),
      store: opened.store,
      port: 0,
      host: "127.0.0.1",
      docs: false,
      log: () => {},
    });
    return { running, opened };
  };

  it("does not lose the dashboard", async () => {
    const first = await boot();
    try {
      const saved = await fetch(
        `${first.running.url}/scopes/ops/dashboards/fleet`,
        { method: "PUT", headers: AS_ANA, body: JSON.stringify(config) },
      );
      expect(saved.status).toBe(200);

      const listed = await fetch(`${first.running.url}/scopes/ops/dashboards`, {
        headers: AS_ANA,
      });
      expect(await listed.json()).toEqual({
        data: [{ slug: "fleet", name: "Fleet" }],
      });
    } finally {
      await first.running.close();
      await first.opened.close();
    }

    // Nothing of the first process survives but the file.
    const second = await boot();
    try {
      const loaded = await fetch(
        `${second.running.url}/scopes/ops/dashboards/fleet`,
        { headers: AS_ANA },
      );
      expect(loaded.status).toBe(200);
      expect(await loaded.json()).toEqual({ data: config });

      // And the revision survived too, so a client holding an ETag from
      // before the restart is not told its write conflicts.
      const conflicting = await fetch(
        `${second.running.url}/scopes/ops/dashboards/fleet`,
        {
          method: "PUT",
          headers: { ...AS_ANA, "if-match": "1" },
          body: JSON.stringify({ ...config, name: "Fleet 2026" }),
        },
      );
      expect(conflicting.status).toBe(200);
    } finally {
      await second.running.close();
      await second.opened.close();
    }
  });

  it("keeps one tenant's data out of another's, across a restart", async () => {
    const first = await boot();
    try {
      await fetch(`${first.running.url}/scopes/ops/dashboards/private`, {
        method: "PUT",
        headers: AS_ANA,
        body: JSON.stringify({ version: 2, name: "Acme only" }),
      });
    } finally {
      await first.running.close();
      await first.opened.close();
    }

    const second = await boot();
    try {
      // Same scope id, different tenant on the credential. The scope authority
      // has no membership for them, so this is a 403 rather than a 404 — the
      // two must stay indistinguishable from outside.
      const theirs = await fetch(
        `${second.running.url}/scopes/ops/dashboards/private`,
        { headers: { ...AS_ANA, "x-dev-tenant": "globex" } },
      );
      expect(theirs.status).toBe(403);
    } finally {
      await second.running.close();
      await second.opened.close();
    }
  });
});

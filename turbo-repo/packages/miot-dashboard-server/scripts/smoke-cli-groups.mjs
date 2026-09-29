/* global fetch */
import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { DEFAULT_STORAGE } from "@microboxlabs/miot-dashboard-contract/document";

async function availablePort() {
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

test(
  "built CLI enforces group restrictions on listing, reads and saved queries",
  { timeout: 20000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "dashboard-group-policy-"));
    const seed = join(dir, "seed.json");
    const modulePath = join(dir, "operations.mjs");
    const secret = randomBytes(32).toString("hex");
    const port = await availablePort();
    let child;
    try {
      const queries = [
        {
          id: "summary",
          variableName: "summary",
          connectionId: "fixture",
          operationId: "summary",
          parameters: {},
        },
      ];
      await writeFile(
        seed,
        JSON.stringify({
          memberships: { acme: { ops: { viewer: "Consumer" } } },
          dashboards: ["public", "restricted"].map((slug) => ({
            ref: { tenantId: "acme", scopeId: "ops", slug },
            record: {
              config: {
                ...DEFAULT_STORAGE,
                name: slug,
                queries,
                ...(slug === "restricted"
                  ? { allowedGroups: ["fleet-readers"] }
                  : {}),
              },
            },
          })),
        }),
        { mode: 0o600 },
      );
      await writeFile(
        modulePath,
        "export function createDashboardOperations() { return { async execute() { return { rows: [{ count: 1 }] }; } }; }",
        { mode: 0o600 },
      );
      child = spawn(process.execPath, ["dist/bin.js"], {
        env: {
          HOST: "127.0.0.1",
          PORT: String(port),
          MIOT_DASHBOARD_STORE: "memory",
          MIOT_DASHBOARD_SEED: seed,
          MIOT_DASHBOARD_OPERATIONS_MODULE: modulePath,
          MIOT_DASHBOARD_JWT_ISSUER: "https://issuer.invalid/",
          MIOT_DASHBOARD_JWT_AUDIENCE: "groups-smoke",
          MIOT_DASHBOARD_JWT_SECRET: secret,
          MIOT_DASHBOARD_JWT_GROUPS_CLAIM: "groups",
        },
        stdio: "ignore",
      });
      const exited = once(child, "exit");
      const origin = `http://127.0.0.1:${port}`;
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          ready = (await fetch(`${origin}/readyz`)).ok;
        } catch {
          /* Listener not ready. */
        }
        if (ready) break;
        await delay(50);
      }
      assert(ready, "CLI did not become ready");
      const base = `${origin}/tenants/acme/scopes/ops/dashboards`;
      assert.equal((await fetch(base)).status, 401);
      for (const groups of [undefined, ["other"], ["fleet-readers"]]) {
        const encode = (value) =>
          Buffer.from(JSON.stringify(value)).toString("base64url");
        const input = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
          iss: "https://issuer.invalid/",
          aud: "groups-smoke",
          sub: "viewer",
          exp: Math.floor(Date.now() / 1000) + 60,
          ...(groups ? { groups } : {}),
        })}`;
        const token = `${input}.${createHmac("sha256", secret).update(input).digest("base64url")}`;
        const headers = { authorization: `Bearer ${token}` };
        const allowed = groups?.includes("fleet-readers") === true;
        const list = await fetch(base, { headers });
        assert.equal(list.status, 200);
        assert.deepEqual(
          (await list.json()).data.map((entry) => entry.slug).sort(),
          allowed ? ["public", "restricted"] : ["public"],
        );
        assert.equal((await fetch(`${base}/public`, { headers })).status, 200);
        assert.equal(
          (await fetch(`${base}/restricted`, { headers })).status,
          allowed ? 200 : 403,
        );
        assert.equal(
          (
            await fetch(`${base}/restricted/queries/summary`, {
              method: "POST",
              headers,
              body: "{}",
            })
          ).status,
          allowed ? 200 : 403,
        );
        assert.equal(
          (await fetch(`${base}/restricted`, { method: "DELETE", headers }))
            .status,
          403,
        );
      }
      child.kill("SIGTERM");
      await exited;
    } finally {
      if (child && child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
      await rm(dir, { recursive: true, force: true });
    }
  },
);

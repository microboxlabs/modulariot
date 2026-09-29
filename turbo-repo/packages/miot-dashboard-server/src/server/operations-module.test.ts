import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readServerConfig } from "./config";
import { loadConfiguredOperations } from "./operations-module";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function fixture(source: string) {
  const dir = await mkdtemp(join(tmpdir(), "dashboard-operations-"));
  dirs.push(dir);
  const path = join(dir, "operations.mjs");
  await writeFile(path, source);
  return path;
}
const auth = {
  MIOT_DASHBOARD_JWT_ISSUER: "https://issuer.example",
  MIOT_DASHBOARD_JWT_AUDIENCE: "dashboard",
  MIOT_DASHBOARD_JWT_SECRET: "a".repeat(32),
};

describe("standalone portable operations module", () => {
  it("loads an operator factory without a remote execution endpoint or proxy key", async () => {
    const path = await fixture(
      "export async function createDashboardOperations() { return { async execute() { return { rows: [] }; } }; }",
    );
    const config = readServerConfig({
      ...auth,
      MIOT_DASHBOARD_OPERATIONS_MODULE: path,
    });
    expect(config.operations).toBeUndefined();
    expect(config.proxyKey).toBeUndefined();
    expect(await loadConfiguredOperations(config)).toHaveProperty("execute");
  });
  it.each([
    "./relative.mjs",
    "https://remote.example/module.mjs",
    "/tmp/secrets.json",
    "",
  ])("rejects non-module configuration %s", (path) => {
    expect(() =>
      readServerConfig({ ...auth, MIOT_DASHBOARD_OPERATIONS_MODULE: path }),
    ).toThrow("absolute JavaScript file path");
  });
  it("rejects ambiguous remote and local executor configuration", () => {
    expect(() =>
      readServerConfig({
        ...auth,
        MIOT_DASHBOARD_OPERATIONS_MODULE: "/operator/module.mjs",
        MIOT_DASHBOARD_OPERATIONS_URL: "https://host.example",
      }),
    ).toThrow("cannot be combined");
  });
  it.each([
    'throw new Error("private-token");',
    'export function createDashboardOperations() { throw new Error("private-token"); }',
    'export function createDashboardOperations() { return { execute: "private-token" }; }',
    "export default {};",
  ])("fails closed without exposing module diagnostics", async (source) => {
    const path = await fixture(source);
    await expect(
      loadConfiguredOperations({ operationsModule: path }),
    ).rejects.toThrow("Dashboard operation module could not be initialized");
  });
});

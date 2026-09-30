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
async function fixture(source: string, extension = "mjs") {
  const dir = await mkdtemp(join(tmpdir(), "dashboard-operations-"));
  dirs.push(dir);
  const path = join(dir, `operations.${extension}`);
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
  it.each(["js", "cjs"])(
    "executes a conventional CommonJS %s module",
    async (extension) => {
      const path = await fixture(
        "exports.createDashboardOperations = () => ({ execute: async () => ({ rows: [] }) });",
        extension,
      );
      const executor = await loadConfiguredOperations({
        operationsModule: path,
      });
      expect(await executor?.execute({} as never)).toEqual({ rows: [] });
    },
  );
  it("treats a whitespace-only remote URL as absent", () => {
    expect(
      readServerConfig({
        ...auth,
        MIOT_DASHBOARD_OPERATIONS_MODULE: "/operator/module.mjs",
        MIOT_DASHBOARD_OPERATIONS_URL: "   ",
      }).operations,
    ).toBeUndefined();
  });
  it("allows no executor and preserves the HTTP adapter fallback", async () => {
    expect(await loadConfiguredOperations({})).toBeUndefined();
    expect(
      await loadConfiguredOperations({
        operations: { url: "https://host.example", proxyKey: "a".repeat(32) },
      }),
    ).toHaveProperty("execute");
  });
  it.each(["./relative.mjs", "/operator/module.mjs"])(
    "validates configuration passed directly to the loader",
    async (path) => {
      await expect(
        loadConfiguredOperations({
          operationsModule: path,
          operations: { url: "https://host.example", proxyKey: "a".repeat(32) },
        }),
      ).rejects.toMatchObject({
        message: "Dashboard operation module could not be initialized",
      });
    },
  );
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
    "export function createDashboardOperations() { return null; }",
    "export function createDashboardOperations() { return 1; }",
    "export function createDashboardOperations() { return {}; }",
  ])("fails closed without exposing module diagnostics", async (source) => {
    const path = await fixture(source);
    await expect(
      loadConfiguredOperations({ operationsModule: path }),
    ).rejects.toMatchObject({
      message: "Dashboard operation module could not be initialized",
    });
  });
});

it("loads an optional catalog factory without changing the executor receiver", async () => {
  const path = await fixture(`
    export function createDashboardOperations() { return { value: 7, async execute() { return { rows: [{ value: this.value }] }; } }; }
    export function createDashboardQueryCatalog() { return { async list({ref}) { return [{ id: ref.tenantId, label: 'Billing', operations: [] }]; } }; }
  `);
  const operations = await loadConfiguredOperations({ operationsModule: path });
  expect(await operations?.execute({} as never)).toEqual({ rows: [{ value: 7 }] });
  expect(await operations?.queryCatalog?.list({ ref: { tenantId: "acme" } } as never)).toEqual([{ id: "acme", label: "Billing", operations: [] }]);
});
it.each([
  'export const createDashboardQueryCatalog = "private-token";',
  'export function createDashboardQueryCatalog() { throw new Error("private-token"); }',
  'export function createDashboardQueryCatalog() { return null; }',
  'export function createDashboardQueryCatalog() { return { list: "private-token" }; }',
])("rejects invalid catalog factories without leaking initialization details", async (catalog) => {
  const path = await fixture('export function createDashboardOperations() { return { execute: async () => ({rows:[]}) }; }\n' + catalog);
  await expect(loadConfiguredOperations({ operationsModule: path })).rejects.toMatchObject({message: "Dashboard operation module could not be initialized"});
});

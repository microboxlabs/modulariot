import { describe, expect, it, vi } from "vitest";
import { createDictionaryTranslate } from "./translate";
import { capabilitiesForRole } from "./capabilities";
import { createAppDashboardStore } from "./store";
import { createAppDataSourceProvider } from "./data-sources";
import { DEFAULT_STORAGE } from "@microboxlabs/miot-dashboard-ui";
import type { DataSourceListItem } from "@/features/data-sources/types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createDictionaryTranslate (Seam A)", () => {
  const dict = {
    settings: { title: "Configuración", greet: "Hola {name}" },
  };

  it("resolves nested keys against the dictionary", () => {
    const t = createDictionaryTranslate(dict);
    expect(t("settings.title")).toBe("Configuración");
  });

  it("interpolates params", () => {
    const t = createDictionaryTranslate(dict);
    expect(t("settings.greet", { name: "Ana" })).toBe("Hola Ana");
  });

  it("echoes missing keys (tr semantics)", () => {
    const t = createDictionaryTranslate(dict);
    expect(t("settings.missing")).toBe("settings.missing");
  });
});

describe("capabilitiesForRole (Seam F)", () => {
  it("gives Coordinator full access", () => {
    expect(capabilitiesForRole("Coordinator").canManagePermissions).toBe(true);
    expect(capabilitiesForRole("Coordinator").canDelete).toBe(true);
  });

  it("gives Editor/Contributor edit without admin", () => {
    for (const role of ["Editor", "Contributor"] as const) {
      const caps = capabilitiesForRole(role);
      expect(caps.canEdit).toBe(true);
      expect(caps.canManagePermissions).toBe(false);
      expect(caps.canDelete).toBe(false);
    }
  });

  it("gives Consumer read-only + share", () => {
    const caps = capabilitiesForRole("Consumer");
    expect(caps.readOnly).toBe(true);
    expect(caps.canEdit).toBe(false);
    expect(caps.canShare).toBe(true);
  });

  it("defaults unknown/absent roles to read-only", () => {
    expect(capabilitiesForRole(null).readOnly).toBe(true);
    expect(capabilitiesForRole(undefined).canShare).toBe(false);
  });
});

describe("createAppDashboardStore (Seam E)", () => {
  const ref = { scopeId: "ops-site", slug: "fleet" };

  it("load GETs config with site+slug and returns the body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(DEFAULT_STORAGE));
    const store = createAppDashboardStore(fetchImpl);
    const config = await store.load(ref);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/app/api/dashboard/config?site=ops-site&slug=fleet"
    );
    expect(config).toEqual(DEFAULT_STORAGE);
  });

  it("load returns null on 404", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "nf" }, 404));
    const store = createAppDashboardStore(fetchImpl);
    expect(await store.load(ref)).toBeNull();
  });

  it("save PUTs {site, slug, config} — the exact legacy payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const store = createAppDashboardStore(fetchImpl);
    await store.save(ref, DEFAULT_STORAGE);
    expect(fetchImpl).toHaveBeenCalledWith("/app/api/dashboard/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site: "ops-site", slug: "fleet", config: DEFAULT_STORAGE }),
    });
  });

  it("save throws on non-ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    const store = createAppDashboardStore(fetchImpl);
    await expect(store.save(ref, DEFAULT_STORAGE)).rejects.toThrow(/500/);
  });

  it("list unwraps {data} and URL-encodes the scope", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: [{ slug: "a", name: "A" }] }));
    const store = createAppDashboardStore(fetchImpl);
    const rows = await store.list("my site");
    expect(fetchImpl).toHaveBeenCalledWith(
      "/app/api/dashboard/configs?site=my%20site"
    );
    expect(rows).toEqual([{ slug: "a", name: "A" }]);
  });

  it("remove DELETEs with site+slug", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const store = createAppDashboardStore(fetchImpl);
    await store.remove(ref);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/app/api/dashboard/config?site=ops-site&slug=fleet",
      { method: "DELETE" }
    );
  });
});

describe("createAppDataSourceProvider (Seam D)", () => {
  it("maps DataSourceListItem down to the host-agnostic descriptor", async () => {
    const item: DataSourceListItem = {
      id: "ds1",
      name: "Ops PgREST",
      type: "POSTGREST",
      description: "main",
      siteId: "ops-site",
      authMethod: "TOKEN",
      connectionConfig: { url: "https://pgrest.internal", maskedToken: "***" },
      isActive: true,
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([item]));
    const provider = createAppDataSourceProvider("ops-site", fetchImpl);
    const sources = await provider.listDataSources();
    expect(fetchImpl).toHaveBeenCalledWith("/app/api/data-sources?siteId=ops-site");
    // Credentials/connection details must NOT cross the seam.
    expect(sources).toEqual([
      {
        id: "ds1",
        name: "Ops PgREST",
        type: "POSTGREST",
        description: "main",
        isActive: true,
      },
    ]);
  });
});

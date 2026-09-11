import { describe, expect, it } from "vitest";
import { carrierNavAllowed } from "./carrier-matrix";

// Contrato: diseno_pt1_portal.md §B (matriz validada por Erick 2026-07-21/22)
describe("carrierNavAllowed", () => {
  it("permite la operación del carrier", () => {
    for (const href of [
      "/home",
      "/shipping",
      "/delivery",
      "/finished",
      "/mytasks?status=pending",
      "/geographic-view",
      "/symptoms",
      "/signal-history",
      "/whatsapp/conversations",
      "/gemelo/replay",
      "/gemelo/simulador",
      "/gxc",
      "/gxc/camion",
      "/gxc/conductor",
      "/gxc/ruta",
      "/gxc/carrier/76091703-6", // su propio perfil (N3) sí entra
      "/collaborators-management",
      "/fleet-management",
      "/users/settings/organizations",
    ]) {
      expect(carrierNavAllowed(href), href).toBe(true);
    }
  });

  it("niega lo que quedó fuera de la v1", () => {
    for (const href of [
      "/planning", // asignación es de torre
      "/gxc/carrier", // ranking entre pares = fuga comercial
      "/calendar",
      "/where-is-my-load",
      "/live-streams/facility-scl",
      "/live-streams/devices",
      "/integrations/jobs",
      "/users/settings/data-sources",
      "/admin/console/logs",
    ]) {
      expect(carrierNavAllowed(href), href).toBe(false);
    }
  });

  it("niega por defecto lo desconocido (allowlist, no denylist)", () => {
    expect(carrierNavAllowed("/ruta-inventada")).toBe(false);
    expect(carrierNavAllowed("/reports")).toBe(false);
  });

  it("normaliza querystring y slashes", () => {
    expect(carrierNavAllowed("/shipping?foo=1")).toBe(true);
    expect(carrierNavAllowed("/planning?x=1")).toBe(false);
    expect(carrierNavAllowed("/gxc/carrier/")).toBe(false);
  });
});

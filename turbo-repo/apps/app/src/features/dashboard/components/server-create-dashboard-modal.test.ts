import { describe, expect, it } from "vitest";
import { serverDashboardSlug } from "./server-create-dashboard-modal";

describe("serverDashboardSlug", () => {
  it("turns a name into the server's id format", () => {
    expect(serverDashboardSlug("Centro de Control")).toBe("centro-de-control");
    expect(serverDashboardSlug("Mantención · Flota_2")).toBe(
      "mantencion-flota-2"
    );
    expect(serverDashboardSlug("  --Torre--  ")).toBe("torre");
  });

  it("is empty when nothing usable remains", () => {
    expect(serverDashboardSlug("¡¿?!")).toBe("");
  });

  it("stays within 80 characters without a trailing hyphen", () => {
    const slug = serverDashboardSlug(`${"a".repeat(79)} b`);
    expect(slug).toHaveLength(79);
    expect(slug).toMatch(/^[a-z0-9][a-z0-9-]{0,79}$/);
  });
});

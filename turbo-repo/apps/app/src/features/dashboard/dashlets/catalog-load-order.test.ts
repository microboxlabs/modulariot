// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { expect, it } from "vitest";

// The catalog imports widgets that import the dashboard context, which imports the
// catalog back. Loading the catalog first must not capture it before it is initialized.
it("gives the context fallback the catalog when the catalog loads first", async () => {
  const dashlets = await import("./index");
  const { useOptionalDashboard } = await import("../context/dashboard-context");
  const { result } = renderHook(() => useOptionalDashboard());
  expect(result.current.registry).toBe(dashlets.dashboardRegistry);
  expect(result.current.registry.all().length).toBeGreaterThan(0);
});

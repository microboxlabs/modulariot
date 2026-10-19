// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { resolveDashletPreview } from "@/features/dashboard/dashlets/dashlet-preview";

import { widgetToDashlet, type WidgetSpec } from "./chat-answer";

const spec: WidgetSpec = {
  id: "w1",
  kind: "table",
  title: "Horas por transportista",
  x: "carrier",
  y: ["driving_hours"],
  unit: "h",
  columns: ["carrier", "driving_hours"],
  rows: [
    { carrier: "Cordillera Cargo", driving_hours: "5633.4" },
    { carrier: "Altiplano Freight", driving_hours: "5001.8" },
  ],
};

describe("chat widgets render as dashboard dashlets", () => {
  it.each(["kpi", "table", "bar", "line", "pie"] as const)(
    "%s resolves to a chat dashlet",
    (kind) => {
      const { dashletId, config } = widgetToDashlet({ ...spec, kind });
      expect(resolveDashletPreview(dashletId, config).status).toBe("ok");
    }
  );

  it("a table shows its rows", () => {
    const { dashletId, config } = widgetToDashlet(spec);
    const resolved = resolveDashletPreview(dashletId, config);
    if (resolved.status !== "ok") throw new Error(resolved.status);
    const { Component, widget } = resolved;
    render(<Component widget={widget} editMode={false} />);
    expect(screen.getByText("Cordillera Cargo")).toBeTruthy();
    expect(screen.getByText("Altiplano Freight")).toBeTruthy();
  });
});

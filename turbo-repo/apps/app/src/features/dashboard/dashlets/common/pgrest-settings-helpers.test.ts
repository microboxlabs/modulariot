import { describe, it, expect, vi } from "vitest";

vi.mock("@/features/i18n/tr.service", () => ({
  tr: (key: string) => key,
}));

import { buildPgrestContentLabels } from "./pgrest-settings-helpers";

// The pure builders moved to @microboxlabs/miot-dashboard-ui (P3) and are
// tested there; only the tr()-backed label builder remains app-side.
describe("buildPgrestContentLabels", () => {
  it("returns labels using tr() for each key", () => {
    const labels = buildPgrestContentLabels({});
    expect(labels.functionName).toBe("dashboard.settings.functionName");
    expect(labels.httpMethod).toBe("dashboard.settings.httpMethod");
    expect(labels.parameters).toBe("dashboard.settings.parameters");
    expect(labels.key).toBe("dashboard.settings.key");
    expect(labels.value).toBe("common.value");
    expect(labels.addParameter).toBe("dashboard.settings.addParameter");
  });
});

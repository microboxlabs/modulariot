import { describe, it, expect, vi } from "vitest";

vi.mock("@/features/i18n/tr.service", () => ({
  tr: (key: string) => key,
}));

import {
  defaultOnColumnsDetected,
  buildSimplePgrestConfig,
  buildColumnsFromKeys,
  syncColumnsFromKeys,
  buildPgrestSettingsConfig,
  buildPgrestContentLabels,
} from "./pgrest-settings-helpers";

describe("defaultOnColumnsDetected", () => {
  it("builds ColumnItem[] with raw keys and humanized labels", () => {
    const result = defaultOnColumnsDetected(["p_site_id", "device_name"]);
    expect(result[0].key).toBe("p_site_id");
    expect(result[0].label).toBe("Site Id");
    expect(result[1].key).toBe("device_name");
    expect(result[1].label).toBe("Device Name");
  });

  it('sets type to "text"', () => {
    const result = defaultOnColumnsDetected(["foo"]);
    expect(result[0].type).toBe("text");
  });

  it("returns empty array for empty keys", () => {
    expect(defaultOnColumnsDetected([])).toEqual([]);
  });
});

describe("buildColumnsFromKeys", () => {
  it('wraps keys as "{{row.key}}" format', () => {
    const result = buildColumnsFromKeys(["status"]);
    expect(result[0].key).toBe("{{row.status}}");
  });

  it("humanizes label from key", () => {
    const result = buildColumnsFromKeys(["p_device_type"]);
    expect(result[0].label).toBe("Device Type");
  });

  it("returns empty array for empty keys", () => {
    expect(buildColumnsFromKeys([])).toEqual([]);
  });
});

describe("buildSimplePgrestConfig", () => {
  it("returns pgrest config with defaults", () => {
    const config = buildSimplePgrestConfig({});
    expect(config.pgrestFunctionName).toBe("");
    expect(config.pgrestParams).toEqual([]);
    expect(config.pgrestHttpMethod).toBe("POST");
    expect(config.dataSourceId).toBeUndefined();
    expect(typeof config.onColumnsDetected).toBe("function");
    expect(typeof config.setColumns).toBe("function");
  });

  it("uses provided values over defaults", () => {
    const config = buildSimplePgrestConfig({
      pgrestFunctionName: "my_func",
      pgrestParams: [{ key: "k", value: "v" }],
      pgrestHttpMethod: "GET",
      dataSourceId: "ds-1",
    });
    expect(config.pgrestFunctionName).toBe("my_func");
    expect(config.pgrestParams).toEqual([{ key: "k", value: "v" }]);
    expect(config.pgrestHttpMethod).toBe("GET");
    expect(config.dataSourceId).toBe("ds-1");
  });

  it("passes onDetectionComplete through", () => {
    const cb = vi.fn();
    const config = buildSimplePgrestConfig({}, cb);
    expect(config.onDetectionComplete).toBe(cb);
  });
});

describe("syncColumnsFromKeys", () => {
  it("calls setColumns with built columns", () => {
    const syncer = {
      setColumns: vi.fn(),
      setFilterItems: vi.fn((fn) => fn([])),
      setSortColumns: vi.fn((fn) => fn([])),
    };
    syncColumnsFromKeys(["name"], syncer);
    expect(syncer.setColumns).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ key: "{{row.name}}" })]),
    );
  });

  it("filters sort columns to detected keys only", () => {
    const syncer = {
      setColumns: vi.fn(),
      setFilterItems: vi.fn((fn) => fn([])),
      setSortColumns: vi.fn(),
    };
    syncColumnsFromKeys(["name"], syncer);
    const sortFn = syncer.setSortColumns.mock.calls[0][0];
    expect(sortFn(["{{row.name}}", "{{row.missing}}"])).toEqual(["{{row.name}}"]);
  });

  it("calls onDetectionComplete when provided", () => {
    const syncer = {
      setColumns: vi.fn(),
      setFilterItems: vi.fn((fn) => fn([])),
      setSortColumns: vi.fn((fn) => fn([])),
    };
    const cb = vi.fn();
    syncColumnsFromKeys(["name"], syncer, cb);
    expect(cb).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ key: "{{row.name}}" })]),
    );
  });
});

describe("buildPgrestSettingsConfig", () => {
  it("returns onColumnsDetected that builds columns from keys", () => {
    const syncer = {
      setColumns: vi.fn(),
      setFilterItems: vi.fn(),
      setSortColumns: vi.fn(),
    };
    const config = buildPgrestSettingsConfig(syncer);
    const cols = config.onColumnsDetected(["a"]);
    expect(cols[0].key).toBe("{{row.a}}");
  });

  it("returns setColumns referencing the syncer", () => {
    const syncer = {
      setColumns: vi.fn(),
      setFilterItems: vi.fn(),
      setSortColumns: vi.fn(),
    };
    const config = buildPgrestSettingsConfig(syncer);
    expect(config.setColumns).toBe(syncer.setColumns);
  });
});

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

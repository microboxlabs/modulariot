import { describe, it, expect } from "vitest";
import { resolveFilterParams } from "./resolve-filter-params";
import { EMPTY_PGREST_PARAMS } from "./pgrest-types";

describe("resolveFilterParams", () => {
  it("returns EMPTY_PGREST_PARAMS for empty params array", () => {
    const result = resolveFilterParams([], {});
    expect(result).toBe(EMPTY_PGREST_PARAMS);
  });

  it("passes through non-template params unchanged", () => {
    const params = [{ key: "p_id", value: "123" }];
    const result = resolveFilterParams(params, {});
    expect(result).toEqual([{ key: "p_id", value: "123" }]);
  });

  it("resolves {{filter.status}} with activeFilters", () => {
    const params = [{ key: "p_status", value: "eq.{{filter.status}}" }];
    const result = resolveFilterParams(params, { status: "active" });
    expect(result).toEqual([{ key: "p_status", value: "eq.active" }]);
  });

  it("drops template params that resolve to empty string", () => {
    const params = [{ key: "p_status", value: "{{filter.missing}}" }];
    const result = resolveFilterParams(params, {});
    expect(result).toEqual([]);
  });

  it('drops template params that resolve to operator-only ("eq.")', () => {
    const params = [{ key: "p_status", value: "eq.{{filter.missing}}" }];
    const result = resolveFilterParams(params, {});
    expect(result).toEqual([]);
  });

  it("mixes template and non-template params correctly", () => {
    const params = [
      { key: "p_site", value: "site-1" },
      { key: "p_status", value: "eq.{{filter.status}}" },
      { key: "p_limit", value: "100" },
    ];
    const result = resolveFilterParams(params, { status: "active" });
    expect(result).toEqual([
      { key: "p_site", value: "site-1" },
      { key: "p_status", value: "eq.active" },
      { key: "p_limit", value: "100" },
    ]);
  });

  it("strips _fromTemplate from output", () => {
    const params = [{ key: "p_status", value: "eq.{{filter.status}}" }];
    const result = resolveFilterParams(params, { status: "active" });
    for (const p of result) {
      expect(p).not.toHaveProperty("_fromTemplate");
    }
  });

  it("handles multiple template params with missing filters", () => {
    const params = [
      { key: "p_a", value: "{{filter.a}}" },
      { key: "p_b", value: "{{filter.b}}" },
    ];
    const result = resolveFilterParams(params, { a: "val" });
    expect(result).toEqual([{ key: "p_a", value: "val" }]);
  });
});

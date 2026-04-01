import { describe, it, expect } from "vitest";
import {
  humanizeKey,
  toPgrestParamItems,
  fromPgrestParamItems,
  EMPTY_PGREST_PARAMS,
} from "./pgrest-types";

describe("humanizeKey", () => {
  it("strips p_ prefix", () => {
    expect(humanizeKey("p_param_name")).toBe("Param Name");
  });

  it("strips v_ prefix", () => {
    expect(humanizeKey("v_var")).toBe("Var");
  });

  it("capitalizes each word", () => {
    expect(humanizeKey("some_thing")).toBe("Some Thing");
  });

  it("handles single word", () => {
    expect(humanizeKey("name")).toBe("Name");
  });

  it("handles key with no prefix", () => {
    expect(humanizeKey("device_status")).toBe("Device Status");
  });
});

describe("toPgrestParamItems", () => {
  it("adds _id with format pp-{index}-{key}", () => {
    const result = toPgrestParamItems([{ key: "p_id", value: "123" }]);
    expect(result).toEqual([{ key: "p_id", value: "123", _id: "pp-0-p_id" }]);
  });

  it("preserves key and value for multiple items", () => {
    const params = [
      { key: "a", value: "1" },
      { key: "b", value: "2" },
    ];
    const result = toPgrestParamItems(params);
    expect(result).toHaveLength(2);
    expect(result[0]._id).toBe("pp-0-a");
    expect(result[1]._id).toBe("pp-1-b");
  });

  it("handles empty array", () => {
    expect(toPgrestParamItems([])).toEqual([]);
  });
});

describe("fromPgrestParamItems", () => {
  it("strips _id, returns only key/value", () => {
    const items = [{ key: "p_id", value: "123", _id: "pp-0-p_id" }];
    expect(fromPgrestParamItems(items)).toEqual([{ key: "p_id", value: "123" }]);
  });

  it("handles empty array", () => {
    expect(fromPgrestParamItems([])).toEqual([]);
  });
});

describe("EMPTY_PGREST_PARAMS", () => {
  it("is an empty array", () => {
    expect(EMPTY_PGREST_PARAMS).toEqual([]);
  });

  it("is referentially stable", () => {
    expect(EMPTY_PGREST_PARAMS).toBe(EMPTY_PGREST_PARAMS);
  });
});

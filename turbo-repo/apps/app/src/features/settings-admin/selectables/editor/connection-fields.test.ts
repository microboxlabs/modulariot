import { describe, expect, it } from "vitest";
import { checkItems, itemFields, responseLists } from "./connection-fields";

const COUNTRIES = {
  type: "object",
  properties: {
    msg: { type: "string" },
    data: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          Iso2: { type: "string" },
          zone: { type: "object", properties: { code: { type: "string" } } },
        },
      },
    },
    meta: {
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: { type: "object", properties: { label: { type: "string" } } },
        },
      },
    },
  },
};

describe("responseLists", () => {
  it("finds every array and the leaf fields of its items", () => {
    const lists = responseLists(COUNTRIES);

    expect([...lists.keys()]).toEqual(["data", "meta.tags"]);
    expect(lists.get("data")).toEqual(["name", "Iso2", "zone.code"]);
  });

  it("names an answer that is itself an array with the empty path", () => {
    const lists = responseLists({
      type: "array",
      items: { type: "object", properties: { id: { type: "string" } } },
    });

    expect(lists.get("")).toEqual(["id"]);
  });

  it("is empty with no schema", () => {
    expect(responseLists(null).size).toBe(0);
  });
});

describe("itemFields", () => {
  const lists = responseLists(COUNTRIES);

  it("offers the fields of the list the items template names", () => {
    expect(itemFields(lists, "{{ response.meta.tags }}")).toEqual(["label"]);
  });

  it("offers the list the API would pick when items is blank", () => {
    expect(itemFields(lists, "")).toEqual(["name", "Iso2", "zone.code"]);
  });

  it("offers every list's fields when the template names none of them", () => {
    expect(itemFields(lists, "{{response.other}}")).toEqual([
      "name",
      "Iso2",
      "zone.code",
      "label",
    ]);
  });
});

describe("checkItems", () => {
  it("accepts one variable over the response, or nothing", () => {
    expect(checkItems("{{response.data}}").status).toBe("valid");
    expect(checkItems("").status).toBe("none");
  });

  it("refuses text around the variable, another root, or a block", () => {
    expect(checkItems("list: {{response.data}}").problem?.code).toBe(
      "notSingle"
    );
    expect(checkItems("{{item.data}}").status).toBe("invalid");
    expect(checkItems("{{#each response.data}}").status).toBe("invalid");
  });
});

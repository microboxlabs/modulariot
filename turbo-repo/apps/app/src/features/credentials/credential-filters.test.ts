import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  filterCredentials,
  hasActiveFilters,
  sortCredentials,
} from "./credential-filters";
import type { CredentialListItem } from "./credential.types";

function credential(
  overrides: Partial<CredentialListItem> & Pick<CredentialListItem, "id">
): CredentialListItem {
  return {
    name: "Credential",
    typeId: "AZURE_ENTRA_CLIENT_CREDENTIALS",
    environment: "QA",
    summary: "00000000-1111-2222-3333-444444444444",
    usedBy: [],
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    updatedBy: "someone@example.com",
    config: {},
    ...overrides,
  };
}

const CREDENTIALS: CredentialListItem[] = [
  credential({
    id: "a",
    name: "Alpha production",
    environment: "PRODUCTION",
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    lastTestedAt: "2026-07-20T00:00:00.000Z",
    lastTestResult: true,
  }),
  credential({
    id: "b",
    name: "Bravo staging",
    environment: "staging",
    summary: "aaaa1111-bbbb-2222-cccc-333333333333",
    typeId: "OAUTH2_CLIENT_CREDENTIALS",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
    lastTestedAt: "2026-07-21T00:00:00.000Z",
    lastTestResult: false,
  }),
  credential({
    id: "c",
    name: "Charlie qa",
    environment: "QA",
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
  }),
];

describe("filterCredentials", () => {
  it("returns everything with the default filters", () => {
    expect(filterCredentials(CREDENTIALS, DEFAULT_FILTERS)).toHaveLength(3);
  });

  it("matches the query against the name", () => {
    const result = filterCredentials(CREDENTIALS, {
      ...DEFAULT_FILTERS,
      query: "bravo",
    });

    expect(result.map((item) => item.id)).toEqual(["b"]);
  });

  it("matches the query against the stored identifier", () => {
    const result = filterCredentials(CREDENTIALS, {
      ...DEFAULT_FILTERS,
      query: "aaaa1111",
    });

    expect(result.map((item) => item.id)).toEqual(["b"]);
  });

  it("matches the query against the type, in any language", () => {
    const result = filterCredentials(CREDENTIALS, {
      ...DEFAULT_FILTERS,
      query: "entra",
    });

    expect(result.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("filters by type, with an empty selection meaning all", () => {
    expect(
      filterCredentials(CREDENTIALS, {
        ...DEFAULT_FILTERS,
        types: ["OAUTH2_CLIENT_CREDENTIALS"],
      }).map((item) => item.id)
    ).toEqual(["b"]);
    expect(
      filterCredentials(CREDENTIALS, { ...DEFAULT_FILTERS, types: [] })
    ).toHaveLength(3);
  });

  it("accepts several types or environments at once", () => {
    const result = filterCredentials(CREDENTIALS, {
      ...DEFAULT_FILTERS,
      environments: ["PRODUCTION", "QA"],
    });

    expect(result.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("filters by environment, case-insensitively", () => {
    const result = filterCredentials(CREDENTIALS, {
      ...DEFAULT_FILTERS,
      environments: ["STAGING"],
    });

    expect(result.map((item) => item.id)).toEqual(["b"]);
  });

  it("combines filters", () => {
    const result = filterCredentials(CREDENTIALS, {
      query: "a",
      types: ["AZURE_ENTRA_CLIENT_CREDENTIALS"],
      environments: ["PRODUCTION"],
    });

    expect(result.map((item) => item.id)).toEqual(["a"]);
  });
});

describe("sortCredentials", () => {
  it("orders by last updated", () => {
    const result = sortCredentials(CREDENTIALS, "UPDATED_DESC");

    expect(result.map((item) => item.id)).toEqual(["b", "a", "c"]);
  });

  it("orders by last created, which is not the same order", () => {
    const result = sortCredentials(CREDENTIALS, "CREATED_DESC");

    expect(result.map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

  it("sorts by name in both directions", () => {
    expect(sortCredentials(CREDENTIALS, "NAME_ASC").map((i) => i.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(sortCredentials(CREDENTIALS, "NAME_DESC").map((i) => i.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("does not mutate the input", () => {
    const input = [...CREDENTIALS];

    sortCredentials(input, "NAME_DESC");

    expect(input.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
});

describe("hasActiveFilters", () => {
  it("is false for the defaults and true once anything is set", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, query: "  " })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, query: "qa" })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, environments: ["QA"] })).toBe(
      true
    );
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, types: ["API_KEY"] })).toBe(
      true
    );
  });
});

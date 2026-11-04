import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAllContacts,
  parseScriptContext,
  parseScriptSamples,
  type TowerContact,
} from "./control-tower-api";

afterEach(() => vi.unstubAllGlobals());

describe("fetchAllContacts", () => {
  it("follows each page cursor and returns all contacts in order", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ items: [{ id: "first" }], next: "page-2" })
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [{ id: "second" }], next: null }))
      );
    vi.stubGlobal("fetch", fetchMock);

    const contacts = await fetchAllContacts({ kind: "member" });

    expect(contacts.map((contact: TowerContact) => contact.id)).toEqual([
      "first",
      "second",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("kind=member");
    expect(String(fetchMock.mock.calls[1][0])).toContain("cursor=page-2");
  });
});

describe("script response validation", () => {
  const context = {
    case: { id: -3 },
    condition: { speed: 80 },
    trip: {},
    vehicle: { plate: "TEST" },
  };
  const sample = {
    symptom_id: -3,
    asset_id: "TEST",
    icu_code: 4,
    opened_at: "2026-11-04T12:00:00Z",
    context,
  };
  it("preserves case data and accepts a structured sample", () => {
    expect(parseScriptContext(context)).toEqual(context);
    expect(parseScriptSamples([sample])).toEqual([sample]);
  });
  it("rejects malformed contexts and samples at the API boundary", () => {
    expect(() => parseScriptContext([])).toThrow();
    expect(() => parseScriptContext({ case: [] })).toThrow();
    expect(() =>
      parseScriptSamples([{ ...sample, icu_code: "four" }])
    ).toThrow();
    expect(() =>
      parseScriptSamples([{ ...sample, opened_at: "not-a-date" }])
    ).toThrow();
  });
});

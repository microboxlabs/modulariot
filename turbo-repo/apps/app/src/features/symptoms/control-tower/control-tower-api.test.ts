import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAllContacts, type TowerContact } from "./control-tower-api";

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

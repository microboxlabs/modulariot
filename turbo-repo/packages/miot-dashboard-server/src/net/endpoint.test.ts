import { describe, expect, it, vi } from "vitest";
import {
  EndpointError,
  fetchJson,
  fillHeaderTemplate,
  fillTemplate,
  placeholderProblem,
  readGroupsAt,
  readIdentifierAt,
  readPath,
  secureUrlProblem,
} from "./endpoint";

const answering = (
  status: number,
  body: unknown,
  init: ResponseInit = {},
): typeof fetch =>
  vi.fn(() =>
    Promise.resolve(
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
        ...init,
      }),
    ),
  ) as unknown as typeof fetch;

const request = (fetchImpl: typeof fetch, absent: readonly number[] = [404]) =>
  fetchJson({
    url: new URL("https://host.test/members"),
    method: "GET" as const,
    headers: {},
    timeoutMs: 1000,
    absentStatuses: absent,
    fetchImpl,
  });

describe("secureUrlProblem", () => {
  it("accepts https and refuses http", () => {
    expect(secureUrlProblem("https://host.test/x", "The URL")).toBeNull();
    expect(secureUrlProblem("http://host.test/x", "The URL")).toMatch(/https/);
  });

  it("allows http on loopback, where there is nothing in between", () => {
    expect(secureUrlProblem("http://127.0.0.1:8080/x", "The URL")).toBeNull();
    expect(secureUrlProblem("http://localhost/x", "The URL")).toBeNull();
  });

  it("refuses a host that only looks like loopback", () => {
    // The name is resolved by whoever answers DNS.
    expect(secureUrlProblem("http://127.attacker.test/x", "The URL")).toMatch(
      /https/,
    );
  });

  it("reports something that is not a URL at all", () => {
    expect(secureUrlProblem("not a url", "The URL")).toMatch(/not a URL/);
  });
});

describe("fetchJson", () => {
  it("returns the parsed body", async () => {
    await expect(request(answering(200, { role: "Editor" }))).resolves.toEqual({
      kind: "found",
      body: { role: "Editor" },
    });
  });

  it("reports a configured absent status as absent, not as a failure", async () => {
    await expect(request(answering(404, {}))).resolves.toEqual({
      kind: "absent",
    });
  });

  it("treats 401 as a failure unless it is configured as absent", async () => {
    // From this server's side a 401 means its own credential was refused.
    // Reading it as "not a member" would deny every caller silently.
    await expect(request(answering(401, {}))).rejects.toThrowError(
      EndpointError,
    );
    await expect(request(answering(401, {}), [401])).resolves.toEqual({
      kind: "absent",
    });
  });

  it("refuses a redirect rather than following it", async () => {
    await expect(
      request(
        answering(302, "", {
          headers: { location: "https://elsewhere.test/" },
        }),
      ),
    ).rejects.toThrowError(/redirect/i);
  });

  it("does not follow redirects at the fetch layer either", async () => {
    const call = answering(200, {});
    await request(call);
    expect(call).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("fails on a body that is not JSON", async () => {
    const html = vi.fn(() =>
      Promise.resolve(new Response("<html>hi</html>", { status: 200 })),
    ) as unknown as typeof fetch;
    await expect(request(html)).rejects.toThrowError(/not JSON/);
  });

  it("turns a network failure into an EndpointError", async () => {
    const dead = vi.fn(() =>
      Promise.reject(new Error("ECONNREFUSED")),
    ) as unknown as typeof fetch;
    await expect(request(dead)).rejects.toThrowError(EndpointError);
    await expect(request(dead)).rejects.toThrowError(/ECONNREFUSED/);
  });

  it("names only the origin, never the path or the credential", async () => {
    const dead = vi.fn(() =>
      Promise.reject(new Error("no route")),
    ) as unknown as typeof fetch;
    await expect(
      fetchJson({
        url: new URL("https://host.test/secret-path?token=abc"),
        method: "GET",
        headers: { authorization: "Bearer sesame" },
        timeoutMs: 1000,
        absentStatuses: [404],
        fetchImpl: dead,
      }),
    ).rejects.toThrowError(/^https:\/\/host\.test did not answer/);
  });

  it("sends a JSON body only on POST", async () => {
    const call = answering(200, {});
    await fetchJson({
      url: new URL("https://host.test/lookup"),
      method: "POST",
      headers: {},
      body: { scopeId: "ops" },
      timeoutMs: 1000,
      absentStatuses: [404],
      fetchImpl: call,
    });
    expect(call).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: JSON.stringify({ scopeId: "ops" }),
        headers: expect.objectContaining({
          "content-type": "application/json",
        }),
      }),
    );
  });
});

describe("readPath", () => {
  it("follows a dotted path", () => {
    expect(readPath({ entry: { role: "SiteManager" } }, "entry.role")).toBe(
      "SiteManager",
    );
  });

  it("returns null for a path that does not exist", () => {
    expect(readPath({ entry: {} }, "entry.role")).toBeNull();
    expect(readPath(null, "entry")).toBeNull();
    expect(readPath("text", "length")).toBeNull();
  });

  it("does not walk into the prototype", () => {
    // Without the own-property check these read a function off Object, and a
    // truthy value where the host said nothing is how a denial becomes a grant.
    expect(readPath({}, "constructor")).toBeNull();
    expect(readPath({}, "__proto__.role")).toBeNull();
    expect(readPath({}, "toString")).toBeNull();
  });
});

describe("readIdentifierAt", () => {
  it("takes a string or a finite number", () => {
    expect(readIdentifierAt({ id: "ana" }, "id")).toBe("ana");
    expect(readIdentifierAt({ id: 42 }, "id")).toBe("42");
  });

  it("refuses an empty string, a boolean and a non-finite number", () => {
    expect(readIdentifierAt({ id: "" }, "id")).toBeNull();
    expect(readIdentifierAt({ id: true }, "id")).toBeNull();
    expect(readIdentifierAt({ id: Number.NaN }, "id")).toBeNull();
  });
});

describe("readGroupsAt", () => {
  it("reads an array or a separated string", () => {
    expect(readGroupsAt({ g: ["a", "b"] }, "g")).toEqual(["a", "b"]);
    expect(readGroupsAt({ g: "a, b  c" }, "g")).toEqual(["a", "b", "c"]);
  });

  it("drops entries that are not strings", () => {
    expect(readGroupsAt({ g: ["a", 1, null, "b"] }, "g")).toEqual(["a", "b"]);
  });

  it("is empty when the path matches nothing", () => {
    expect(readGroupsAt({}, "g")).toEqual([]);
  });
});

describe("fillTemplate", () => {
  it("encodes every value", () => {
    // A scope id is caller-supplied. Unencoded, this addresses a different
    // resource on the host than the one being asked about.
    expect(fillTemplate("/sites/{scopeId}", { scopeId: "../../admin" })).toBe(
      "/sites/..%2F..%2Fadmin",
    );
  });

  it("fills every occurrence", () => {
    expect(fillTemplate("{a}/{a}", { a: "x" })).toBe("x/x");
  });
});

describe("fillHeaderTemplate", () => {
  it("does not encode, so base64 survives", () => {
    // Encoding would turn + / = into %2B %2F %3D and the far end would reject
    // the credential.
    expect(
      fillHeaderTemplate("Basic {ticketBase64}", { ticketBase64: "a+b/c=" }),
    ).toBe("Basic a+b/c=");
  });

  it("refuses a value carrying a line break", () => {
    for (const value of ["a\r\nX-Admin: true", "a\nb", "a\rb"]) {
      expect(() =>
        fillHeaderTemplate("Bearer {ticket}", { ticket: value }),
      ).toThrowError(EndpointError);
    }
  });
});

describe("a redirect listed as an absent status", () => {
  it("is still refused, so configuration cannot turn one into a quiet no", async () => {
    await expect(
      request(
        answering(302, "", {
          headers: { location: "https://elsewhere.test/" },
        }),
        [302, 404],
      ),
    ).rejects.toThrowError(/redirect/i);
  });
});

describe("placeholderProblem", () => {
  const names = ["scopeId", "userId"];

  it("accepts placeholders in the path and the query", () => {
    expect(
      placeholderProblem(
        "https://host.test/people/{userId}/sites/{scopeId}?u={userId}",
        names,
        "The URL",
      ),
    ).toBeNull();
  });

  it.each([
    "https://{scopeId}/lookup",
    "https://host.{scopeId}.test/lookup",
    "https://host.test:{scopeId}/lookup",
    "https://{userId}:secret@host.test/lookup",
    "https://svc:{userId}@host.test/lookup",
  ])("refuses %s", (template) => {
    expect(placeholderProblem(template, names, "The URL")).toMatch(
      /scheme, credentials, host or port/,
    );
  });

  it("leaves something that is not a URL to secureUrlProblem", () => {
    expect(
      placeholderProblem("not a url {scopeId}", names, "The URL"),
    ).toBeNull();
  });
});

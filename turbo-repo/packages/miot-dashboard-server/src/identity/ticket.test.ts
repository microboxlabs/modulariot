import { describe, expect, it, vi } from "vitest";
import { EndpointError } from "../net/endpoint";
import {
  createTicketIdentityResolver,
  type TicketIdentityOptions,
} from "./ticket";

const VALIDATE_URL = "https://emitter.test/tickets/-me-";

const answering = (status: number, body: unknown = {}): typeof fetch =>
  vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    ),
  ) as unknown as typeof fetch;

const resolver = (
  fetchImpl: typeof fetch,
  options: Partial<TicketIdentityOptions> = {},
) =>
  createTicketIdentityResolver({
    header: "x-ticket",
    url: VALIDATE_URL,
    present: {
      kind: "header",
      name: "authorization",
      value: "Basic {ticketBase64}",
    },
    tenant: { kind: "fixed", tenantId: "acme" },
    claims: { userId: "entry.id" },
    fetchImpl,
    ...options,
  });

const carrying = (headers: Record<string, string>): Request =>
  new Request("https://server.test/scopes/ops/dashboards", { headers });

describe("createTicketIdentityResolver", () => {
  it("refuses a validation URL that is not https", () => {
    expect(() =>
      resolver(answering(200), { url: "http://emitter.test/x" }),
    ).toThrowError(EndpointError);
  });

  it("refuses to be built without the header callers use", () => {
    // No standard header carries a ticket, so a default would silently ignore
    // the real one and treat every request as anonymous.
    expect(() => resolver(answering(200), { header: "  " })).toThrowError(
      EndpointError,
    );
  });

  it("resolves an identity the emitter vouched for", async () => {
    const identity = await resolver(
      answering(200, {
        entry: { id: "ana", displayName: "Ana", groups: ["engineering"] },
      }),
      {
        claims: {
          userId: "entry.id",
          displayName: "entry.displayName",
          groups: "entry.groups",
        },
      },
    ).resolve(carrying({ "x-ticket": "TICKET_1" }));

    expect(identity).toMatchObject({
      userId: "ana",
      tenantId: "acme",
      kind: "user",
      displayName: "Ana",
      groups: ["engineering"],
    });
  });

  it("treats a request with no ticket as anonymous, not refused", async () => {
    const onReject = vi.fn();
    const call = answering(200, { entry: { id: "ana" } });
    await expect(
      resolver(call, { onReject }).resolve(carrying({})),
    ).resolves.toBeNull();
    expect(call).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
  });

  it("refuses a ticket the emitter does not accept, and says so", async () => {
    const onReject = vi.fn();
    await expect(
      resolver(answering(401), { onReject }).resolve(
        carrying({ "x-ticket": "STALE" }),
      ),
    ).resolves.toBeNull();
    expect(onReject).toHaveBeenCalledWith(expect.stringContaining("ticket"));
  });

  it("never puts the ticket in the reason it reports", async () => {
    const onReject = vi.fn();
    await resolver(answering(401), { onReject }).resolve(
      carrying({ "x-ticket": "SECRET_TICKET" }),
    );
    for (const [reason] of onReject.mock.calls) {
      expect(reason).not.toContain("SECRET_TICKET");
    }
  });

  it("throws when the emitter is unreachable, rather than refusing", async () => {
    // Answering 401 while the emitter is down rejects every valid ticket for
    // as long as the outage lasts.
    await expect(
      resolver(answering(503)).resolve(carrying({ "x-ticket": "TICKET_1" })),
    ).rejects.toThrowError(EndpointError);
  });

  it("refuses when the emitter accepts the ticket but names no user", async () => {
    const onReject = vi.fn();
    await expect(
      resolver(answering(200, { entry: {} }), { onReject }).resolve(
        carrying({ "x-ticket": "TICKET_1" }),
      ),
    ).resolves.toBeNull();
    expect(onReject).toHaveBeenCalledWith(expect.stringContaining("entry.id"));
  });

  it("reads the tenant from the emitter's answer when configured to", async () => {
    const identity = await resolver(
      answering(200, { entry: { id: "ana", org: "beta" } }),
      { tenant: { kind: "path", path: "entry.org" } },
    ).resolve(carrying({ "x-ticket": "TICKET_1" }));
    expect(identity).toMatchObject({ tenantId: "beta" });
  });

  it("refuses when the tenant path matches nothing", async () => {
    // Falling back to a fixed tenant here would put every ticket holder from
    // every emitter into one tenant.
    const onReject = vi.fn();
    await expect(
      resolver(answering(200, { entry: { id: "ana" } }), {
        tenant: { kind: "path", path: "entry.org" },
        onReject,
      }).resolve(carrying({ "x-ticket": "TICKET_1" })),
    ).resolves.toBeNull();
    expect(onReject).toHaveBeenCalledWith(expect.stringContaining("entry.org"));
  });

  it("presents the ticket base64-encoded, byte for byte", async () => {
    // URL-encoding this would mangle the + / = a base64 credential carries and
    // the emitter would reject every ticket.
    const call = answering(200, { entry: { id: "ana" } });
    await resolver(call).resolve(carrying({ "x-ticket": "a>b?c" }));
    expect(call).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: `Basic ${btoa("a>b?c")}`,
        }),
      }),
    );
  });

  it("presents the ticket as a query parameter when configured to", async () => {
    const call = answering(200, { entry: { id: "ana" } });
    await resolver(call, {
      present: { kind: "query", name: "alf_ticket" },
    }).resolve(carrying({ "x-ticket": "TICKET_1" }));
    expect(call).toHaveBeenCalledWith(
      new URL(`${VALIDATE_URL}?alf_ticket=TICKET_1`),
      expect.anything(),
    );
  });

  it("presents the ticket as a body when configured to", async () => {
    const call = answering(200, { entry: { id: "ana" } });
    await resolver(call, {
      method: "POST",
      present: { kind: "body" },
    }).resolve(carrying({ "x-ticket": "TICKET_1" }));
    expect(call).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ticket: "TICKET_1" }),
      }),
    );
  });

  it("fills the ticket into the validation URL, encoded", async () => {
    const call = answering(200, { entry: { id: "ana" } });
    await resolver(call, {
      url: "https://emitter.test/validate/{ticket}",
      present: { kind: "body" },
    }).resolve(carrying({ "x-ticket": "a/b" }));
    expect(call).toHaveBeenCalledWith(
      new URL("https://emitter.test/validate/a%2Fb"),
      expect.anything(),
    );
  });

  it("strips a scheme prefix when the caller sends one", async () => {
    const call = answering(200, { entry: { id: "ana" } });
    await resolver(call, {
      header: "authorization",
      scheme: "Ticket",
      present: { kind: "body" },
      method: "POST",
    }).resolve(carrying({ authorization: "Ticket TICKET_1" }));
    expect(call).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ body: JSON.stringify({ ticket: "TICKET_1" }) }),
    );
  });

  it("ignores a header carrying a different scheme", async () => {
    // A bearer JWT in the same header is not a ticket, and taking it as one
    // would send a token to the emitter on every request.
    const call = answering(200, { entry: { id: "ana" } });
    await expect(
      resolver(call, { header: "authorization", scheme: "Ticket" }).resolve(
        carrying({ authorization: "Bearer a.b.c" }),
      ),
    ).resolves.toBeNull();
    expect(call).not.toHaveBeenCalled();
  });

  it("validates a repeated ticket once", async () => {
    const call = answering(200, { entry: { id: "ana" } });
    const ticket = resolver(call);
    await ticket.resolve(carrying({ "x-ticket": "TICKET_1" }));
    await ticket.resolve(carrying({ "x-ticket": "TICKET_1" }));
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("does not answer one ticket from another ticket's validation", async () => {
    const call = answering(200, { entry: { id: "ana" } });
    const ticket = resolver(call);
    await ticket.resolve(carrying({ "x-ticket": "TICKET_1" }));
    await ticket.resolve(carrying({ "x-ticket": "TICKET_2" }));
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("does not revalidate a ticket the emitter already rejected", async () => {
    // Otherwise a caller replaying one bad ticket drives one call to the
    // emitter per request.
    const call = answering(401);
    const ticket = resolver(call);
    await ticket.resolve(carrying({ "x-ticket": "STALE" }));
    await ticket.resolve(carrying({ "x-ticket": "STALE" }));
    expect(call).toHaveBeenCalledTimes(1);
  });
});

describe("presenting the ticket in the body", () => {
  it("uses POST by default, so the body is actually sent", async () => {
    const call = answering(200, { entry: { id: "ana" } });
    await resolver(call, { present: { kind: "body" } }).resolve(
      carrying({ "x-ticket": "TICKET_abc" }),
    );
    expect(call).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ticket: "TICKET_abc" }),
      }),
    );
  });

  it("refuses an explicit GET, which would carry no ticket at all", () => {
    expect(() =>
      resolver(answering(200), { present: { kind: "body" }, method: "GET" }),
    ).toThrowError(/needs POST/);
  });
});

describe("a service credential beside the ticket", () => {
  it("requires the invalid-ticket statuses to be set", () => {
    // With the default in place, the emitter refusing this server's own
    // credential would read as an invalid ticket and be cached as one.
    expect(() =>
      resolver(answering(200), {
        headers: { authorization: "Bearer service-token" },
      }),
    ).toThrowError(/must be set/);
  });

  it("is accepted once they are", () => {
    expect(() =>
      resolver(answering(200), {
        headers: { authorization: "Bearer service-token" },
        absentStatuses: [404],
      }),
    ).not.toThrow();
  });
});

describe("the validation URL", () => {
  it("refuses a placeholder in the host", () => {
    expect(() =>
      resolver(answering(200), { url: "https://{ticket}.emitter.test/x" }),
    ).toThrowError(/scheme, credentials, host or port/);
  });
});

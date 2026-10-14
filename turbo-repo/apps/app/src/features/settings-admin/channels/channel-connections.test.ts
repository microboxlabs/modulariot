import { afterEach, describe, expect, it, vi } from "vitest";
import { createChannelConnection } from "./channel-connections";

const BASE = "/app/api/admin/orgs/acme/integrations";

function reply(status: number, body: unknown) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createChannelConnection", () => {
  const input = {
    name: "WhatsApp",
    baseUrl: "https://graph.example.test/v25.0",
    token: "t",
    credentialName: "WhatsApp token",
    metadata: {},
  };

  it("deletes the new credential when the connection is refused", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(201, { id: "cred-9" }))
      .mockResolvedValueOnce(reply(409, { message: "Name taken" }))
      .mockResolvedValueOnce(reply(204, {}));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createChannelConnection("acme", "WHATSAPP", input)
    ).rejects.toBeTruthy();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe(
      `${BASE}/credential-profiles/cred-9`
    );
    expect(fetchMock.mock.calls[2][1]).toEqual({ method: "DELETE" });
  });

  it("links a stored credential without creating one", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(201, { id: "c1" }));
    vi.stubGlobal("fetch", fetchMock);

    await createChannelConnection("acme", "RESEND", {
      name: "Email",
      baseUrl: "https://api.resend.com",
      credentialProfileId: "cred-1",
      metadata: { from: "Team <no-reply@example.test>" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/connections`);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      providerType: "RESEND",
      credentialProfileId: "cred-1",
    });
  });
});

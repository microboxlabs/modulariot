import { describe, expect, it, vi } from "vitest";
import { NO_CAPABILITIES, type IdentityResolver } from "../seams/identity";
import { createFirstMatchIdentityResolver } from "./chain";

const answering = (userId: string | null): IdentityResolver<Request> => ({
  resolve: vi.fn(() =>
    Promise.resolve(
      userId === null
        ? null
        : {
            userId,
            tenantId: "acme",
            kind: "user" as const,
            capabilities: { ...NO_CAPABILITIES },
          },
    ),
  ),
});

const failing = (): IdentityResolver<Request> => ({
  resolve: vi.fn(() => Promise.reject(new Error("issuer unreachable"))),
});

const request = new Request("https://server.test/");

describe("createFirstMatchIdentityResolver", () => {
  it("takes the first resolver that recognizes the request", async () => {
    const second = answering("ana");
    await expect(
      createFirstMatchIdentityResolver([answering(null), second]).resolve(
        request,
      ),
    ).resolves.toMatchObject({ userId: "ana" });
  });

  it("does not ask the rest once one has answered", async () => {
    const second = answering("bob");
    await createFirstMatchIdentityResolver([answering("ana"), second]).resolve(
      request,
    );
    expect(second.resolve).not.toHaveBeenCalled();
  });

  it("is anonymous when no resolver recognizes the request", async () => {
    await expect(
      createFirstMatchIdentityResolver([
        answering(null),
        answering(null),
      ]).resolve(request),
    ).resolves.toBeNull();
  });

  it("stops at a resolver that throws", async () => {
    // Its credential source is unavailable. Carrying on would let a later
    // resolver answer a question the first could not, turning an outage into
    // a different identity.
    const second = answering("ana");
    await expect(
      createFirstMatchIdentityResolver([failing(), second]).resolve(request),
    ).rejects.toThrowError("issuer unreachable");
    expect(second.resolve).not.toHaveBeenCalled();
  });

  it("refuses to be built empty", async () => {
    expect(() => createFirstMatchIdentityResolver([])).toThrowError(TypeError);
  });
});

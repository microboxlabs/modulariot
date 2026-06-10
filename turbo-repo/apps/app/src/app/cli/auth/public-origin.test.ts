import { afterEach, describe, expect, it, vi } from "vitest";
import { resolvePublicOrigin } from "./public-origin";

function req(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

describe("resolvePublicOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers the configured AUTH_URL origin over the internal request origin", () => {
    vi.stubEnv("AUTH_URL", "https://coordinador.mintral.cl/app/api/auth");
    // The proxy makes the request look like it came in on 0.0.0.0:3000.
    const origin = resolvePublicOrigin(
      req("http://0.0.0.0:3000/app/cli/auth/login", {
        "x-forwarded-host": "0.0.0.0:3000",
      }),
    );
    expect(origin).toBe("https://coordinador.mintral.cl");
  });

  it("falls back to NEXTAUTH_URL when AUTH_URL is empty/unset", () => {
    vi.stubEnv("AUTH_URL", "");
    vi.stubEnv("NEXTAUTH_URL", "https://app.example.com/app/api/auth");
    expect(resolvePublicOrigin(req("http://0.0.0.0:3000/x"))).toBe(
      "https://app.example.com",
    );
  });

  it("uses forwarded host/proto when no configured URL is set", () => {
    vi.stubEnv("AUTH_URL", "");
    vi.stubEnv("NEXTAUTH_URL", "");
    const origin = resolvePublicOrigin(
      req("http://0.0.0.0:3000/x", {
        "x-forwarded-host": "coordinador.mintral.cl",
        "x-forwarded-proto": "https",
      }),
    );
    expect(origin).toBe("https://coordinador.mintral.cl");
  });

  it("defaults forwarded proto to https and takes the first of a comma list", () => {
    vi.stubEnv("AUTH_URL", "");
    vi.stubEnv("NEXTAUTH_URL", "");
    const origin = resolvePublicOrigin(
      req("http://0.0.0.0:3000/x", {
        "x-forwarded-host": "coordinador.mintral.cl, internal-svc",
        "x-forwarded-proto": "https, http",
      }),
    );
    expect(origin).toBe("https://coordinador.mintral.cl");
  });

  it("falls back to the request origin for local dev (no config, no proxy)", () => {
    vi.stubEnv("AUTH_URL", "");
    vi.stubEnv("NEXTAUTH_URL", "");
    expect(
      resolvePublicOrigin(req("http://localhost:3050/app/cli/auth/login")),
    ).toBe("http://localhost:3050");
  });

  it("ignores a malformed configured URL and falls through to the proxy host", () => {
    vi.stubEnv("AUTH_URL", "not-a-valid-url");
    vi.stubEnv("NEXTAUTH_URL", "");
    const origin = resolvePublicOrigin(
      req("http://0.0.0.0:3000/x", {
        "x-forwarded-host": "coordinador.mintral.cl",
      }),
    );
    expect(origin).toBe("https://coordinador.mintral.cl");
  });
});

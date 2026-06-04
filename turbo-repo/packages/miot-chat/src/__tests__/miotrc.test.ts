import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readMiotrcProfile } from "../miotrc.js";
import { resolveConfig } from "../config.js";

let home = "";

function makeHome(miotrc?: object): string {
  const h = mkdtempSync(join(tmpdir(), "miot-miotrc-test-"));
  if (miotrc !== undefined) {
    writeFileSync(join(h, ".miotrc.json"), JSON.stringify(miotrc), {
      mode: 0o600,
    });
  }
  return h;
}

beforeEach(() => {
  home = makeHome();
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

// ── readMiotrcProfile ─────────────────────────────────────────────────────────

describe("readMiotrcProfile", () => {
  it("returns null when the file is missing", () => {
    const env = { HOME: home } as NodeJS.ProcessEnv;
    expect(readMiotrcProfile({ env })).toBeNull();
  });

  it("reads the default profile {baseUrl, token, organizationId}", () => {
    const h = makeHome({
      defaultProfile: "default",
      profiles: {
        default: {
          baseUrl: "https://miot.example.com",
          token: "abc-token",
          organizationId: "acme",
        },
      },
    });
    const env = { HOME: h } as NodeJS.ProcessEnv;
    const result = readMiotrcProfile({ env });
    expect(result).toEqual({
      baseUrl: "https://miot.example.com",
      token: "abc-token",
      organizationId: "acme",
    });
    rmSync(h, { recursive: true, force: true });
  });

  it("returns null on malformed JSON", () => {
    const h = makeHome();
    writeFileSync(join(h, ".miotrc.json"), "{ not valid json");
    const env = { HOME: h } as NodeJS.ProcessEnv;
    expect(readMiotrcProfile({ env })).toBeNull();
    rmSync(h, { recursive: true, force: true });
  });
});

// ── resolveConfig miotrc fallback ─────────────────────────────────────────────

describe("resolveConfig miotrc fallback", () => {
  it("adopts baseUrl+token+orgSlug together from the default miotrc profile", () => {
    const h = makeHome({
      defaultProfile: "default",
      profiles: {
        default: {
          baseUrl: "https://front-door.example.com",
          token: "miotrc-token",
          organizationId: "acme",
        },
      },
    });
    // configDir does NOT exist → chat config falls back to default profile
    // which has a null token, so the miotrc fallback kicks in.
    const configDir = join(h, ".miot-chat");
    const r = resolveConfig({
      configDir,
      env: { HOME: h } as NodeJS.ProcessEnv,
    });
    expect(r.token).toBe("miotrc-token");
    expect(r.baseUrl).toBe("https://front-door.example.com");
    expect(r.orgSlug).toBe("acme");
    expect(r.harnessBaseUrl).toBe(
      "https://front-door.example.com/api/v1/orgs/acme/harness",
    );
    rmSync(h, { recursive: true, force: true });
  });

  it("does NOT consult miotrc when the chat profile has its own token", () => {
    const h = makeHome({
      defaultProfile: "default",
      profiles: {
        default: {
          baseUrl: "https://miotrc.example.com",
          token: "miotrc-token",
          organizationId: "miotrc-org",
        },
      },
    });
    const configDir = join(h, ".miot-chat");
    mkdirSync(configDir, { recursive: true, mode: 0o700 });
    // Write a chat config with its own token; the miotrc should be ignored.
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({
        defaultProfile: "work",
        profiles: {
          work: {
            baseUrl: "https://chat.example.com",
            token: "chat-token",
            tenantId: "t-work",
            userId: "u-work",
          },
        },
      }),
    );
    const r = resolveConfig({
      configDir,
      env: { HOME: h } as NodeJS.ProcessEnv,
    });
    expect(r.token).toBe("chat-token");
    expect(r.baseUrl).toBe("https://chat.example.com");
    expect(r.orgSlug).toBeNull();
    rmSync(h, { recursive: true, force: true });
  });

  it("flag token suppresses the miotrc fallback entirely", () => {
    const h = makeHome({
      defaultProfile: "default",
      profiles: {
        default: {
          baseUrl: "https://miotrc.example.com",
          token: "miotrc-token",
          organizationId: "miotrc-org",
        },
      },
    });
    const configDir = join(h, ".miot-chat");
    const r = resolveConfig({
      configDir,
      env: { HOME: h } as NodeJS.ProcessEnv,
      flags: { token: "flag-token" },
    });
    expect(r.token).toBe("flag-token");
    expect(r.baseUrl).toBe("http://localhost:8000");
    rmSync(h, { recursive: true, force: true });
  });

  it("MIOT_CHAT_ORG empty string resolves to null (not empty string)", () => {
    const configDir = join(home, ".miot-chat");
    const r = resolveConfig({
      configDir,
      env: { HOME: home, MIOT_CHAT_ORG: "" } as NodeJS.ProcessEnv,
    });
    expect(r.orgSlug).toBeNull();
  });
});

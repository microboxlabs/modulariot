import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  removeProfile,
  resolveConfig,
  resolveOutputMode,
  upsertProfile,
} from "../config.js";

// Mock fs and os
vi.mock("node:fs", () => ({
  default: {
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    chmodSync: vi.fn(),
  },
}));

vi.mock("node:os", () => ({
  default: {
    homedir: () => "/home/test",
  },
}));

import fs from "node:fs";

const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockWriteFileSync = vi.mocked(fs.writeFileSync);
const mockChmodSync = vi.mocked(fs.chmodSync);

describe("resolveConfig", () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env["MIOT_BASE_URL"];
    delete process.env["MIOT_TOKEN"];
    delete process.env["MIOT_ORGANIZATION_ID"];
    mockReadFileSync.mockReset();
    mockWriteFileSync.mockReset();
    mockChmodSync.mockReset();
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("should use CLI flags first", () => {
    const config = resolveConfig({
      baseUrl: "https://flag.example.com",
      token: "flag-token",
    });
    expect(config).toEqual({
      baseUrl: "https://flag.example.com",
      token: "flag-token",
    });
  });

  it("should fall back to env vars", () => {
    process.env["MIOT_BASE_URL"] = "https://env.example.com";
    process.env["MIOT_TOKEN"] = "env-token";

    const config = resolveConfig({});
    expect(config).toEqual({
      baseUrl: "https://env.example.com",
      token: "env-token",
    });
  });

  it("should fall back to dotfile", () => {
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        defaultProfile: "staging",
        profiles: {
          staging: {
            baseUrl: "https://staging.example.com",
            token: "staging-token",
          },
        },
      }),
    );

    const config = resolveConfig({});
    expect(config).toEqual({
      baseUrl: "https://staging.example.com",
      token: "staging-token",
    });
  });

  it("should use named profile from dotfile", () => {
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        defaultProfile: "staging",
        profiles: {
          staging: {
            baseUrl: "https://staging.example.com",
            token: "staging-token",
          },
          production: {
            baseUrl: "https://prod.example.com",
            token: "prod-token",
          },
        },
      }),
    );

    const config = resolveConfig({ profile: "production" });
    expect(config).toEqual({
      baseUrl: "https://prod.example.com",
      token: "prod-token",
    });
  });

  it("should exit with code 3 when baseUrl is missing", () => {
    process.env["MIOT_TOKEN"] = "token";
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    resolveConfig({});
    expect(process.exit).toHaveBeenCalledWith(3);
  });

  it("should exit with code 3 when token is missing", () => {
    process.env["MIOT_BASE_URL"] = "https://example.com";
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    resolveConfig({});
    expect(process.exit).toHaveBeenCalledWith(3);
  });

  it("should handle missing dotfile gracefully", () => {
    process.env["MIOT_BASE_URL"] = "https://example.com";
    process.env["MIOT_TOKEN"] = "token";
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const config = resolveConfig({});
    expect(config).toEqual({
      baseUrl: "https://example.com",
      token: "token",
    });
  });

  it("should prioritize flags over env and dotfile", () => {
    process.env["MIOT_BASE_URL"] = "https://env.example.com";
    process.env["MIOT_TOKEN"] = "env-token";

    const config = resolveConfig({
      baseUrl: "https://flag.example.com",
      token: "flag-token",
    });
    expect(config).toEqual({
      baseUrl: "https://flag.example.com",
      token: "flag-token",
    });
  });
});

describe("dotfile profile persistence", () => {
  beforeEach(() => {
    mockReadFileSync.mockReset();
    mockWriteFileSync.mockReset();
    mockChmodSync.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("upserts a profile and keeps the existing default profile", () => {
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        defaultProfile: "staging",
        profiles: {
          staging: {
            baseUrl: "https://staging.example.com",
            token: "old-token",
          },
        },
      }),
    );

    upsertProfile("production", {
      baseUrl: "https://prod.example.com",
      token: "new-token",
      organizationId: "org-prod",
    });

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      "/home/test/.miotrc.json",
      `${JSON.stringify(
        {
          defaultProfile: "staging",
          profiles: {
            staging: {
              baseUrl: "https://staging.example.com",
              token: "old-token",
            },
            production: {
              baseUrl: "https://prod.example.com",
              token: "new-token",
              organizationId: "org-prod",
            },
          },
        },
        null,
        2,
      )}\n`,
      { encoding: "utf-8", mode: 0o600 },
    );
    expect(mockChmodSync).toHaveBeenCalledWith("/home/test/.miotrc.json", 0o600);
  });

  it("sets a default profile when creating the first profile", () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    upsertProfile("default", {
      baseUrl: "https://api.example.com",
      token: "token",
    });

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      "/home/test/.miotrc.json",
      `${JSON.stringify(
        {
          profiles: {
            default: {
              baseUrl: "https://api.example.com",
              token: "token",
            },
          },
          defaultProfile: "default",
        },
        null,
        2,
      )}\n`,
      { encoding: "utf-8", mode: 0o600 },
    );
  });

  it("removes a profile and moves the default to the next profile", () => {
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        defaultProfile: "staging",
        profiles: {
          staging: {
            baseUrl: "https://staging.example.com",
            token: "staging-token",
          },
          production: {
            baseUrl: "https://prod.example.com",
            token: "prod-token",
          },
        },
      }),
    );

    expect(removeProfile("staging")).toBe(true);

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      "/home/test/.miotrc.json",
      `${JSON.stringify(
        {
          defaultProfile: "production",
          profiles: {
            production: {
              baseUrl: "https://prod.example.com",
              token: "prod-token",
            },
          },
        },
        null,
        2,
      )}\n`,
      { encoding: "utf-8", mode: 0o600 },
    );
  });
});

describe("resolveOutputMode", () => {
  it("should return json when explicitly set", () => {
    expect(resolveOutputMode({ output: "json" })).toBe("json");
  });

  it("should return table when explicitly set", () => {
    expect(resolveOutputMode({ output: "table" })).toBe("table");
  });

  it("should return json when stdout is not a TTY", () => {
    const original = process.stdout.isTTY;
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });

    expect(resolveOutputMode({})).toBe("json");

    Object.defineProperty(process.stdout, "isTTY", { value: original, configurable: true });
  });

  it("should return table when stdout is a TTY", () => {
    const original = process.stdout.isTTY;
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });

    expect(resolveOutputMode({})).toBe("table");

    Object.defineProperty(process.stdout, "isTTY", { value: original, configurable: true });
  });
});

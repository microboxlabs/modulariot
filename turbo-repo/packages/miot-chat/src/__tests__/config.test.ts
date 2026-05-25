import { mkdtempSync, rmSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  readConfig,
  resolveConfig,
  writeConfig,
  type MiotChatConfig,
} from "../config.js";

let dir = "";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "miot-chat-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("readConfig", () => {
  it("returns defaults when no file exists", () => {
    expect(readConfig({ configDir: dir })).toEqual(DEFAULT_CONFIG);
  });

  it("returns defaults when the file is unparseable", () => {
    writeFileSync(join(dir, "config.json"), "{ this is not json");
    expect(readConfig({ configDir: dir })).toEqual(DEFAULT_CONFIG);
  });

  it("normalizes a parsed file into the full schema", () => {
    const file: Partial<MiotChatConfig> = {
      defaultProfile: "staging",
      profiles: {
        staging: {
          baseUrl: "https://staging.example.com",
          token: null,
          tenantId: "mintral",
          userId: "ops",
        },
      },
    };
    writeFileSync(join(dir, "config.json"), JSON.stringify(file));
    const cfg = readConfig({ configDir: dir });
    expect(cfg.defaultProfile).toBe("staging");
    expect(cfg.profiles.staging?.tenantId).toBe("mintral");
  });
});

describe("writeConfig", () => {
  it("writes the file with mode 0600", () => {
    writeConfig(DEFAULT_CONFIG, { configDir: dir });
    const path = join(dir, "config.json");
    const mode = statSync(path).mode & 0o777;
    expect(mode).toBe(0o600);
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as MiotChatConfig;
    expect(parsed).toEqual(DEFAULT_CONFIG);
  });
});

describe("resolveConfig precedence", () => {
  it("uses profile values when no flags or env are set", () => {
    const r = resolveConfig({ configDir: dir, env: {} });
    expect(r.baseUrl).toBe("http://localhost:8000");
    expect(r.tenantId).toBe("demo-tenant");
    expect(r.userId).toBe("demo-user");
    expect(r.mode).toBe("auto");
    expect(r.profileName).toBe("local");
  });

  it("env beats profile defaults", () => {
    const r = resolveConfig({
      configDir: dir,
      env: {
        MIOT_CHAT_BASE_URL: "http://env.example.com",
        MIOT_CHAT_TENANT_ID: "env-tenant",
      },
    });
    expect(r.baseUrl).toBe("http://env.example.com");
    expect(r.tenantId).toBe("env-tenant");
  });

  it("flags beat env and profile", () => {
    const r = resolveConfig({
      configDir: dir,
      env: {
        MIOT_CHAT_BASE_URL: "http://env.example.com",
        MIOT_CHAT_TENANT_ID: "env-tenant",
      },
      flags: { baseUrl: "http://flag.example.com", tenant: "flag-tenant" },
    });
    expect(r.baseUrl).toBe("http://flag.example.com");
    expect(r.tenantId).toBe("flag-tenant");
  });

  it("selects profile via flag, env, then config defaultProfile", () => {
    writeConfig(
      {
        defaultProfile: "local",
        profiles: {
          local: {
            baseUrl: "http://local",
            token: null,
            tenantId: "t-local",
            userId: "u-local",
          },
          staging: {
            baseUrl: "http://staging",
            token: "tok",
            tenantId: "mintral",
            userId: "ops",
          },
        },
      },
      { configDir: dir },
    );

    const byFlag = resolveConfig({
      configDir: dir,
      env: { MIOT_CHAT_PROFILE: "local" },
      flags: { profile: "staging" },
    });
    expect(byFlag.profileName).toBe("staging");
    expect(byFlag.baseUrl).toBe("http://staging");
    expect(byFlag.token).toBe("tok");

    const byEnv = resolveConfig({
      configDir: dir,
      env: { MIOT_CHAT_PROFILE: "staging" },
    });
    expect(byEnv.profileName).toBe("staging");

    const byDefault = resolveConfig({ configDir: dir, env: {} });
    expect(byDefault.profileName).toBe("local");
  });

  it("falls back to 'auto' for invalid mode values", () => {
    const r = resolveConfig({
      configDir: dir,
      env: {},
      flags: { mode: "bogus" },
    });
    expect(r.mode).toBe("auto");
  });

  it("accepts each valid mode", () => {
    for (const m of ["auto", "canned", "meta", "agentic"]) {
      const r = resolveConfig({
        configDir: dir,
        env: {},
        flags: { mode: m },
      });
      expect(r.mode).toBe(m);
    }
  });

  it("defaults debug to false; --debug flag wins over env", () => {
    const off = resolveConfig({ configDir: dir, env: {} });
    expect(off.debug).toBe(false);

    const byFlag = resolveConfig({
      configDir: dir,
      env: {},
      flags: { debug: true },
    });
    expect(byFlag.debug).toBe(true);

    const byEnv = resolveConfig({
      configDir: dir,
      env: { MIOT_CHAT_DEBUG: "1" },
    });
    expect(byEnv.debug).toBe(true);

    const envOff = resolveConfig({
      configDir: dir,
      env: { MIOT_CHAT_DEBUG: "0" },
    });
    expect(envOff.debug).toBe(false);

    // Precedence: when BOTH a flag and a conflicting env are present,
    // the flag wins (resolveConfig uses `flags.debug ?? env.…`). Pins
    // the title's claim with the actual conflicting input.
    const flagBeatsEnvOff = resolveConfig({
      configDir: dir,
      env: { MIOT_CHAT_DEBUG: "0" },
      flags: { debug: true },
    });
    expect(flagBeatsEnvOff.debug).toBe(true);
  });
});

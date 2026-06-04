import { mkdtempSync, rmSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  readConfig,
  resolveConfig,
  upsertProfile,
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
    const r = resolveConfig({ configDir: dir, env: { HOME: dir } as NodeJS.ProcessEnv });
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
        HOME: dir,
        MIOT_CHAT_BASE_URL: "http://env.example.com",
        MIOT_CHAT_TENANT_ID: "env-tenant",
      } as NodeJS.ProcessEnv,
    });
    expect(r.baseUrl).toBe("http://env.example.com");
    expect(r.tenantId).toBe("env-tenant");
  });

  it("flags beat env and profile", () => {
    const r = resolveConfig({
      configDir: dir,
      env: {
        HOME: dir,
        MIOT_CHAT_BASE_URL: "http://env.example.com",
        MIOT_CHAT_TENANT_ID: "env-tenant",
      } as NodeJS.ProcessEnv,
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
      env: { HOME: dir, MIOT_CHAT_PROFILE: "local" } as NodeJS.ProcessEnv,
      flags: { profile: "staging" },
    });
    expect(byFlag.profileName).toBe("staging");
    expect(byFlag.baseUrl).toBe("http://staging");
    expect(byFlag.token).toBe("tok");

    const byEnv = resolveConfig({
      configDir: dir,
      env: { HOME: dir, MIOT_CHAT_PROFILE: "staging" } as NodeJS.ProcessEnv,
    });
    expect(byEnv.profileName).toBe("staging");

    const byDefault = resolveConfig({ configDir: dir, env: { HOME: dir } as NodeJS.ProcessEnv });
    expect(byDefault.profileName).toBe("local");
  });

  it("falls back to 'auto' for invalid mode values", () => {
    const r = resolveConfig({
      configDir: dir,
      env: { HOME: dir } as NodeJS.ProcessEnv,
      flags: { mode: "bogus" },
    });
    expect(r.mode).toBe("auto");
  });

  it("accepts each valid mode", () => {
    for (const m of ["auto", "canned", "meta", "agentic"]) {
      const r = resolveConfig({
        configDir: dir,
        env: { HOME: dir } as NodeJS.ProcessEnv,
        flags: { mode: m },
      });
      expect(r.mode).toBe(m);
    }
  });

  it("defaults debug to false; --debug flag wins over env", () => {
    const off = resolveConfig({ configDir: dir, env: { HOME: dir } as NodeJS.ProcessEnv });
    expect(off.debug).toBe(false);

    const byFlag = resolveConfig({
      configDir: dir,
      env: { HOME: dir } as NodeJS.ProcessEnv,
      flags: { debug: true },
    });
    expect(byFlag.debug).toBe(true);

    const byEnv = resolveConfig({
      configDir: dir,
      env: { HOME: dir, MIOT_CHAT_DEBUG: "1" } as NodeJS.ProcessEnv,
    });
    expect(byEnv.debug).toBe(true);

    const envOff = resolveConfig({
      configDir: dir,
      env: { HOME: dir, MIOT_CHAT_DEBUG: "0" } as NodeJS.ProcessEnv,
    });
    expect(envOff.debug).toBe(false);

    // Precedence: when BOTH a flag and a conflicting env are present,
    // the flag wins (resolveConfig uses `flags.debug ?? env.…`). Pins
    // the title's claim with the actual conflicting input.
    const flagBeatsEnvOff = resolveConfig({
      configDir: dir,
      env: { HOME: dir, MIOT_CHAT_DEBUG: "0" } as NodeJS.ProcessEnv,
      flags: { debug: true },
    });
    expect(flagBeatsEnvOff.debug).toBe(true);
  });
});

describe("upsertProfile", () => {
  it("creates the config file when missing and sets defaultProfile", () => {
    const profile = {
      baseUrl: "https://platform.example.com",
      token: "tok-abc",
      tenantId: "t1",
      userId: "u1",
      orgSlug: "acme",
    };
    upsertProfile("platform", profile, { configDir: dir });
    const cfg = readConfig({ configDir: dir });
    expect(cfg.defaultProfile).toBe("platform");
    expect(cfg.profiles.platform?.token).toBe("tok-abc");
    expect(cfg.profiles.platform?.orgSlug).toBe("acme");
  });

  it("preserves other profiles and the existing default when upserting a second profile", () => {
    const profileA = {
      baseUrl: "https://a.example.com",
      token: "tok-a",
      tenantId: "ta",
      userId: "ua",
    };
    const profileB = {
      baseUrl: "https://b.example.com",
      token: "tok-b",
      tenantId: "tb",
      userId: "ub",
    };
    upsertProfile("a", profileA, { configDir: dir });
    upsertProfile("b", profileB, { configDir: dir });
    const cfg = readConfig({ configDir: dir });
    expect(cfg.defaultProfile).toBe("a");
    expect(cfg.profiles.a?.token).toBe("tok-a");
    expect(cfg.profiles.b?.token).toBe("tok-b");
  });

  it("promotes the upserted profile to default when makeDefault is true", () => {
    const profileA = {
      baseUrl: "https://a.example.com",
      token: "tok-a",
      tenantId: "ta",
      userId: "ua",
    };
    const profileB = {
      baseUrl: "https://b.example.com",
      token: "tok-b",
      tenantId: "tb",
      userId: "ub",
    };
    // Establish "a" as the default first
    upsertProfile("a", profileA, { configDir: dir });
    // Upsert "b" with makeDefault: true — should override the existing default
    upsertProfile("b", profileB, { configDir: dir, makeDefault: true });
    const cfg = readConfig({ configDir: dir });
    expect(cfg.defaultProfile).toBe("b");
    // Profile "a" must still be present
    expect(cfg.profiles.a?.token).toBe("tok-a");
    expect(cfg.profiles.b?.token).toBe("tok-b");
  });
});

describe("resolveConfig org-aware harness base URL", () => {
  it("no org slug → orgSlug is null and harnessBaseUrl equals baseUrl", () => {
    const r = resolveConfig({ configDir: dir, env: { HOME: dir } as NodeJS.ProcessEnv });
    expect(r.orgSlug).toBeNull();
    expect(r.harnessBaseUrl).toBe(r.baseUrl);
  });

  it("org slug via flag → builds quarkus proxy URL, trailing slash trimmed", () => {
    const r = resolveConfig({
      configDir: dir,
      env: { HOME: dir } as NodeJS.ProcessEnv,
      flags: { baseUrl: "https://miot.example.com/", org: "acme" },
    });
    expect(r.orgSlug).toBe("acme");
    expect(r.harnessBaseUrl).toBe(
      "https://miot.example.com/api/v1/orgs/acme/harness",
    );
  });

  it("org slug via env MIOT_CHAT_ORG → builds proxy URL", () => {
    const r = resolveConfig({
      configDir: dir,
      env: { HOME: dir, MIOT_CHAT_ORG: "env-org" } as NodeJS.ProcessEnv,
    });
    expect(r.orgSlug).toBe("env-org");
    expect(r.harnessBaseUrl).toBe(
      "http://localhost:8000/api/v1/orgs/env-org/harness",
    );
  });

  it("org slug via profile field orgSlug → builds proxy URL", () => {
    writeConfig(
      {
        defaultProfile: "prod",
        profiles: {
          prod: {
            baseUrl: "https://prod.example.com",
            token: null,
            tenantId: "t-prod",
            userId: "u-prod",
            orgSlug: "profile-org",
          },
        },
      },
      { configDir: dir },
    );
    const r = resolveConfig({ configDir: dir, env: { HOME: dir } as NodeJS.ProcessEnv });
    expect(r.orgSlug).toBe("profile-org");
    expect(r.harnessBaseUrl).toBe(
      "https://prod.example.com/api/v1/orgs/profile-org/harness",
    );
  });

  it("flag beats env beats profile for org slug", () => {
    writeConfig(
      {
        defaultProfile: "p",
        profiles: {
          p: {
            baseUrl: "https://base.example.com",
            token: null,
            tenantId: "t",
            userId: "u",
            orgSlug: "profile-org",
          },
        },
      },
      { configDir: dir },
    );

    // env beats profile
    const byEnv = resolveConfig({
      configDir: dir,
      env: { HOME: dir, MIOT_CHAT_ORG: "env-org" } as NodeJS.ProcessEnv,
    });
    expect(byEnv.orgSlug).toBe("env-org");

    // flag beats env
    const byFlag = resolveConfig({
      configDir: dir,
      env: { HOME: dir, MIOT_CHAT_ORG: "env-org" } as NodeJS.ProcessEnv,
      flags: { org: "flag-org" },
    });
    expect(byFlag.orgSlug).toBe("flag-org");
  });

  it("org slug containing a slash is URL-encoded in harnessBaseUrl", () => {
    const r = resolveConfig({
      configDir: dir,
      env: { HOME: dir } as NodeJS.ProcessEnv,
      flags: { baseUrl: "https://miot.example.com", org: "a/b" },
    });
    expect(r.orgSlug).toBe("a/b");
    expect(r.harnessBaseUrl).toBe(
      "https://miot.example.com/api/v1/orgs/a%2Fb/harness",
    );
  });
});

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { RunMode } from "@microboxlabs/miot-harness-client";

export interface MiotChatProfile {
  baseUrl: string;
  token: string | null;
  tenantId: string;
  userId: string;
  mode?: RunMode;
}

export interface MiotChatConfig {
  defaultProfile: string;
  profiles: Record<string, MiotChatProfile>;
}

export interface ResolvedConfig {
  baseUrl: string;
  token: string | null;
  tenantId: string;
  userId: string;
  mode: RunMode;
  profileName: string;
}

export interface CliFlags {
  baseUrl?: string;
  token?: string;
  tenant?: string;
  user?: string;
  mode?: string;
  profile?: string;
}

export interface ResolveOptions {
  flags?: CliFlags;
  env?: NodeJS.ProcessEnv;
  configDir?: string;
}

const VALID_MODES = new Set<RunMode>(["auto", "canned", "meta", "agentic"]);

export const DEFAULT_CONFIG: MiotChatConfig = {
  defaultProfile: "local",
  profiles: {
    local: {
      baseUrl: "http://localhost:8000",
      token: null,
      tenantId: "demo-tenant",
      userId: "demo-user",
    },
  },
};

export function getConfigDir(env?: NodeJS.ProcessEnv): string {
  const home = (env?.HOME ?? homedir()) || ".";
  return join(home, ".miot-chat");
}

export function getConfigPath(env?: NodeJS.ProcessEnv): string {
  return join(getConfigDir(env), "config.json");
}

export function readConfig(opts?: { configDir?: string }): MiotChatConfig {
  const dir = opts?.configDir ?? getConfigDir();
  const path = join(dir, "config.json");
  if (!existsSync(path)) return cloneDefault();
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as Partial<MiotChatConfig>;
    return normalize(parsed);
  } catch {
    return cloneDefault();
  }
}

export function writeConfig(
  cfg: MiotChatConfig,
  opts?: { configDir?: string },
): void {
  const dir = opts?.configDir ?? getConfigDir();
  const path = join(dir, "config.json");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

export function resolveConfig(opts: ResolveOptions = {}): ResolvedConfig {
  const env = opts.env ?? process.env;
  const flags = opts.flags ?? {};
  const cfg = readConfig({ configDir: opts.configDir ?? getConfigDir(env) });

  const profileName =
    flags.profile ??
    env.MIOT_CHAT_PROFILE ??
    cfg.defaultProfile ??
    "local";
  const profile =
    cfg.profiles[profileName] ?? cfg.profiles[cfg.defaultProfile] ?? DEFAULT_CONFIG.profiles["local"]!;

  const baseUrl =
    flags.baseUrl ?? env.MIOT_CHAT_BASE_URL ?? profile.baseUrl;
  const tokenFlag = flags.token ?? env.MIOT_CHAT_TOKEN;
  const token = tokenFlag ?? profile.token ?? null;
  const tenantId =
    flags.tenant ?? env.MIOT_CHAT_TENANT_ID ?? profile.tenantId;
  const userId = flags.user ?? env.MIOT_CHAT_USER_ID ?? profile.userId;
  const modeRaw = flags.mode ?? env.MIOT_CHAT_MODE ?? profile.mode ?? "auto";
  const mode = (
    VALID_MODES.has(modeRaw as RunMode) ? modeRaw : "auto"
  ) as RunMode;

  return { baseUrl, token, tenantId, userId, mode, profileName };
}

function cloneDefault(): MiotChatConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as MiotChatConfig;
}

function normalize(parsed: Partial<MiotChatConfig>): MiotChatConfig {
  const profiles: Record<string, MiotChatProfile> = {};
  const sourceProfiles = parsed.profiles ?? {};
  for (const [name, p] of Object.entries(sourceProfiles)) {
    profiles[name] = {
      baseUrl: p.baseUrl ?? "http://localhost:8000",
      token: p.token ?? null,
      tenantId: p.tenantId ?? "demo-tenant",
      userId: p.userId ?? "demo-user",
      mode: VALID_MODES.has(p.mode as RunMode)
        ? (p.mode as RunMode)
        : undefined,
    };
  }
  if (Object.keys(profiles).length === 0) {
    profiles.local = { ...DEFAULT_CONFIG.profiles.local! };
  }
  return {
    defaultProfile:
      parsed.defaultProfile && profiles[parsed.defaultProfile]
        ? parsed.defaultProfile
        : Object.keys(profiles)[0]!,
    profiles,
  };
}
